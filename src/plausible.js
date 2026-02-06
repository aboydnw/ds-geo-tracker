/**
 * Plausible Analytics Integration
 *
 * Sends custom events to Plausible Analytics via their Events API.
 * Uses native Node.js fetch (available in Node.js 18+, stable in 20+).
 *
 * Note: Requires Node.js 18+ for native fetch. GitHub Actions uses Node.js 20.
 * Local development on older Node versions will log a warning but not crash.
 *
 * @module plausible
 * @see https://plausible.io/docs/events-api
 */

const PLAUSIBLE_API_ENDPOINT = 'https://plausible.io/api/event';

/**
 * Check if native fetch is available (Node.js 18+).
 * @returns {boolean}
 */
function isFetchAvailable() {
  return typeof fetch !== 'undefined';
}

/**
 * Send a custom event to Plausible Analytics.
 *
 * @param {string} eventName - Name of the event (e.g., "GEO_Query_Tracked")
 * @param {Object} [props={}] - Custom properties to attach to the event
 * @returns {Promise<boolean>} True if event was accepted (HTTP 202), false otherwise
 *
 * @example
 * const success = await sendEventToPlausible('GEO_Query_Tracked', {
 *   query_id: 'veda-dashboard',
 *   query_name: 'VEDA Dashboard',
 *   category: 'product',
 * });
 */
export async function sendEventToPlausible(eventName, props = {}) {
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
    url: `https://${domain}/`,
    domain: domain,
    props: props,
  };

  try {
    const response = await fetch(PLAUSIBLE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'geo-tracker/1.0',
      },
      body: JSON.stringify(payload),
    });

    // Plausible returns 202 Accepted on success
    if (response.status === 202) {
      console.log(`Event sent: ${eventName}`);
      return true;
    }

    // Log unexpected status codes
    console.error(`Failed to send event: HTTP ${response.status}`);
    return false;
  } catch (error) {
    // Network errors, DNS failures, etc.
    console.error(`Error sending event: ${error.message}`);
    return false;
  }
}
