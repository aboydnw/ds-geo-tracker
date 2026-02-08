/**
 * Claude LLM Source (Anthropic Messages API)
 *
 * Queries Anthropic's Claude model for training-data-based responses.
 * No web search — measures how well DS is represented in training data.
 *
 * Events are tagged with `data_source: 'training'` to differentiate
 * from web-grounded sources (Perplexity, ChatGPT, Gemini).
 *
 * @module sources/claude
 * @see https://docs.anthropic.com/en/api/messages
 */

const API_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5-20250929';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 1024;
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Claude source definition.
 * Follows the shared source interface for all LLM sources.
 */
const claude = {
  name: 'Claude',
  referrer: 'https://claude.ai',
  rateLimitMs: 1000,
  dataSource: 'training', // No web search — training data only

  /**
   * Check if this source is enabled (API key configured).
   * @returns {boolean}
   */
  enabled() {
    return !!process.env.ANTHROPIC_API_KEY;
  },

  /**
   * Query Claude with a search term.
   *
   * @param {string} searchTerm - The search term to query
   * @returns {Promise<import('../analysis.js').NormalizedResult>}
   */
  async query(searchTerm) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          messages: [
            { role: 'user', content: searchTerm },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Claude API error: HTTP ${response.status} ${body}`);
      }

      const data = await response.json();
      return normalizeResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Claude API timeout after ${FETCH_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  },
};

/**
 * Normalize an Anthropic Messages API response into the shared result format.
 *
 * Claude does not provide citations or search results (no web search capability).
 * Citations and searchResults are always empty arrays.
 *
 * @param {Object} data - Raw Anthropic API response
 * @returns {import('../analysis.js').NormalizedResult}
 */
export function normalizeResponse(data) {
  // Extract text from content blocks
  const contentBlocks = data.content || [];
  const content = contentBlocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text || '')
    .join('');

  // Usage metadata
  const usage = data.usage || {};

  return {
    content,
    citations: [],       // Claude has no web search
    searchResults: [],   // Claude has no web search
    usage: {
      promptTokens: usage.input_tokens || 0,
      completionTokens: usage.output_tokens || 0,
      totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
    },
  };
}

export default claude;
