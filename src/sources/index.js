/**
 * LLM Sources Registry
 *
 * Imports all LLM source modules and provides a helper
 * to get the currently enabled sources.
 *
 * @module sources
 */

import perplexity from './perplexity.js';
import gemini from './gemini.js';
import chatgpt from './chatgpt.js';
import claude from './claude.js';

/** All configured LLM sources, in preferred execution order. */
export const ALL_SOURCES = [perplexity, gemini, chatgpt, claude];

/**
 * Get sources that are currently enabled (API key configured).
 * Calls each source's `enabled()` function at invocation time.
 *
 * @returns {typeof ALL_SOURCES}
 */
export function getEnabledSources() {
  return ALL_SOURCES.filter((source) => source.enabled());
}
