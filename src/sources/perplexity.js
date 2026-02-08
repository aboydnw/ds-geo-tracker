/**
 * Perplexity Sonar LLM Source
 *
 * Queries Perplexity's Sonar model (web-grounded) for GEO search terms
 * and returns normalized results for analysis.
 *
 * @module sources/perplexity
 * @see https://docs.perplexity.ai/api-reference/chat-completions
 */

const API_ENDPOINT = 'https://api.perplexity.ai/chat/completions';
const MODEL = 'sonar';
const FETCH_TIMEOUT_MS = 30_000; // 30s — LLM responses can be slow

/**
 * Perplexity Sonar source definition.
 * Follows the shared source interface for all LLM sources.
 */
const perplexity = {
  name: 'Perplexity',
  referrer: 'https://perplexity.ai',
  rateLimitMs: 1000,
  dataSource: 'web',

  /**
   * Check if this source is enabled (API key configured).
   * Evaluated at call time for testability.
   * @returns {boolean}
   */
  enabled() {
    return !!process.env.PERPLEXITY_API_KEY;
  },

  /**
   * Query Perplexity Sonar with a search term.
   *
   * @param {string} searchTerm - The search term to query
   * @returns {Promise<import('../analysis.js').NormalizedResult>}
   * @throws {Error} If the API call fails after timeout or returns non-OK status
   */
  async query(searchTerm) {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'user', content: searchTerm },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Perplexity API error: HTTP ${response.status} ${body}`);
      }

      const data = await response.json();
      return normalizeResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Perplexity API timeout after ${FETCH_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  },
};

/**
 * Normalize a Perplexity API response into the shared result format.
 *
 * @param {Object} data - Raw Perplexity API response
 * @returns {import('../analysis.js').NormalizedResult}
 */
export function normalizeResponse(data) {
  const content = data.choices?.[0]?.message?.content || '';
  const citations = Array.isArray(data.citations) ? data.citations : [];

  // search_results may not always be present
  const rawSearchResults = Array.isArray(data.search_results) ? data.search_results : [];
  const searchResults = rawSearchResults.map((r) => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.snippet || '',
  }));

  const usage = data.usage || {};

  return {
    content,
    citations,
    searchResults,
    usage: {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0,
    },
  };
}

export default perplexity;
