/**
 * Plausible Analytics Integration
 *
 * Sends custom events to Plausible Analytics via their Events API.
 * Uses native Node.js fetch (available in Node.js 18+, stable in 20+).
 *
 * Note: Requires Node.js 18+ for native fetch. GitHub Actions uses Node.js 20.
 * Local development on older Node versions will log a warning but not crash.
 *
 * Important: Plausible filters traffic from datacenter IPs (like GitHub Actions
 * runners) as bot traffic. To work around this, we send a browser-like
 * User-Agent and a deterministic X-Forwarded-For header so events are not
 * silently dropped.
 *
 * @module plausible
 * @see https://plausible.io/docs/events-api
 */

import { createHash } from 'node:crypto';

const PLAUSIBLE_API_ENDPOINT = 'https://plausible.io/api/event';
const FETCH_TIMEOUT_MS = 10_000; // 10-second timeout per request
const MAX_RETRIES = 1; // One retry for transient failures
const RETRY_DELAY_MS = 2_000; // 2-second backoff before retry

// Browser-like User-Agent as recommended by Plausible docs.
// Non-browser UAs may be filtered or won't populate the Devices report.
const USER_AGENT = 'Mozilla/5.0 (compatible; GeoTracker/1.0; +https://github.com/aboydnw/ds-geo-tracker)';

/**
 * Generate a deterministic IP address from today's date.
 *
 * Plausible uses IP + User-Agent to calculate a unique visitor ID (the raw IP
 * is never stored). By deriving the IP from the current date we get:
 *   - Consistent visitor identity within a single day (same hash → same IP)
 *   - A new "visitor" each day (different hash)
 *   - An IP outside well-known datacenter ranges so Plausible won't filter it
 *
 * @returns {string} An IPv4 address string
 */
function generateDailyIp() {
  const dateStr = new Date().toISOString().split('T')[0]; // e.g. "2026-02-08"
  const hash = createHash('sha256')
    .update(`geo-tracker-${dateStr}`)
    .digest();

  // Build four octets from the hash, steering clear of reserved ranges:
  //   octet 1: 11–99  (avoids 0/10/127 and 100.64/10 carrier-grade NAT)
  //   octet 2-3: 0–255
  //   octet 4: 1–254  (avoids .0 network and .255 broadcast)
  const a = (hash[0] % 89) + 11;
  const b = hash[1];
  const c = hash[2];
  const d = (hash[3] % 254) + 1;
  return `${a}.${b}.${c}.${d}`;
}

/**
 * Check if native fetch is available (Node.js 18+).
 * @returns {boolean}
 */
function isFetchAvailable() {
  return typeof fetch !== 'undefined';
}

/**
 * Determine if an error or HTTP status is a transient failure worth retrying.
 * @param {Error|null} error - The caught error, if any
 * @param {number|null} status - The HTTP status code, if available
 * @returns {boolean}
 */
function isTransientFailure(error, status) {
  if (error) {
    // Network errors, DNS failures, timeouts
    return error.name === 'AbortError' || error.name === 'TypeError' || error.code === 'ECONNRESET';
  }
  if (status) {
    // 5xx server errors and 429 rate limiting
    return status >= 500 || status === 429;
  }
  return false;
}

/**
 * Delay execution for specified milliseconds.
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a custom event to Plausible Analytics.
 *
 * Includes a 10-second timeout per request and a single retry for transient
 * failures (network errors, HTTP 5xx, 429).
 *
 * @param {string} eventName - Name of the event (e.g., "GEO_Query_Tracked")
 * @param {Object} [props={}] - Custom properties to attach to the event
 * @param {Object} [options={}] - Additional event options
 * @param {string} [options.referrer] - Referrer URL, populates Plausible Sources
 *   (e.g., "https://perplexity.ai" → Source: perplexity.ai)
 * @param {string} [options.url] - Page URL, populates Plausible Top Pages.
 *   Should use the tracker domain as hostname with the referenced page's path
 *   (e.g., "https://geo.developmentseed.org/blog/titiler-v2" → Top Pages: /blog/titiler-v2).
 *   Defaults to "https://${PLAUSIBLE_DOMAIN}/" if not provided.
 * @returns {Promise<boolean>} True if event was accepted (HTTP 202), false otherwise
 *
 * @example
 * // Basic event (backward-compatible)
 * await sendEventToPlausible('GEO_Query_Tracked', {
 *   query_id: 'veda-dashboard',
 *   query_name: 'VEDA Dashboard',
 * });
 *
 * @example
 * // Enriched event with LLM source and referenced page
 * await sendEventToPlausible('GEO_Query_Tracked', {
 *   query_name: 'satellite imagery tools',
 *   prominence_score: '72',
 *   mentioned: 'true',
 * }, {
 *   referrer: 'https://perplexity.ai',
 *   url: 'https://geo.developmentseed.org/blog/titiler-v2',
 * });
 */
export async function sendEventToPlausible(eventName, props = {}, options = {}) {
  // Check for native fetch (Node.js 18+)
  if (!isFetchAvailable()) {
    console.error('Warning: Native fetch not available. Requires Node.js 18+. Event not sent.');
    return false;
  }

  // Validate required environment variable
  const domain = process.env.PLAUSIBLE_DOMAIN;
  if (!domain) {
    console.error('Warning: PLAUSIBLE_DOMAIN not set. Event not sent.');
    return false;
  }

  // Build the payload
  const payload = {
    name: eventName,
    url: options.url || `https://${domain}/`,
    domain: domain,
    props: props,
  };

  // Include referrer if provided (populates Plausible Sources report)
  if (options.referrer) {
    payload.referrer = options.referrer;
  }

  const forwardedIp = generateDailyIp();

  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'X-Forwarded-For': forwardedIp,
    },
    body: JSON.stringify(payload),
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(PLAUSIBLE_API_ENDPOINT, {
        ...requestOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Plausible returns 202 Accepted on success
      if (response.status === 202) {
        console.log(`Event sent: ${eventName}`);
        return true;
      }

      // Retry on transient server errors
      if (isTransientFailure(null, response.status) && attempt < MAX_RETRIES) {
        console.log(`    Retrying (HTTP ${response.status})... waiting ${RETRY_DELAY_MS}ms`);
        await delay(RETRY_DELAY_MS);
        continue;
      }

      // Non-retryable failure or retries exhausted
      console.error(`Failed to send event: HTTP ${response.status}`);
      return false;
    } catch (error) {
      clearTimeout(timeoutId);

      // Retry on transient network errors
      if (isTransientFailure(error, null) && attempt < MAX_RETRIES) {
        const reason = error.name === 'AbortError' ? 'timeout' : error.message;
        console.log(`    Retrying (${reason})... waiting ${RETRY_DELAY_MS}ms`);
        await delay(RETRY_DELAY_MS);
        continue;
      }

      // Non-retryable error or retries exhausted
      const reason = error.name === 'AbortError' ? 'Request timed out' : error.message;
      console.error(`Error sending event: ${reason}`);
      return false;
    }
  }

  return false;
}
