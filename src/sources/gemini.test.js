import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import gemini, { normalizeResponse } from './gemini.js';

// ============================================================
// normalizeResponse — unit tests
// ============================================================

describe('gemini normalizeResponse', () => {
  it('normalizes a complete Gemini response with grounding', () => {
    const raw = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Development Seed offers titiler for dynamic tile serving.' }],
          },
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: 'https://developmentseed.org/titiler', title: 'titiler' } },
              { web: { uri: 'https://stacspec.org', title: 'STAC' } },
            ],
            groundingSupports: [
              { segment: { text: 'titiler' }, groundingChunkIndices: [0] },
            ],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 30,
        candidatesTokenCount: 150,
        totalTokenCount: 180,
      },
    };

    const result = normalizeResponse(raw);

    assert.equal(result.content, 'Development Seed offers titiler for dynamic tile serving.');
    assert.deepEqual(result.citations, [
      'https://developmentseed.org/titiler',
      'https://stacspec.org',
    ]);
    assert.equal(result.searchResults.length, 2);
    assert.equal(result.searchResults[0].title, 'titiler');
    assert.equal(result.searchResults[0].url, 'https://developmentseed.org/titiler');
    assert.equal(result.usage.promptTokens, 30);
    assert.equal(result.usage.completionTokens, 150);
    assert.equal(result.usage.totalTokens, 180);
  });

  it('handles response without grounding metadata', () => {
    const raw = {
      candidates: [
        {
          content: {
            parts: [{ text: 'Some general response.' }],
          },
        },
      ],
      usageMetadata: {
        promptTokenCount: 10,
        candidatesTokenCount: 20,
        totalTokenCount: 30,
      },
    };

    const result = normalizeResponse(raw);

    assert.equal(result.content, 'Some general response.');
    assert.deepEqual(result.citations, []);
    assert.deepEqual(result.searchResults, []);
    assert.equal(result.usage.totalTokens, 30);
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

  it('concatenates multiple content parts', () => {
    const raw = {
      candidates: [
        {
          content: {
            parts: [
              { text: 'Part one. ' },
              { text: 'Part two.' },
            ],
          },
        },
      ],
    };

    const result = normalizeResponse(raw);
    assert.equal(result.content, 'Part one. Part two.');
  });
});

// ============================================================
// gemini.enabled() — tests
// ============================================================

describe('gemini.enabled()', () => {
  let originalKey;

  beforeEach(() => {
    originalKey = process.env.GOOGLE_AI_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.GOOGLE_AI_API_KEY = originalKey;
    } else {
      delete process.env.GOOGLE_AI_API_KEY;
    }
  });

  it('returns true when GOOGLE_AI_API_KEY is set', () => {
    process.env.GOOGLE_AI_API_KEY = 'test-key';
    assert.equal(gemini.enabled(), true);
  });

  it('returns false when GOOGLE_AI_API_KEY is empty', () => {
    process.env.GOOGLE_AI_API_KEY = '';
    assert.equal(gemini.enabled(), false);
  });

  it('returns false when GOOGLE_AI_API_KEY is not set', () => {
    delete process.env.GOOGLE_AI_API_KEY;
    assert.equal(gemini.enabled(), false);
  });
});

// ============================================================
// gemini source metadata — tests
// ============================================================

describe('gemini source metadata', () => {
  it('has correct name', () => assert.equal(gemini.name, 'Gemini'));
  it('has correct referrer', () => assert.equal(gemini.referrer, 'https://gemini.google.com'));
  it('has rate limit of 1 second', () => assert.equal(gemini.rateLimitMs, 1000));
  it('has web data source', () => assert.equal(gemini.dataSource, 'web'));
});
