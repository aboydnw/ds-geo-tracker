/**
 * CSV Storage Module
 *
 * Appends GEO tracking results to a CSV file. Each row represents one
 * query × source result. The file is created with headers if it doesn't
 * already exist.
 *
 * @module csv-store
 */

import { existsSync, mkdirSync, readFileSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * CSV column headers — order matters, must match buildRow().
 */
const HEADERS = [
  'date',
  'source',
  'query_name',
  'query_id',
  'category',
  'prominence_score',
  'mentioned',
  'recommended',
  'position',
  'citation_count',
  'data_source',
  'ds_pages',
  'tokens',
];

/**
 * Escape a value for CSV. Wraps in double-quotes if the value contains
 * a comma, double-quote, or newline. Inner double-quotes are doubled.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeCsv(value) {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build a single CSV row from a result object.
 *
 * @param {Object} row
 * @returns {string} Comma-separated line (no trailing newline)
 */
function buildRow(row) {
  return [
    escapeCsv(row.date),
    escapeCsv(row.source),
    escapeCsv(row.query_name),
    escapeCsv(row.query_id),
    escapeCsv(row.category),
    escapeCsv(row.prominence_score),
    escapeCsv(row.mentioned),
    escapeCsv(row.recommended),
    escapeCsv(row.position),
    escapeCsv(row.citation_count),
    escapeCsv(row.data_source),
    escapeCsv(row.ds_pages),
    escapeCsv(row.tokens),
  ].join(',');
}

/**
 * Ensure the CSV file exists with a header row. If the file is missing
 * or empty, create it. Parent directories are also created as needed.
 *
 * @param {string} filepath - Path to the CSV file
 */
export function initCsv(filepath) {
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(filepath)) {
    appendFileSync(filepath, HEADERS.join(',') + '\n', 'utf-8');
    return;
  }

  // File exists — check if it's empty or missing the header
  const content = readFileSync(filepath, 'utf-8');
  if (content.trim().length === 0) {
    appendFileSync(filepath, HEADERS.join(',') + '\n', 'utf-8');
  }
}

/**
 * Append one or more result rows to the CSV file.
 *
 * Each entry in `rows` should have the keys defined in HEADERS.
 * The file must already be initialized via `initCsv()`.
 *
 * @param {string} filepath - Path to the CSV file
 * @param {Object[]} rows - Array of result objects to append
 * @returns {number} Number of rows written
 */
export function appendResults(filepath, rows) {
  if (!rows || rows.length === 0) return 0;

  const lines = rows.map(buildRow).join('\n') + '\n';
  appendFileSync(filepath, lines, 'utf-8');
  return rows.length;
}

// Export internals for testing
export { HEADERS, escapeCsv, buildRow };
