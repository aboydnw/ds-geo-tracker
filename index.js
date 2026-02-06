/**
 * GEO Tracker - Main Entry Point
 *
 * Tracks geospatial-related search queries and logs events to Plausible Analytics.
 * Designed to run as a scheduled job via GitHub Actions.
 */

import 'dotenv/config';
import { sendEventToPlausible } from './src/plausible.js';
import queries from './src/queries.js';

/**
 * Delay execution for specified milliseconds.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main tracking function.
 * Iterates through all GEO queries and sends events to Plausible.
 */
async function trackGEOQueries() {
  const startTime = new Date();
  console.log('='.repeat(60));
  console.log(`GEO Tracker started at ${startTime.toISOString()}`);
  console.log(`Domain: ${process.env.PLAUSIBLE_DOMAIN || '(not configured)'}`);
  console.log(`Tracking ${queries.length} queries`);
  console.log('='.repeat(60));
  console.log('');

  // Validate configuration
  if (!process.env.PLAUSIBLE_DOMAIN) {
    console.error('FATAL: PLAUSIBLE_DOMAIN not configured');
    process.exit(1);
  }

  if (queries.length === 0) {
    console.error('FATAL: No queries configured');
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  // Process each query
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const queryNum = i + 1;

    console.log(`[${queryNum}/${queries.length}] Processing: ${query.name}`);

    const success = await sendEventToPlausible('GEO_Query_Tracked', {
      query_id: query.id,
      query_name: query.name,
      category: query.category,
      search_terms: query.searchTerms.join(', '),
      timestamp: new Date().toISOString(),
    });

    if (success) {
      successCount++;
    } else {
      failCount++;
      console.log(`    Failed to send event for: ${query.name}`);
    }

    // Rate limiting: wait 500ms between API calls (except after last one)
    if (i < queries.length - 1) {
      await delay(500);
    }
  }

  // Summary
  const endTime = new Date();
  const duration = ((endTime - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('='.repeat(60));
  console.log('GEO Tracker Summary');
  console.log('='.repeat(60));
  console.log(`Total queries:  ${queries.length}`);
  console.log(`Successful:     ${successCount}`);
  console.log(`Failed:         ${failCount}`);
  console.log(`Duration:       ${duration}s`);
  console.log('='.repeat(60));

  // Exit with appropriate code
  // Fail if more than 50% of events failed
  if (failCount > successCount) {
    console.log('');
    console.log('FAILED: More than 50% of events failed to send');
    process.exit(1);
  }

  console.log('');
  console.log('Completed successfully');
  process.exit(0);
}

// Run the tracker
trackGEOQueries();
