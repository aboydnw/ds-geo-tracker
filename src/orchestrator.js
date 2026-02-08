/**
 * GEO Tracker Orchestrator
 *
 * Core tracking loop extracted for testability. Accepts queries and sources
 * as arguments (no side effects, no process.exitCode, no dotenv).
 *
 * @module orchestrator
 */

import { sendEventToPlausible } from './plausible.js';
import { analyzeResponse } from './analysis.js';

/**
 * Delay execution for specified milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the Plausible `url` for a cited DS page.
 * Uses path-based encoding: the tracker domain as host + the cited page's path.
 *
 * @param {string} dsPageUrl - A full URL like "https://developmentseed.org/blog/titiler-v2"
 * @param {string} domain - The Plausible domain (e.g., "geo.developmentseed.org")
 * @returns {string}
 */
function buildPlausibleUrl(dsPageUrl, domain) {
  try {
    const parsed = new URL(dsPageUrl);
    return `https://${domain}${parsed.pathname}`;
  } catch {
    return `https://${domain}/`;
  }
}

/**
 * @typedef {Object} SourceResult
 * @property {number} success - Number of successful events
 * @property {number} fail - Number of failed events
 * @property {number} tokens - Total tokens used
 * @property {number} cost - Estimated cost in USD
 */

/**
 * @typedef {Object} TrackerResults
 * @property {number} totalEvents - Total events attempted
 * @property {number} totalSuccess - Total successful events
 * @property {number} totalFail - Total failed events
 * @property {number} totalTokens - Total tokens across all sources
 * @property {number} totalCost - Estimated total cost in USD
 * @property {Object<string, SourceResult>} perSource - Breakdown per source name
 * @property {number} duration - Duration in seconds
 */

/**
 * Estimate cost for a source based on token usage.
 * Rough per-token rates (input + output averaged).
 *
 * @param {string} sourceName
 * @param {number} totalTokens
 * @returns {number} Estimated cost in USD
 */
function estimateCost(sourceName, totalTokens) {
  // Approximate cost per 1M tokens (blended input/output)
  const rates = {
    'Perplexity': 1,    // $1/1M tokens
    'Gemini': 0.5,      // ~$0.50/1M tokens (flash model)
    'ChatGPT': 7.5,     // ~$2.50 input + $10 output / 1M, averaged
    'Claude': 6,        // ~$3 input + $15 output / 1M, averaged
  };
  const rate = rates[sourceName] || 1;
  return (totalTokens / 1_000_000) * rate;
}

/**
 * Query a single LLM source for all configured queries and send results to Plausible.
 *
 * @param {Object} source - LLM source object
 * @param {Array} queryList - Queries to process
 * @param {string} domain - Plausible domain
 * @returns {Promise<SourceResult>}
 */
async function trackSource(source, queryList, domain) {
  let success = 0;
  let fail = 0;
  let totalTokens = 0;

  for (let i = 0; i < queryList.length; i++) {
    const query = queryList[i];
    const queryNum = i + 1;
    const searchTerm = query.searchTerms[0];

    console.log(`  [${queryNum}/${queryList.length}] "${query.name}" → "${searchTerm}"`);

    try {
      // Query the LLM
      const result = await source.query(searchTerm);
      totalTokens += result.usage.totalTokens;

      // Analyze the response
      const analysis = analyzeResponse(result);

      console.log(`    Score: ${analysis.prominenceScore}/100 | Mentioned: ${analysis.mentioned} | Citations: ${analysis.citationCount}`);

      if (analysis.dsPages.length > 0) {
        console.log(`    DS pages: ${analysis.dsPages.join(', ')}`);
      }

      // Send enriched event to Plausible
      const plausibleUrl = analysis.dsPages.length > 0
        ? buildPlausibleUrl(analysis.dsPages[0], domain)
        : `https://${domain}/`;

      const eventSuccess = await sendEventToPlausible('LLM_Prominence', {
        query_name: query.name,
        query_id: query.id,
        category: query.category,
        prominence_score: String(analysis.prominenceScore),
        mentioned: String(analysis.mentioned),
        recommended: String(analysis.recommended),
        position: String(analysis.position),
        citation_count: String(analysis.citationCount),
        data_source: source.dataSource,
        original_url: analysis.dsPages[0] || '',
      }, {
        referrer: source.referrer,
        url: plausibleUrl,
      });

      if (eventSuccess) {
        success++;
      } else {
        fail++;
        console.log(`    Warning: Plausible event failed for "${query.name}"`);
      }
    } catch (error) {
      fail++;
      console.error(`    Error querying ${source.name} for "${query.name}": ${error.message}`);
    }

    // Rate limiting between API calls (except after last one)
    if (i < queryList.length - 1) {
      await delay(source.rateLimitMs);
    }
  }

  const cost = estimateCost(source.name, totalTokens);
  return { success, fail, tokens: totalTokens, cost };
}

/**
 * Run the GEO tracker across all provided queries and sources.
 *
 * This is the core orchestration function. It has no side effects
 * (no process.exitCode, no dotenv loading) — the caller handles those.
 *
 * @param {Array} queries - Array of GeoQuery objects
 * @param {Array} sources - Array of enabled LLM source objects
 * @param {string} domain - Plausible domain string
 * @returns {Promise<TrackerResults>}
 */
export async function runTracker(queries, sources, domain) {
  const startTime = Date.now();
  const perSource = {};

  let totalSuccess = 0;
  let totalFail = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const source of sources) {
    console.log(`--- ${source.name} (${source.dataSource}) ---`);

    const result = await trackSource(source, queries, domain);

    perSource[source.name] = result;
    totalSuccess += result.success;
    totalFail += result.fail;
    totalTokens += result.tokens;
    totalCost += result.cost;

    console.log(`  Tokens: ${result.tokens} | Cost: ~$${result.cost.toFixed(4)} | ${result.success}/${result.success + result.fail} succeeded`);
    console.log('');
  }

  const duration = (Date.now() - startTime) / 1000;

  return {
    totalEvents: totalSuccess + totalFail,
    totalSuccess,
    totalFail,
    totalTokens,
    totalCost,
    perSource,
    duration,
  };
}

// Export internals for testing
export { buildPlausibleUrl, estimateCost, trackSource };
