import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import perplexity, { normalizeResponse } from './perplexity.js';

// ============================================================
// normalizeResponse — unit tests
// ============================================================

describe('normalizeResponse', () => {
  it('normalizes a complete Perplexity API response', () => {
    const raw = {
      choices: [
        {
          message: {
            content: 'Development Seed offers titiler for dynamic tile serving.',
          },
        },
      ],
      citations: [
        'https://developmentseed.org/blog/titiler-v2',
        'https://stacspec.org',
      ],
      search_results: [
        {
          title: 'titiler - Dynamic Tiles',
          url: 'https://developmentseed.org/titiler',
          snippet: 'Fast COG serving',
        },
      ],
      usage: {
        prompt_tokens: 45,
        completion_tokens: 320,
        total_tokens: 365,
      },
    };

    const result = normalizeResponse(raw);

    assert.equal(result.content, 'Development Seed offers titiler for dynamic tile serving.');
    assert.deepEqual(result.citations, [
      'https://developmentseed.org/blog/titiler-v2',
      'https://stacspec.org',
    ]);
    assert.equal(result.searchResults.length, 1);
    assert.equal(result.searchResults[0].title, 'titiler - Dynamic Tiles');
    assert.equal(result.searchResults[0].url, 'https://developmentseed.org/titiler');
    assert.equal(result.searchResults[0].snippet, 'Fast COG serving');
    assert.equal(result.usage.promptTokens, 45);
    assert.equal(result.usage.completionTokens, 320);
    assert.equal(result.usage.totalTokens, 365);
  });

  it('handles missing citations and search_results', () => {
    const raw = {
      choices: [{ message: { content: 'Hello world.' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };

    const result = normalizeResponse(raw);

    assert.equal(result.content, 'Hello world.');
    assert.deepEqual(result.citations, []);
    assert.deepEqual(result.searchResults, []);
    assert.equal(result.usage.totalTokens, 15);
  });

  it('handles completely empty response', () => {
    const result = normalizeResponse({});

    assert.equal(result.content, '');
    assert.deepEqual(result.citations, []);
    assert.deepEqual(result.searchResults, []);
    assert.equal(result.usage.promptTokens, 0);
    assert.equal(result.usage.completionTokens, 0);
    assert.equal(result.usage.totalTokens, 0);
  });

  it('handles missing usage field', () => {
    const raw = {
      choices: [{ message: { content: 'Some text.' } }],
    };

    const result = normalizeResponse(raw);

    assert.equal(result.usage.promptTokens, 0);
    assert.equal(result.usage.completionTokens, 0);
    assert.equal(result.usage.totalTokens, 0);
  });
});

// ============================================================
// perplexity.enabled() — tests
// ============================================================

describe('perplexity.enabled()', () => {
  let originalKey;

  beforeEach(() => {
    originalKey = process.env.PERPLEXITY_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.PERPLEXITY_API_KEY = originalKey;
    } else {
      delete process.env.PERPLEXITY_API_KEY;
    }
  });

  it('returns true when PERPLEXITY_API_KEY is set', () => {
    process.env.PERPLEXITY_API_KEY = 'test-key-123';
    assert.equal(perplexity.enabled(), true);
  });

  it('returns false when PERPLEXITY_API_KEY is empty string', () => {
    process.env.PERPLEXITY_API_KEY = '';
    assert.equal(perplexity.enabled(), false);
  });

  it('returns false when PERPLEXITY_API_KEY is not set', () => {
    delete process.env.PERPLEXITY_API_KEY;
    assert.equal(perplexity.enabled(), false);
  });
});

// ============================================================
// perplexity source metadata — tests
// ============================================================

describe('perplexity source metadata', () => {
  it('has correct name', () => {
    assert.equal(perplexity.name, 'Perplexity');
  });

  it('has correct referrer', () => {
    assert.equal(perplexity.referrer, 'https://perplexity.ai');
  });

  it('has rate limit of 1 second', () => {
    assert.equal(perplexity.rateLimitMs, 1000);
  });

  it('has web data source', () => {
    assert.equal(perplexity.dataSource, 'web');
  });
});
