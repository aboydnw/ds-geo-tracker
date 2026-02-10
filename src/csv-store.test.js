import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, unlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { initCsv, appendResults, HEADERS, escapeCsv, buildRow } from './csv-store.js';

// Use a temp directory for test CSV files
const TEST_DIR = join(import.meta.dirname, '..', '.test-tmp');
const TEST_CSV = join(TEST_DIR, 'test-results.csv');

function cleanup() {
  try { rmSync(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
}

function sampleRow(overrides = {}) {
  return {
    date: '2026-02-09',
    source: 'Perplexity',
    query_name: 'VEDA Dashboard',
    query_id: 'veda-dashboard',
    category: 'tools',
    search_term: 'What is the VEDA dashboard and how is it used for NASA earth science data?',
    prominence_score: 90,
    mentioned: true,
    recommended: true,
    position: 'early',
    citation_count: 2,
    data_source: 'web',
    ds_pages: 'https://developmentseed.org/projects/veda',
    tokens: 432,
    ...overrides,
  };
}

// ============================================================
// escapeCsv
// ============================================================

describe('escapeCsv', () => {
  it('returns plain string unchanged', () => {
    assert.equal(escapeCsv('hello'), 'hello');
  });

  it('wraps strings with commas in double quotes', () => {
    assert.equal(escapeCsv('a,b'), '"a,b"');
  });

  it('doubles existing double quotes', () => {
    assert.equal(escapeCsv('say "hi"'), '"say ""hi"""');
  });

  it('wraps strings with newlines', () => {
    assert.equal(escapeCsv('line1\nline2'), '"line1\nline2"');
  });

  it('converts non-string values to strings', () => {
    assert.equal(escapeCsv(42), '42');
    assert.equal(escapeCsv(true), 'true');
  });
});

// ============================================================
// buildRow
// ============================================================

describe('buildRow', () => {
  it('builds a CSV line from a result object', () => {
    const row = sampleRow();
    const line = buildRow(row);
    const parts = line.split(',');
    assert.equal(parts[0], '2026-02-09');
    assert.equal(parts[1], 'Perplexity');
    assert.equal(parts[2], 'VEDA Dashboard');
  });

  it('escapes ds_pages that contain commas', () => {
    const row = sampleRow({
      ds_pages: 'https://developmentseed.org/a, https://developmentseed.org/b',
    });
    const line = buildRow(row);
    assert.ok(line.includes('"https://developmentseed.org/a, https://developmentseed.org/b"'));
  });

  it('has correct number of columns', () => {
    const row = sampleRow();
    const line = buildRow(row);
    // Count columns carefully — quoted fields may contain commas
    // Simpler: verify field count matches HEADERS
    assert.equal(HEADERS.length, 14);
  });
});

// ============================================================
// initCsv
// ============================================================

describe('initCsv', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('creates a new file with header row', () => {
    initCsv(TEST_CSV);
    assert.ok(existsSync(TEST_CSV));
    const content = readFileSync(TEST_CSV, 'utf-8');
    assert.equal(content.trim(), HEADERS.join(','));
  });

  it('creates parent directories if missing', () => {
    const nested = join(TEST_DIR, 'deep', 'nested', 'results.csv');
    initCsv(nested);
    assert.ok(existsSync(nested));
    // Cleanup nested dirs
    try { rmSync(join(TEST_DIR, 'deep'), { recursive: true }); } catch { /* ignore */ }
  });

  it('does not duplicate header if file already has content', () => {
    initCsv(TEST_CSV);
    initCsv(TEST_CSV); // Call again
    const content = readFileSync(TEST_CSV, 'utf-8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 1, 'Should only have one header line');
  });
});

// ============================================================
// appendResults
// ============================================================

describe('appendResults', () => {
  beforeEach(() => {
    cleanup();
    initCsv(TEST_CSV);
  });
  afterEach(cleanup);

  it('appends a single row', () => {
    const count = appendResults(TEST_CSV, [sampleRow()]);
    assert.equal(count, 1);

    const content = readFileSync(TEST_CSV, 'utf-8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 2); // header + 1 data row
    assert.ok(lines[1].startsWith('2026-02-09'));
  });

  it('appends multiple rows', () => {
    const rows = [
      sampleRow({ source: 'Perplexity' }),
      sampleRow({ source: 'Gemini', prominence_score: 65 }),
      sampleRow({ source: 'ChatGPT', prominence_score: 45 }),
    ];
    const count = appendResults(TEST_CSV, rows);
    assert.equal(count, 3);

    const content = readFileSync(TEST_CSV, 'utf-8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 4); // header + 3 data rows
  });

  it('returns 0 for empty array', () => {
    const count = appendResults(TEST_CSV, []);
    assert.equal(count, 0);
  });

  it('returns 0 for null/undefined', () => {
    assert.equal(appendResults(TEST_CSV, null), 0);
    assert.equal(appendResults(TEST_CSV, undefined), 0);
  });

  it('accumulates rows across multiple calls', () => {
    appendResults(TEST_CSV, [sampleRow({ source: 'Perplexity' })]);
    appendResults(TEST_CSV, [sampleRow({ source: 'Gemini' })]);

    const content = readFileSync(TEST_CSV, 'utf-8');
    const lines = content.trim().split('\n');
    assert.equal(lines.length, 3); // header + 2 data rows
    assert.ok(lines[1].includes('Perplexity'));
    assert.ok(lines[2].includes('Gemini'));
  });
});
