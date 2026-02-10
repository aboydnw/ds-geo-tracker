import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runTracker, estimateCost, expandQueries } from './orchestrator.js';

// ============================================================
// Helpers: mock sources and queries
// ============================================================

function createMockSource(overrides = {}) {
  return {
    name: overrides.name || 'MockLLM',
    referrer: overrides.referrer || 'https://mock.ai',
    rateLimitMs: overrides.rateLimitMs ?? 0, // No delay in tests
    dataSource: overrides.dataSource || 'web',
    enabled: () => true,
    query: overrides.query || (async () => ({
      content: 'Development Seed offers titiler for dynamic tile serving.',
      citations: ['https://developmentseed.org/blog/titiler-v2'],
      searchResults: [],
      usage: { promptTokens: 50, completionTokens: 200, totalTokens: 250 },
    })),
  };
}

/** Create mock queries with a configurable number of search terms each. */
function createMockQueries(count = 2, termsPerQuery = 1) {
  const names = ['VEDA Dashboard', 'titiler', 'STAC', 'COG', 'Satellite', 'Climate', 'Dev Seed'];
  return Array.from({ length: count }, (_, i) => ({
    id: `query-${i}`,
    name: names[i] || `Query ${i}`,
    searchTerms: Array.from({ length: termsPerQuery }, (_, t) =>
      `What about ${names[i] || `Query ${i}`} term ${t}?`
    ),
    category: 'product',
  }));
}

// ============================================================
// expandQueries — unit tests
// ============================================================

describe('expandQueries', () => {
  it('expands queries with multiple search terms', () => {
    const queries = createMockQueries(2, 3);
    const expanded = expandQueries(queries);
    assert.equal(expanded.length, 6); // 2 queries × 3 terms
  });

  it('preserves parent query reference on each expanded entry', () => {
    const queries = createMockQueries(1, 2);
    const expanded = expandQueries(queries);
    assert.equal(expanded[0].query.id, 'query-0');
    assert.equal(expanded[1].query.id, 'query-0');
    assert.notEqual(expanded[0].searchTerm, expanded[1].searchTerm);
  });

  it('returns empty array for no queries', () => {
    assert.equal(expandQueries([]).length, 0);
  });
});

// ============================================================
// estimateCost — unit tests
// ============================================================

describe('estimateCost', () => {
  it('calculates Perplexity cost at $1/1M tokens', () => {
    const cost = estimateCost('Perplexity', 1_000_000);
    assert.equal(cost, 1);
  });

  it('calculates ChatGPT cost at $7.5/1M tokens', () => {
    const cost = estimateCost('ChatGPT', 1_000_000);
    assert.equal(cost, 7.5);
  });

  it('returns small cost for typical daily usage', () => {
    const cost = estimateCost('Perplexity', 2500);
    assert.ok(cost < 0.01, `Expected < $0.01, got $${cost}`);
  });

  it('falls back to $1/1M for unknown source', () => {
    const cost = estimateCost('Unknown', 1_000_000);
    assert.equal(cost, 1);
  });
});

// ============================================================
// runTracker — integration tests
// ============================================================

