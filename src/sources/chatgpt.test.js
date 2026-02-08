import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import chatgpt, { normalizeResponse } from './chatgpt.js';

// ============================================================
// normalizeResponse — unit tests
// ============================================================

describe('chatgpt normalizeResponse', () => {
  it('normalizes a complete Responses API response with web search', () => {
    const raw = {
      output: [
        {
          type: 'web_search_call',
          id: 'ws_123',
          status: 'completed',
        },
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'Development Seed offers titiler for dynamic tile serving.',
              annotations: [
                {
                  type: 'url_citation',
                  url: 'https://developmentseed.org/titiler',
                  title: 'titiler - Dynamic Tiles',
                },
                {
                  type: 'url_citation',
                  url: 'https://stacspec.org',
                  title: 'STAC Specification',
                },
              ],
            },
          ],
        },
      ],
      usage: {
        input_tokens: 50,
        output_tokens: 200,
      },
    };

    const result = normalizeResponse(raw);

    assert.equal(result.content, 'Development Seed offers titiler for dynamic tile serving.');
    assert.deepEqual(result.citations, [
      'https://developmentseed.org/titiler',
      'https://stacspec.org',
    ]);
    assert.equal(result.searchResults.length, 2);
    assert.equal(result.searchResults[0].title, 'titiler - Dynamic Tiles');
    assert.equal(result.searchResults[0].url, 'https://developmentseed.org/titiler');
    assert.equal(result.usage.promptTokens, 50);
    assert.equal(result.usage.completionTokens, 200);
    assert.equal(result.usage.totalTokens, 250);
  });

  it('deduplicates citations', () => {
    const raw = {
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'Some text with multiple citations to the same URL.',
              annotations: [
                { type: 'url_citation', url: 'https://example.com', title: 'Example' },
                { type: 'url_citation', url: 'https://example.com', title: 'Example again' },
              ],
            },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
    };

    const result = normalizeResponse(raw);
    assert.equal(result.citations.length, 1);
    // searchResults still has both entries (one per annotation)
    assert.equal(result.searchResults.length, 2);
  });

  it('handles response with no message items', () => {
    const raw = {
      output: [
        { type: 'web_search_call', id: 'ws_456', status: 'completed' },
      ],
      usage: { input_tokens: 10, output_tokens: 0 },
    };

    const result = normalizeResponse(raw);

    assert.equal(result.content, '');
    assert.deepEqual(result.citations, []);
    assert.deepEqual(result.searchResults, []);
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

  it('handles message with no annotations', () => {
    const raw = {
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'A response with no citations.',
              annotations: [],
            },
          ],
        },
      ],
      usage: { input_tokens: 15, output_tokens: 30 },
    };

    const result = normalizeResponse(raw);

    assert.equal(result.content, 'A response with no citations.');
    assert.deepEqual(result.citations, []);
    assert.deepEqual(result.searchResults, []);
  });

  it('concatenates text from multiple message items', () => {
    const raw = {
      output: [
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'First part. ' },
          ],
        },
        {
          type: 'message',
          content: [
            { type: 'output_text', text: 'Second part.' },
          ],
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
    };

    const result = normalizeResponse(raw);
    assert.equal(result.content, 'First part. Second part.');
  });
});

// ============================================================
// chatgpt.enabled() — tests
// ============================================================

describe('chatgpt.enabled()', () => {
  let originalKey;

  beforeEach(() => {
    originalKey = process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.OPENAI_API_KEY = originalKey;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it('returns true when OPENAI_API_KEY is set', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    assert.equal(chatgpt.enabled(), true);
  });

  it('returns false when OPENAI_API_KEY is empty', () => {
    process.env.OPENAI_API_KEY = '';
    assert.equal(chatgpt.enabled(), false);
  });

  it('returns false when OPENAI_API_KEY is not set', () => {
    delete process.env.OPENAI_API_KEY;
    assert.equal(chatgpt.enabled(), false);
  });
});

// ============================================================
// chatgpt source metadata — tests
// ============================================================

describe('chatgpt source metadata', () => {
  it('has correct name', () => assert.equal(chatgpt.name, 'ChatGPT'));
  it('has correct referrer', () => assert.equal(chatgpt.referrer, 'https://chatgpt.com'));
  it('has rate limit of 1 second', () => assert.equal(chatgpt.rateLimitMs, 1000));
  it('has web data source', () => assert.equal(chatgpt.dataSource, 'web'));
});
