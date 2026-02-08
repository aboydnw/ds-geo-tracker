import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { runTracker, buildPlausibleUrl, estimateCost } from './orchestrator.js';

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

function createMockQueries(count = 2) {
  const names = ['VEDA Dashboard', 'titiler', 'STAC', 'COG', 'Satellite', 'Climate', 'Dev Seed'];
  return Array.from({ length: count }, (_, i) => ({
    id: `query-${i}`,
    name: names[i] || `Query ${i}`,
    searchTerms: [`search term ${i}`],
    category: 'product',
  }));
}

// ============================================================
// buildPlausibleUrl — unit tests
// ============================================================

describe('buildPlausibleUrl', () => {
  it('extracts path from a full URL', () => {
    const url = buildPlausibleUrl('https://developmentseed.org/blog/titiler-v2', 'geo.ds.org');
    assert.equal(url, 'https://geo.ds.org/blog/titiler-v2');
  });

  it('returns domain root for invalid URL', () => {
    const url = buildPlausibleUrl('not a url', 'geo.ds.org');
    assert.equal(url, 'https://geo.ds.org/');
  });

  it('handles URL with trailing slash', () => {
    const url = buildPlausibleUrl('https://developmentseed.org/', 'geo.ds.org');
    assert.equal(url, 'https://geo.ds.org/');
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
  let originalDomain;

  beforeEach(() => {
    originalDomain = process.env.PLAUSIBLE_DOMAIN;
    process.env.PLAUSIBLE_DOMAIN = 'geo.test.org';
  });

  afterEach(() => {
    if (originalDomain !== undefined) {
      process.env.PLAUSIBLE_DOMAIN = originalDomain;
    } else {
      delete process.env.PLAUSIBLE_DOMAIN;
    }
  });

  it('processes 2 queries × 2 sources = 4 events', async () => {
    const queries = createMockQueries(2);
    const source1 = createMockSource({ name: 'Source1' });
    const source2 = createMockSource({ name: 'Source2' });

    const results = await runTracker(queries, [source1, source2], 'geo.test.org');

    assert.equal(results.totalEvents, 4);
    // Success count depends on Plausible being reachable, but events were attempted
    assert.equal(results.totalEvents, results.totalSuccess + results.totalFail);
    assert.ok(results.perSource['Source1'], 'Should have Source1 breakdown');
    assert.ok(results.perSource['Source2'], 'Should have Source2 breakdown');
  });

  it('isolates errors: one source failure does not block others', async () => {
    const queries = createMockQueries(2);

    const failingSource = createMockSource({
      name: 'FailSource',
      query: async () => { throw new Error('API exploded'); },
    });
    const goodSource = createMockSource({ name: 'GoodSource' });

    const results = await runTracker(queries, [failingSource, goodSource], 'geo.test.org');

    // FailSource: 2 failures (one per query)
    assert.equal(results.perSource['FailSource'].fail, 2);
    assert.equal(results.perSource['FailSource'].success, 0);

    // GoodSource: should still process both queries
    const goodResult = results.perSource['GoodSource'];
    assert.equal(goodResult.success + goodResult.fail, 2);
  });

  it('handles single source failing on one query', async () => {
    let callCount = 0;
    const queries = createMockQueries(3);

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

    const results = await runTracker(queries, [flakySource], 'geo.test.org');

    assert.equal(results.perSource['FlakySource'].fail, 1);
    // The other 2 queries should have been attempted (success or Plausible fail)
    assert.equal(results.totalEvents, 3);
  });

  it('handles empty sources array gracefully', async () => {
    const queries = createMockQueries(2);

    const results = await runTracker(queries, [], 'geo.test.org');

    assert.equal(results.totalEvents, 0);
    assert.equal(results.totalSuccess, 0);
    assert.equal(results.totalFail, 0);
    assert.equal(results.totalTokens, 0);
  });

  it('handles empty queries array gracefully', async () => {
    const source = createMockSource({ name: 'Source1' });

    const results = await runTracker([], [source], 'geo.test.org');

    assert.equal(results.totalEvents, 0);
    assert.equal(results.perSource['Source1'].success, 0);
    assert.equal(results.perSource['Source1'].fail, 0);
  });

  it('accumulates tokens and cost across sources', async () => {
    const queries = createMockQueries(1);

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

    const results = await runTracker(queries, [source1, source2], 'geo.test.org');

    assert.equal(results.totalTokens, 650);
    assert.ok(results.totalCost > 0, 'Should have nonzero cost');
    assert.equal(results.perSource['Perplexity'].tokens, 250);
    assert.equal(results.perSource['ChatGPT'].tokens, 400);
  });

  it('records duration', async () => {
    const queries = createMockQueries(1);
    const source = createMockSource({ name: 'Fast' });

    const results = await runTracker(queries, [source], 'geo.test.org');

    assert.ok(typeof results.duration === 'number');
    assert.ok(results.duration >= 0);
  });
});
