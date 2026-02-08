/**
 * Shared Response Analysis Module
 *
 * Analyzes LLM responses for Development Seed visibility.
 * Reusable across all LLM sources (Perplexity, ChatGPT, Claude, Gemini).
 *
 * @module analysis
 */

/**
 * Keywords that indicate Development Seed presence in a response.
 * Case-insensitive matching is used for all keywords.
 */
const DS_KEYWORDS = [
  'development seed',
  'developmentseed',
  'devseed',
  'titiler',
  'veda dashboard',
  'veda',
  'cogeo-mosaic',
];

/** Domain to match in citations and search results. */
const DS_DOMAIN = 'developmentseed.org';

/**
 * Words that suggest a positive recommendation when found near a DS mention.
 */
const RECOMMENDATION_WORDS = [
  'recommended',
  'recommend',
  'best',
  'popular',
  'leading',
  'top',
  'excellent',
  'powerful',
  'widely used',
  'well-known',
  'go-to',
  'notable',
  'prominent',
  'trusted',
];

/**
 * @typedef {Object} NormalizedResult
 * @property {string} content - The LLM's response text
 * @property {string[]} citations - Array of cited URLs
 * @property {Object[]} searchResults - Array of { title, url, snippet }
 * @property {Object} usage - { promptTokens, completionTokens, totalTokens }
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {boolean} mentioned - DS or products found in response text
 * @property {boolean} recommended - Positive recommendation language detected
 * @property {number} position - Position of first DS mention (0 = not found)
 * @property {number} citationCount - Number of developmentseed.org URLs in citations
 * @property {number} prominenceScore - 0-100 composite score
 * @property {string[]} dsPages - Actual DS URLs found in citations/search results
 */

/**
 * Analyze an LLM response for Development Seed visibility.
 *
 * @param {NormalizedResult} result - Normalized LLM response
 * @returns {AnalysisResult}
 */
export function analyzeResponse(result) {
  const content = result.content || '';
  const citations = result.citations || [];
  const searchResults = result.searchResults || [];

  // 1. Check for DS mentions in response text
  const contentLower = content.toLowerCase();
  const { mentioned, position } = detectMentions(contentLower);

  // 2. Check for recommendation language near DS mentions
  const recommended = mentioned ? detectRecommendation(contentLower) : false;

  // 3. Extract DS URLs from citations and search results
  const dsPages = extractDsPages(citations, searchResults);
  const citationCount = dsPages.length;

  // 4. Calculate prominence score
  const prominenceScore = calculateScore({
    mentioned,
    recommended,
    position,
    citationCount,
    contentLength: content.length,
  });

  return {
    mentioned,
    recommended,
    position,
    citationCount,
    prominenceScore,
    dsPages,
  };
}

/**
 * Detect if any DS keywords appear in the content.
 *
 * @param {string} contentLower - Lowercased response text
 * @returns {{ mentioned: boolean, position: number }}
 */
function detectMentions(contentLower) {
  let earliestIndex = -1;

  for (const keyword of DS_KEYWORDS) {
    const index = contentLower.indexOf(keyword.toLowerCase());
    if (index !== -1 && (earliestIndex === -1 || index < earliestIndex)) {
      earliestIndex = index;
    }
  }

  if (earliestIndex === -1) {
    return { mentioned: false, position: 0 };
  }

  // Calculate position as a percentage through the text (1 = very early, higher = later)
  // Then convert to a simple ordinal: 1 if in first 25%, 2 if 25-50%, 3 if 50-75%, 4 if 75-100%
  const fraction = earliestIndex / Math.max(contentLower.length, 1);
  const position = Math.ceil(fraction * 4) || 1; // 1-4 scale, default to 1 if at start

  return { mentioned: true, position };
}

/**
 * Detect recommendation language near DS keywords in the content.
 *
 * @param {string} contentLower - Lowercased response text
 * @returns {boolean}
 */
function detectRecommendation(contentLower) {
  // Check if any recommendation word appears in the text
  // This is a naive proximity check - known limitation documented in story
  for (const word of RECOMMENDATION_WORDS) {
    if (contentLower.includes(word.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Extract developmentseed.org URLs from citations and search results.
 *
 * @param {string[]} citations - Array of cited URLs
 * @param {Object[]} searchResults - Array of { title, url, snippet }
 * @returns {string[]} Unique DS URLs found
 */
function extractDsPages(citations, searchResults) {
  const dsUrls = new Set();

  for (const url of citations) {
    if (typeof url === 'string' && url.includes(DS_DOMAIN)) {
      dsUrls.add(url);
    }
  }

  for (const result of searchResults) {
    if (result.url && result.url.includes(DS_DOMAIN)) {
      dsUrls.add(result.url);
    }
  }

  return [...dsUrls];
}

/**
 * Calculate prominence score (0-100) from analysis factors.
 *
 * Scoring breakdown:
 *   +30 if mentioned in response text
 *   +20 if recommended (positive language)
 *   +15 if cited (at least 1 DS URL in citations)
 *   +10 per additional DS citation (max +20)
 *   +15 if mentioned early (position 1 = first 25% of text)
 *
 * @param {Object} factors
 * @returns {number} Score capped at 100
 */
function calculateScore({ mentioned, recommended, position, citationCount, contentLength }) {
  let score = 0;

  if (!mentioned && citationCount === 0) {
    return 0;
  }

  // Mention bonus
  if (mentioned) {
    score += 30;
  }

  // Recommendation bonus
  if (recommended) {
    score += 20;
  }

  // Citation bonus
  if (citationCount >= 1) {
    score += 15;
    // Additional citations bonus (capped at +20)
    score += Math.min((citationCount - 1) * 10, 20);
  }

  // Position bonus (early mention = higher score)
  if (mentioned && position === 1) {
    score += 15;
  } else if (mentioned && position === 2) {
    score += 8;
  }

  return Math.min(score, 100);
}

// Export internals for testing
export { DS_KEYWORDS, DS_DOMAIN, detectMentions, detectRecommendation, extractDsPages, calculateScore };
