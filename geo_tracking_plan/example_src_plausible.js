// src/plausible.js
// Handles all communication with Plausible Analytics API
// Uses Node.js 20+ native fetch (no external HTTP library needed)

const PLAUSIBLE_API_ENDPOINT = 'https://plausible.io/api/event';

/**
 * Send a custom event to Plausible Analytics
 *
 * This is the core function that sends data to your Plausible dashboard.
 * Uses the native fetch API available in Node.js 20+.
 *
 * @param {string} eventName - Name of the event (e.g., "GEO_Query_Tracked")
 * @param {object} props - Custom properties/data (optional)
 *                         e.g., { query_name: "VEDA", count: 42 }
 *
 * @returns {Promise<boolean>} - True if successful, false if failed
 *
 * Example usage:
 *   await sendEventToPlausible('GEO_Query_Tracked', {
 *     query_name: 'VEDA Dashboard',
 *     category: 'product',
 *   });
 */
export async function sendEventToPlausible(eventName, props = {}) {
  // Validate that required config exists before making the request
  if (!process.env.PLAUSIBLE_DOMAIN) {
    console.error('Missing PLAUSIBLE_DOMAIN environment variable. Skipping event.');
    return false;
  }

  try {
    // Build the payload that Plausible expects
    const payload = {
      name: eventName,
      url: `https://${process.env.PLAUSIBLE_DOMAIN}/`,
      domain: process.env.PLAUSIBLE_DOMAIN,
      props: props,
    };

    // Make the HTTP request to Plausible
    // Note: The Events API does not require authentication.
    // It is rate-limited by domain.
    const response = await fetch(PLAUSIBLE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'geo-tracker-bot/1.0',
      },
      body: JSON.stringify(payload),
    });

    // Plausible returns 202 (Accepted) for successful event tracking
    if (response.status === 202 || response.ok) {
      console.log(`Event sent: ${eventName}`, props);
      return true;
    } else {
      console.error(`Failed to send event. Status: ${response.status}`);
      const responseText = await response.text();
      console.error('Response:', responseText);
      return false;
    }
  } catch (error) {
    console.error('Error sending to Plausible:', error.message);
    return false;
  }
}

/**
 * Send multiple events in batch
 *
 * Iterates through a list of events, sending each one with a delay
 * to avoid overwhelming the API.
 *
 * @param {Array<{name: string, props: object}>} events
 * @returns {Promise<{successCount: number, failureCount: number}>}
 */
export async function sendBatchEvents(events) {
  console.log(`Sending batch of ${events.length} events...`);

  let successCount = 0;
  let failureCount = 0;

  for (const event of events) {
    const success = await sendEventToPlausible(event.name, event.props);

    if (success) {
      successCount++;
    } else {
      failureCount++;
    }

    // 500ms delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`Batch complete: ${successCount} sent, ${failureCount} failed`);
  return { successCount, failureCount };
}

// TIPS FOR CUSTOM PROPERTIES:
// 1. Property names should be lowercase and use underscores
// 2. Keep values reasonably short (< 2000 characters)
// 3. Don't send personally identifiable information (PII)
// 4. You can have up to 30 custom properties per event
// 5. Good property examples:
//    - query_name: "VEDA Dashboard"
//    - category: "product"
//    - region: "North America"
//    - timestamp: "2026-02-05T10:30:00Z"
