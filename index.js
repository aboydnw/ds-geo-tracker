/**
 * GEO Tracker - Main Entry Point
 *
 * Tracks geospatial-related search queries via LLM sources and logs
 * enriched events to Plausible Analytics.
 * Designed to run as a scheduled job via GitHub Actions.
 */

import 'dotenv/config';
import { sendEventToPlausible } from './src/plausible.js';
import { analyzeResponse } from './src/analysis.js';
import queries from './src/queries.js';
import perplexity from './src/sources/perplexity.js';

/** All configured LLM sources. Add new sources here as they are implemented. */
const SOURCES = [perplexity];

/**
 * Delay execution for specified milliseconds.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build the Plausible `url` for a cited DS page.
 * Uses path-based encoding: the tracker domain as host + the cited page's path.
 * e.g., developmentseed.org/blog/titiler-v2 → https://geo.developmentseed.org/blog/titiler-v2
 *
 * @param {string} dsPageUrl - A full URL like "https://developmentseed.org/blog/titiler-v2"
 * @returns {string} The path-encoded URL under the tracker domain
 */
function buildPlausibleUrl(dsPageUrl) {
  const domain = process.env.PLAUSIBLE_DOMAIN;
  try {
    const parsed = new URL(dsPageUrl);
    return `https://${domain}${parsed.pathname}`;
  } catch {
    return `https://${domain}/`;
  }
}

/**
 * Query a single LLM source for all configured queries and send results to Plausible.
 *
 * @param {Object} source - LLM source object (e.g., perplexity)
 * @param {import('./src/queries.js').GeoQuery[]} queryList - Queries to process
 * @returns {Promise<{success: number, fail: number, tokens: number}>}
 */
async function trackSource(source, queryList) {
  let success = 0;
  let fail = 0;
  let totalTokens = 0;

  for (let i = 0; i < queryList.length; i++) {
    const query = queryList[i];
    const queryNum = i + 1;
    const searchTerm = query.searchTerms[0]; // One API call per query (see story dev notes)

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

      // Send one event per query to Plausible
      const plausibleUrl = analysis.dsPages.length > 0
        ? buildPlausibleUrl(analysis.dsPages[0])
        : `https://${process.env.PLAUSIBLE_DOMAIN}/`;

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

  return { success, fail, tokens: totalTokens };
}

/**
 * Main tracking function.
 * Iterates through all enabled LLM sources and queries, sends enriched events to Plausible.
 */
async function trackGEOQueries() {
  const startTime = new Date();
  console.log('='.repeat(60));
  console.log(`GEO Tracker started at ${startTime.toISOString()}`);
  console.log(`Domain: ${process.env.PLAUSIBLE_DOMAIN || '(not configured)'}`);
  console.log(`Queries: ${queries.length}`);
  console.log(`Sources: ${SOURCES.map((s) => s.name).join(', ')}`);
  console.log('='.repeat(60));
  console.log('');

  // Validate configuration
  if (!process.env.PLAUSIBLE_DOMAIN) {
    console.error('FATAL: PLAUSIBLE_DOMAIN not configured');
    process.exitCode = 1;
    return;
  }

  if (queries.length === 0) {
    console.error('FATAL: No queries configured');
    process.exitCode = 1;
    return;
  }

  // Filter to enabled sources
  const enabledSources = SOURCES.filter((s) => s.enabled());
  if (enabledSources.length === 0) {
    console.warn('WARNING: No LLM sources are enabled. Check your API key environment variables.');
    console.warn('Skipped sources:');
    for (const s of SOURCES) {
      console.warn(`  - ${s.name}: not enabled`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Enabled sources: ${enabledSources.map((s) => s.name).join(', ')}`);
  console.log('');

  let totalSuccess = 0;
  let totalFail = 0;
  let totalTokens = 0;

  // Process each enabled source
  for (const source of enabledSources) {
    console.log(`--- ${source.name} (${source.dataSource}) ---`);

    const result = await trackSource(source, queries);
    totalSuccess += result.success;
    totalFail += result.fail;
    totalTokens += result.tokens;

    // Cost estimate (Perplexity Sonar: $1/1M tokens in + $1/1M tokens out)
    const estimatedCost = (result.tokens / 1_000_000) * 1;
    console.log(`  Tokens used: ${result.tokens} (~$${estimatedCost.toFixed(4)})`);
    console.log('');
  }

  // Summary
  const endTime = new Date();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  console.log('='.repeat(60));
  console.log('GEO Tracker Summary');
  console.log('='.repeat(60));
  console.log(`Sources:        ${enabledSources.length}/${SOURCES.length} enabled`);
  console.log(`Total queries:  ${queries.length * enabledSources.length}`);
  console.log(`Successful:     ${totalSuccess}`);
  console.log(`Failed:         ${totalFail}`);
  console.log(`Total tokens:   ${totalTokens}`);
  console.log(`Duration:       ${duration}s`);
  console.log('='.repeat(60));

  // Set exit code based on results
  if (totalFail > totalSuccess) {
    console.log('');
    console.log('FAILED: More than 50% of events failed');
    process.exitCode = 1;
  } else {
    console.log('');
    console.log('Completed successfully');
  }
}

// Run the tracker
trackGEOQueries();
