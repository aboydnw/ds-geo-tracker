/**
 * GEO Tracker Orchestrator
 *
 * Core tracking loop extracted for testability. Accepts queries and sources
 * as arguments (no side effects, no process.exitCode, no dotenv).
 *
 * Returns detailed per-event results that the caller can persist to CSV
 * or any other storage backend.
 *
 * @module orchestrator
 */

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
 * @typedef {Object} EventRow
 * @property {string} date - ISO date string (YYYY-MM-DD)
 * @property {string} source - LLM source name
 * @property {string} query_name - Human-readable query name
 * @property {string} query_id - Machine-readable query ID
 * @property {string} category - Query category
 * @property {number} prominence_score - 0-100 prominence score
 * @property {boolean} mentioned - Whether DS was mentioned
 * @property {boolean} recommended - Whether DS was recommended
 * @property {string} position - Position of first mention (early/middle/late/none)
 * @property {number} citation_count - Number of DS citations found
 * @property {string} data_source - Source type (web/training)
 * @property {string} ds_pages - Pipe-separated list of DS page URLs
 * @property {number} tokens - Total tokens used for this query
 */

/**
 * @typedef {Object} SourceResult
 * @property {number} success - Number of successful queries
 * @property {number} fail - Number of failed queries
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
 * @property {EventRow[]} rows - Detailed per-event results for storage
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
 * Query a single LLM source for all configured queries and collect results.
 *
 * @param {Object} source - LLM source object
 * @param {Array} queryList - Queries to process
 * @param {string} dateStr - ISO date string for this run
 * @returns {Promise<{sourceResult: SourceResult, rows: EventRow[]}>}
 */
async function trackSource(source, queryList, dateStr) {
  let success = 0;
  let fail = 0;
  let totalTokens = 0;
  const rows = [];

  for (let i = 0; i < queryList.length; i++) {
    const query = queryList[i];
    const queryNum = i + 1;
    const searchTerm = query.searchTerms[0];

    console.log(`  [${queryNum}/${queryList.length}] "${query.name}" → "${searchTerm}"`);

    try {
      // Query the LLM
      const result = await source.query(searchTerm);
      const queryTokens = result.usage.totalTokens;
      totalTokens += queryTokens;

      // Analyze the response
      const analysis = analyzeResponse(result);

      console.log(`    Score: ${analysis.prominenceScore}/100 | Mentioned: ${analysis.mentioned} | Citations: ${analysis.citationCount}`);

      if (analysis.dsPages.length > 0) {
        console.log(`    DS pages: ${analysis.dsPages.join(', ')}`);
      }

      // Collect the result row
      rows.push({
        date: dateStr,
        source: source.name,
        query_name: query.name,
        query_id: query.id,
        category: query.category,
        prominence_score: analysis.prominenceScore,
        mentioned: analysis.mentioned,
        recommended: analysis.recommended,
        position: analysis.position,
        citation_count: analysis.citationCount,
        data_source: source.dataSource,
        ds_pages: analysis.dsPages.join(' | '),
        tokens: queryTokens,
      });

      success++;
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
  return {
    sourceResult: { success, fail, tokens: totalTokens, cost },
    rows,
  };
}

/**
 * Run the GEO tracker across all provided queries and sources.
 *
 * This is the core orchestration function. It has no side effects
 * (no process.exitCode, no dotenv loading, no file I/O) — the caller
 * handles persistence and exit codes.
 *
 * @param {Array} queries - Array of GeoQuery objects
 * @param {Array} sources - Array of enabled LLM source objects
 * @returns {Promise<TrackerResults>}
 */
export async function runTracker(queries, sources) {
  const startTime = Date.now();
  const dateStr = new Date().toISOString().split('T')[0]; // e.g. "2026-02-09"
  const perSource = {};
  const allRows = [];

  let totalSuccess = 0;
  let totalFail = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const source of sources) {
    console.log(`--- ${source.name} (${source.dataSource}) ---`);

    const { sourceResult, rows } = await trackSource(source, queries, dateStr);

    perSource[source.name] = sourceResult;
    allRows.push(...rows);
    totalSuccess += sourceResult.success;
    totalFail += sourceResult.fail;
    totalTokens += sourceResult.tokens;
    totalCost += sourceResult.cost;

    console.log(`  Tokens: ${sourceResult.tokens} | Cost: ~$${sourceResult.cost.toFixed(4)} | ${sourceResult.success}/${sourceResult.success + sourceResult.fail} succeeded`);
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
    rows: allRows,
    duration,
  };
}

// Export internals for testing
export { estimateCost, trackSource };
