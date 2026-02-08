/**
 * ChatGPT LLM Source (OpenAI Responses API with Web Search)
 *
 * Queries OpenAI's Responses API with the web_search tool
 * for grounded, citation-bearing results.
 *
 * @module sources/chatgpt
 * @see https://platform.openai.com/docs/api-reference/responses
 */

const API_ENDPOINT = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-4o';
const FETCH_TIMEOUT_MS = 60_000; // 60s — web search can be slow

/**
 * ChatGPT source definition.
 * Follows the shared source interface for all LLM sources.
 */
const chatgpt = {
  name: 'ChatGPT',
  referrer: 'https://chatgpt.com',
  rateLimitMs: 1000,
  dataSource: 'web',

  /**
   * Check if this source is enabled (API key configured).
   * @returns {boolean}
   */
  enabled() {
    return !!process.env.OPENAI_API_KEY;
  },

  /**
   * Query ChatGPT with a search term using web_search tool.
   *
   * @param {string} searchTerm - The search term to query
   * @returns {Promise<import('../analysis.js').NormalizedResult>}
   */
  async query(searchTerm) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
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
          tools: [{ type: 'web_search' }],
          input: searchTerm,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`ChatGPT API error: HTTP ${response.status} ${body}`);
      }

      const data = await response.json();
      return normalizeResponse(data);
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error(`ChatGPT API timeout after ${FETCH_TIMEOUT_MS}ms`);
      }
      throw error;
    }
  },
};

/**
 * Normalize an OpenAI Responses API response into the shared result format.
 *
 * The Responses API returns an `output` array containing items of various types:
 * - `message` items contain the response text with optional `annotations`
 * - `web_search_call` items represent the search tool invocation
 *
 * Citations are extracted from `url_citation` annotations within message content.
 *
 * @param {Object} data - Raw OpenAI Responses API response
 * @returns {import('../analysis.js').NormalizedResult}
 */
export function normalizeResponse(data) {
  const output = data.output || [];

  // Find message items in the output
  const messageItems = output.filter((item) => item.type === 'message');

  // Extract text content and annotations from message items
  let content = '';
  const citationSet = new Set();
  const searchResults = [];

  for (const msg of messageItems) {
    const contentParts = msg.content || [];
    for (const part of contentParts) {
      if (part.type === 'output_text') {
        content += part.text || '';

        // Extract citations from annotations
        const annotations = part.annotations || [];
        for (const annotation of annotations) {
          if (annotation.type === 'url_citation' && annotation.url) {
            citationSet.add(annotation.url);
            searchResults.push({
              title: annotation.title || '',
              url: annotation.url,
              snippet: '', // Annotations don't include snippets
            });
          }
        }
      }
    }
  }

  // Usage metadata
  const usage = data.usage || {};

  return {
    content,
    citations: [...citationSet],
    searchResults,
    usage: {
      promptTokens: usage.input_tokens || 0,
      completionTokens: usage.output_tokens || 0,
      totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0),
    },
  };
}

export default chatgpt;
