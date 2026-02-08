import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import claude, { normalizeResponse } from './claude.js';

// ============================================================
// normalizeResponse — unit tests
// ============================================================

describe('claude normalizeResponse', () => {
  it('normalizes a standard Claude Messages API response', () => {
    const raw = {
      content: [
        {
          type: 'text',
          text: 'Development Seed is a company that builds open-source geospatial tools like titiler.',
        },
      ],
      usage: {
        input_tokens: 25,
        output_tokens: 150,
      },
    };

    const result = normalizeResponse(raw);

    assert.equal(
      result.content,
      'Development Seed is a company that builds open-source geospatial tools like titiler.',
    );
    assert.deepEqual(result.citations, []);
    assert.deepEqual(result.searchResults, []);
    assert.equal(result.usage.promptTokens, 25);
    assert.equal(result.usage.completionTokens, 150);
    assert.equal(result.usage.totalTokens, 175);
  });

  it('always returns empty citations and searchResults', () => {
    const raw = {
      content: [{ type: 'text', text: 'Any response.' }],
      usage: { input_tokens: 10, output_tokens: 20 },
    };

    const result = normalizeResponse(raw);

    assert.deepEqual(result.citations, []);
    assert.deepEqual(result.searchResults, []);
  });

  it('handles multiple content blocks', () => {
    const raw = {
      content: [
        { type: 'text', text: 'First block. ' },
        { type: 'text', text: 'Second block.' },
      ],
      usage: { input_tokens: 10, output_tokens: 30 },
    };

    const result = normalizeResponse(raw);
    assert.equal(result.content, 'First block. Second block.');
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

  it('filters out non-text content blocks', () => {
    const raw = {
      content: [
        { type: 'text', text: 'Only text blocks are included.' },
        { type: 'tool_use', id: 'tu_1', name: 'something', input: {} },
      ],
      usage: { input_tokens: 15, output_tokens: 25 },
    };

    const result = normalizeResponse(raw);
    assert.equal(result.content, 'Only text blocks are included.');
  });

  it('handles missing usage field', () => {
    const raw = {
      content: [{ type: 'text', text: 'Response.' }],
    };

    const result = normalizeResponse(raw);
    assert.equal(result.usage.promptTokens, 0);
    assert.equal(result.usage.completionTokens, 0);
    assert.equal(result.usage.totalTokens, 0);
  });
});

// ============================================================
// claude.enabled() — tests
// ============================================================

describe('claude.enabled()', () => {
  let originalKey;

  beforeEach(() => {
    originalKey = process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it('returns true when ANTHROPIC_API_KEY is set', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    assert.equal(claude.enabled(), true);
  });

  it('returns false when ANTHROPIC_API_KEY is empty', () => {
    process.env.ANTHROPIC_API_KEY = '';
    assert.equal(claude.enabled(), false);
  });

  it('returns false when ANTHROPIC_API_KEY is not set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    assert.equal(claude.enabled(), false);
  });
});

// ============================================================
// claude source metadata — tests
// ============================================================

describe('claude source metadata', () => {
  it('has correct name', () => assert.equal(claude.name, 'Claude'));
  it('has correct referrer', () => assert.equal(claude.referrer, 'https://claude.ai'));
  it('has rate limit of 1 second', () => assert.equal(claude.rateLimitMs, 1000));
  it('has training data source', () => assert.equal(claude.dataSource, 'training'));
});
