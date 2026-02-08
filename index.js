/**
 * GEO Tracker - Main Entry Point
 *
 * Thin wrapper that loads configuration, discovers enabled LLM sources,
 * runs the orchestrator, and prints a summary.
 *
 * Designed to run as a scheduled job via GitHub Actions.
 */

import 'dotenv/config';
import queries from './src/queries.js';
import { ALL_SOURCES } from './src/sources/index.js';
import { runTracker } from './src/orchestrator.js';

async function main() {
  const startTime = new Date();
  console.log('='.repeat(60));
  console.log(`GEO Tracker started at ${startTime.toISOString()}`);
  console.log(`Domain: ${process.env.PLAUSIBLE_DOMAIN || '(not configured)'}`);
  console.log(`Queries: ${queries.length}`);
  console.log(`Sources: ${ALL_SOURCES.map((s) => s.name).join(', ')}`);
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
  const enabledSources = ALL_SOURCES.filter((s) => s.enabled());
  if (enabledSources.length === 0) {
    console.warn('WARNING: No LLM sources are enabled. Nothing to do.');
    console.warn('Set one or more API key environment variables to enable sources:');
    for (const s of ALL_SOURCES) {
      console.warn(`  - ${s.name}: not enabled`);
    }
    // Exit 0 — not a failure, just nothing configured yet
    return;
  }

  console.log(`Enabled sources: ${enabledSources.map((s) => s.name).join(', ')}`);
  console.log('');

  // Run the orchestrator
  const results = await runTracker(queries, enabledSources, process.env.PLAUSIBLE_DOMAIN);

  // Print summary
  console.log('='.repeat(60));
  console.log('GEO Tracker Summary');
  console.log('='.repeat(60));
  console.log(`Sources:        ${enabledSources.length}/${ALL_SOURCES.length} enabled`);
  console.log(`Total events:   ${results.totalEvents}`);
  console.log(`Successful:     ${results.totalSuccess}`);
  console.log(`Failed:         ${results.totalFail}`);
  console.log(`Total tokens:   ${results.totalTokens}`);
  console.log(`Est. cost:      ~$${results.totalCost.toFixed(4)}`);
  console.log(`Duration:       ${results.duration.toFixed(1)}s`);
  console.log('');

  // Per-source breakdown
  console.log('Per-source breakdown:');
  for (const [name, data] of Object.entries(results.perSource)) {
    const total = data.success + data.fail;
    console.log(`  ${name}: ${data.success}/${total} succeeded | ${data.tokens} tokens | ~$${data.cost.toFixed(4)}`);
  }
  console.log('='.repeat(60));

  // Set exit code based on results
  if (results.totalFail > results.totalSuccess) {
    console.log('');
    console.log('FAILED: More than 50% of events failed');
    process.exitCode = 1;
  } else {
    console.log('');
    console.log('Completed successfully');
  }
}

main();
