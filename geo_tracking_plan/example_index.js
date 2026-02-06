// index.js
// Main entry point - runs all GEO tracking queries and sends events to Plausible.
// Designed to run as a one-shot script triggered by GitHub Actions (or manually).
// No cron scheduler needed - GitHub Actions handles scheduling.

import 'dotenv/config';
import { sendEventToPlausible } from './src/plausible.js';
import GEO_QUERIES from './src/queries.js';

// ============================================================
// CONFIGURATION VALIDATION
// ============================================================

function validateConfig() {
  const errors = [];

  if (!process.env.PLAUSIBLE_DOMAIN) {
    errors.push('Missing PLAUSIBLE_DOMAIN environment variable');
  } else if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*\.)+[a-zA-Z]{2,}$/.test(process.env.PLAUSIBLE_DOMAIN)) {
    errors.push(`Invalid PLAUSIBLE_DOMAIN format: "${process.env.PLAUSIBLE_DOMAIN}"`);
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`Config error: ${err}`);
    }
    console.error('Fix the above errors and try again.');
    process.exit(1);
  }

  console.log('Configuration validated');
  console.log(`  Domain: ${process.env.PLAUSIBLE_DOMAIN}`);
}

// ============================================================
// MAIN TRACKING FUNCTION
// ============================================================

async function trackGEOQueries() {
  const startTime = Date.now();
  console.log(`\nStarting GEO tracking job at ${new Date().toISOString()}`);
  console.log(`Tracking ${GEO_QUERIES.length} queries\n`);

  let successCount = 0;
  const failedQueries = [];

  for (let i = 0; i < GEO_QUERIES.length; i++) {
    const query = GEO_QUERIES[i];
    console.log(`Processing query ${i + 1}/${GEO_QUERIES.length}: ${query.name}`);

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
      failedQueries.push(query.name);
    }

    // 500ms delay between API calls to avoid rate limiting
    if (i < GEO_QUERIES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Log summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n--- Run Summary ---`);
  console.log(`Total queries:  ${GEO_QUERIES.length}`);
  console.log(`Successful:     ${successCount}`);
  console.log(`Failed:         ${failedQueries.length}`);
  console.log(`Duration:       ${duration}s`);

  if (failedQueries.length > 0) {
    console.log(`Failed queries: ${failedQueries.join(', ')}`);
  }

  console.log(`Dashboard: https://plausible.io/${process.env.PLAUSIBLE_DOMAIN}\n`);

  return { successCount, failedCount: failedQueries.length };
}

// ============================================================
// RUN
// ============================================================

validateConfig();

const { successCount, failedCount } = await trackGEOQueries();

// Exit with appropriate code for GitHub Actions
// 0 = success (workflow shows green), 1 = failure (workflow shows red)
if (failedCount > 0 && successCount === 0) {
  console.error('All events failed. Exiting with error.');
  process.exit(1);
}

process.exit(0);
