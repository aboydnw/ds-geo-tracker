/**
 * Gemini LLM Source (Google AI with Search Grounding)
 *
 * Queries Google's Gemini model with google_search grounding tool
 * for web-grounded, citation-bearing results.
 *
 * @module sources/gemini
 * @see https://ai.google.dev/gemini-api/docs/grounding
 */

const MODEL = 'gemini-2.0-flash';
const FETCH_TIMEOUT_MS = 30_000;

/**
 * Build the API endpoint URL for the Gemini generateContent call.
 * @param {string} apiKey
 * @returns {string}
 */
function buildEndpoint(apiKey) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
}

/**
 * Gemini source definition.
 * Follows the shared source interface for all LLM sources.
 */
const gemini = {
  name: 'Gemini',
  referrer: 'https://gemini.google.com',
  rateLimitMs: 1000,
  dataSource: 'web',

  /**
   * Check if this source is enabled (API key configured).
   * @returns {boolean}
   */
  enabled() {
    return !!process.env.GOOGLE_AI_API_KEY;
  },

  /**
   * Query Gemini with a search term using google_search grounding.
   *
   * @param {string} searchTerm - The search term to query
   * @returns {Promise<import('../analysis.js').NormalizedResult>}
   */
  async query(searchTerm) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_AI_API_KEY not configured');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(buildEndpoint(apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: searchTerm }] },
          ],
          tools: [{ google_search: {} }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Gemini API error: HTTP ${response.status} ${body}`);
      }

      const data = await response.json();
      return normalizeResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`Gemini API timeout after ${FETCH_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  },
};

/**
 * Normalize a Gemini API response into the shared result format.
 *
 * @param {Object} data - Raw Gemini API response
 * @returns {import('../analysis.js').NormalizedResult}
 */
export function normalizeResponse(data) {
  const candidate = data.candidates?.[0] || {};

  // Response text
  const content = candidate.content?.parts?.map((p) => p.text || '').join('') || '';

  // Grounding metadata contains citations
  const groundingMeta = candidate.groundingMetadata || {};
  const groundingChunks = groundingMeta.groundingChunks || [];

  // Extract citations (URLs) from grounding chunks
  const citations = groundingChunks
    .filter((chunk) => chunk.web?.uri)
    .map((chunk) => chunk.web.uri);

  // Build search results from grounding chunks (they have title + uri)
  const searchResults = groundingChunks
    .filter((chunk) => chunk.web)
    .map((chunk) => ({
      title: chunk.web.title || '',
      url: chunk.web.uri || '',
      snippet: '', // Gemini grounding chunks don't include snippets
    }));

  // Usage metadata
  const usageMeta = data.usageMetadata || {};

  return {
    content,
    citations,
    searchResults,
    usage: {
      promptTokens: usageMeta.promptTokenCount || 0,
      completionTokens: usageMeta.candidatesTokenCount || 0,
      totalTokens: usageMeta.totalTokenCount || 0,
    },
  };
}

export default gemini;