describe('runTracker', () => {
  it('processes 2 queries (1 term each) × 2 sources = 4 events', async () => {
    const queries = createMockQueries(2, 1);
    const source1 = createMockSource({ name: 'Source1' });
    const source2 = createMockSource({ name: 'Source2' });

    const results = await runTracker(queries, [source1, source2]);

    assert.equal(results.totalEvents, 4);
    assert.equal(results.totalSuccess, 4);
    assert.equal(results.totalFail, 0);
    assert.ok(results.perSource['Source1']);
    assert.ok(results.perSource['Source2']);
  });

  it('expands multiple search terms: 2 queries × 3 terms × 1 source = 6 events', async () => {
    const queries = createMockQueries(2, 3);
    const source = createMockSource({ name: 'TestSource' });

    const results = await runTracker(queries, [source]);

    assert.equal(results.totalEvents, 6);
    assert.equal(results.totalSuccess, 6);
    assert.equal(results.rows.length, 6);
  });

  it('includes search_term in each result row', async () => {
    const queries = createMockQueries(1, 2);
    const source = createMockSource({ name: 'TestSource' });

    const results = await runTracker(queries, [source]);

    assert.equal(results.rows.length, 2);
    assert.ok(results.rows[0].search_term.includes('term 0'));
    assert.ok(results.rows[1].search_term.includes('term 1'));
    // Both rows share the same query name
    assert.equal(results.rows[0].query_name, results.rows[1].query_name);
  });

  it('returns detailed rows for each successful query', async () => {
    const queries = createMockQueries(2, 1);
    const source = createMockSource({ name: 'TestSource' });

    const results = await runTracker(queries, [source]);

    assert.equal(results.rows.length, 2);
    assert.equal(results.rows[0].source, 'TestSource');
    assert.equal(results.rows[0].query_name, 'VEDA Dashboard');
    assert.equal(results.rows[1].query_name, 'titiler');
    assert.ok(results.rows[0].date.match(/^\d{4}-\d{2}-\d{2}$/), 'Date should be YYYY-MM-DD');
    assert.equal(typeof results.rows[0].prominence_score, 'number');
    assert.equal(typeof results.rows[0].mentioned, 'boolean');
    assert.equal(typeof results.rows[0].tokens, 'number');
  });

  it('isolates errors: one source failure does not block others', async () => {
    const queries = createMockQueries(2, 1);

    const failingSource = createMockSource({
      name: 'FailSource',
      query: async () => { throw new Error('API exploded'); },
    });
    const goodSource = createMockSource({ name: 'GoodSource' });

    const results = await runTracker(queries, [failingSource, goodSource]);

    assert.equal(results.perSource['FailSource'].fail, 2);
    assert.equal(results.perSource['FailSource'].success, 0);
    assert.equal(results.perSource['GoodSource'].success, 2);
    assert.equal(results.perSource['GoodSource'].fail, 0);

    // Only good source rows are in the results
    assert.equal(results.rows.length, 2);
    assert.ok(results.rows.every((r) => r.source === 'GoodSource'));
  });

  it('handles single source failing on one prompt', async () => {
    let callCount = 0;
    const queries = createMockQueries(1, 3); // 1 query with 3 terms

    const flakySource = createMockSource({
      name: 'FlakySource',
      query: async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Intermittent failure');
        }
        return {
          content: 'Development Seed is great.',
          citations: [],
          searchResults: [],
          usage: { promptTokens: 10, completionTokens: 50, totalTokens: 60 },
        };
      },
    });

    const results = await runTracker(queries, [flakySource]);

    assert.equal(results.perSource['FlakySource'].fail, 1);
    assert.equal(results.perSource['FlakySource'].success, 2);
    assert.equal(results.totalEvents, 3);
    assert.equal(results.rows.length, 2);
  });

  it('handles empty sources array gracefully', async () => {
    const queries = createMockQueries(2, 2);

    const results = await runTracker(queries, []);

    assert.equal(results.totalEvents, 0);
    assert.equal(results.totalSuccess, 0);
    assert.equal(results.rows.length, 0);
  });

  it('handles empty queries array gracefully', async () => {
    const source = createMockSource({ name: 'Source1' });

    const results = await runTracker([], [source]);

    assert.equal(results.totalEvents, 0);
    assert.equal(results.perSource['Source1'].success, 0);
    assert.equal(results.rows.length, 0);
  });

  it('accumulates tokens and cost across sources', async () => {
    const queries = createMockQueries(1, 1);

    const source1 = createMockSource({
      name: 'Perplexity',
      query: async () => ({
        content: 'Response 1',
        citations: [],
        searchResults: [],
        usage: { promptTokens: 50, completionTokens: 200, totalTokens: 250 },
      }),
    });

    const source2 = createMockSource({
      name: 'ChatGPT',
      query: async () => ({
        content: 'Response 2',
        citations: [],
        searchResults: [],
        usage: { promptTokens: 100, completionTokens: 300, totalTokens: 400 },
      }),
    });

    const results = await runTracker(queries, [source1, source2]);

    assert.equal(results.totalTokens, 650);
    assert.ok(results.totalCost > 0);
    assert.equal(results.perSource['Perplexity'].tokens, 250);
    assert.equal(results.perSource['ChatGPT'].tokens, 400);
  });

  it('records duration', async () => {
    const queries = createMockQueries(1, 1);
    const source = createMockSource({ name: 'Fast' });

    const results = await runTracker(queries, [source]);

    assert.ok(typeof results.duration === 'number');
    assert.ok(results.duration >= 0);
  });

  it('includes ds_pages as pipe-separated string in rows', async () => {
    const queries = createMockQueries(1, 1);
    const source = createMockSource({
      name: 'MultiCite',
      query: async () => ({
        content: 'Development Seed offers titiler and VEDA.',
        citations: [
          'https://developmentseed.org/blog/titiler-v2',
          'https://developmentseed.org/projects/veda',
        ],
        searchResults: [],
        usage: { promptTokens: 50, completionTokens: 200, totalTokens: 250 },
      }),
    });

    const results = await runTracker(queries, [source]);

    assert.ok(results.rows[0].ds_pages.includes('|'));
    assert.ok(results.rows[0].ds_pages.includes('developmentseed.org'));
  });
});
