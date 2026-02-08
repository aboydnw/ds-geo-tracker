import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeResponse,
  detectMentions,
  detectRecommendation,
  extractDsPages,
  calculateScore,
  DS_KEYWORDS,
} from './analysis.js';

// ============================================================
// analyzeResponse — full integration tests
// ============================================================

describe('analyzeResponse', () => {
  it('returns high score when DS is mentioned early with citation and recommendation', () => {
    const result = {
      content:
        'Development Seed is a leading company in the geospatial space. ' +
        'Their titiler project is one of the best tools for dynamic tile serving. ' +
        'It is widely used for COG rendering.',
      citations: [
        'https://developmentseed.org/blog/titiler-v2',
        'https://developmentseed.org/projects/titiler',
        'https://stacspec.org',
      ],
      searchResults: [],
      usage: { promptTokens: 50, completionTokens: 200, totalTokens: 250 },
    };

    const analysis = analyzeResponse(result);

    assert.equal(analysis.mentioned, true);
    assert.equal(analysis.recommended, true); // "leading", "best", "widely used"
    assert.equal(analysis.position, 1); // mentioned at the very start
    assert.equal(analysis.citationCount, 2); // two DS URLs
    assert.ok(analysis.prominenceScore >= 80, `Expected >= 80, got ${analysis.prominenceScore}`);
    assert.deepEqual(analysis.dsPages, [
      'https://developmentseed.org/blog/titiler-v2',
      'https://developmentseed.org/projects/titiler',
    ]);
  });

  it('returns score 0 when DS is not mentioned at all', () => {
    const result = {
      content:
        'There are many satellite imagery tools available. ' +
        'GDAL, Rasterio, and GeoServer are popular choices for processing. ' +
        'QGIS provides a desktop interface for visualization.',
      citations: ['https://gdal.org', 'https://qgis.org'],
      searchResults: [],
      usage: { promptTokens: 30, completionTokens: 100, totalTokens: 130 },
    };

    const analysis = analyzeResponse(result);

    assert.equal(analysis.mentioned, false);
    assert.equal(analysis.recommended, false);
    assert.equal(analysis.position, 0);
    assert.equal(analysis.citationCount, 0);
    assert.equal(analysis.prominenceScore, 0);
    assert.deepEqual(analysis.dsPages, []);
  });

  it('still scores when DS is mentioned negatively (known limitation)', () => {
    const result = {
      content:
        'While there are many tools, Development Seed\'s titiler is not the best option ' +
        'for most use cases. GDAL is more widely supported.',
      citations: [],
      searchResults: [],
      usage: { promptTokens: 20, completionTokens: 80, totalTokens: 100 },
    };

    const analysis = analyzeResponse(result);

    // Known limitation: "best" triggers recommendation even in negative context
    assert.equal(analysis.mentioned, true);
    assert.ok(analysis.prominenceScore > 0, 'Score should be > 0 even for negative mention');
  });

  it('detects DS via product keyword (titiler) without org name', () => {
    const result = {
      content:
        'For dynamic tile serving, titiler is a recommended Python library ' +
        'that creates lightweight map tile endpoints from Cloud-Optimized GeoTIFFs.',
      citations: ['https://developmentseed.org/titiler'],
      searchResults: [],
      usage: { promptTokens: 25, completionTokens: 90, totalTokens: 115 },
    };

    const analysis = analyzeResponse(result);

    assert.equal(analysis.mentioned, true);
    assert.equal(analysis.recommended, true);
    assert.equal(analysis.citationCount, 1);
    assert.ok(analysis.prominenceScore >= 60, `Expected >= 60, got ${analysis.prominenceScore}`);
  });

  it('handles DS only in citations (not in response text)', () => {
    const result = {
      content:
        'There are several tools for satellite imagery processing including ' +
        'various open-source solutions for COG rendering.',
      citations: ['https://developmentseed.org/blog/titiler-v2'],
      searchResults: [],
      usage: { promptTokens: 20, completionTokens: 60, totalTokens: 80 },
    };

    const analysis = analyzeResponse(result);

    assert.equal(analysis.mentioned, false);
    assert.equal(analysis.citationCount, 1);
    assert.ok(analysis.prominenceScore > 0, 'Score should be > 0 for citation-only');
    assert.ok(analysis.prominenceScore < 30, 'Score should be modest for citation-only');
  });

  it('handles empty response', () => {
    const result = {
      content: '',
      citations: [],
      searchResults: [],
      usage: { promptTokens: 10, completionTokens: 0, totalTokens: 10 },
    };

    const analysis = analyzeResponse(result);

    assert.equal(analysis.mentioned, false);
    assert.equal(analysis.prominenceScore, 0);
  });

  it('extracts DS pages from searchResults as well as citations', () => {
    const result = {
      content: 'Development Seed offers several tools.',
      citations: ['https://developmentseed.org/blog/sat-api'],
      searchResults: [
        { title: 'titiler', url: 'https://developmentseed.org/titiler', snippet: 'Dynamic tiles' },
        { title: 'GDAL', url: 'https://gdal.org', snippet: 'Geospatial library' },
      ],
      usage: { promptTokens: 20, completionTokens: 50, totalTokens: 70 },
    };

    const analysis = analyzeResponse(result);

    assert.equal(analysis.citationCount, 2); // one from citations, one from searchResults
    assert.ok(analysis.dsPages.includes('https://developmentseed.org/blog/sat-api'));
    assert.ok(analysis.dsPages.includes('https://developmentseed.org/titiler'));
  });
});

// ============================================================
// detectMentions — unit tests
// ============================================================

describe('detectMentions', () => {
  it('finds "development seed" at the start', () => {
    const { mentioned, position } = detectMentions('development seed is great at geospatial work.');
    assert.equal(mentioned, true);
    assert.equal(position, 1);
  });

  it('finds "titiler" keyword', () => {
    const { mentioned } = detectMentions('try titiler for dynamic tiles');
    assert.equal(mentioned, true);
  });

  it('returns not mentioned for unrelated text', () => {
    const { mentioned, position } = detectMentions('mapbox and carto are popular tools.');
    assert.equal(mentioned, false);
    assert.equal(position, 0);
  });

  it('finds mention late in text (high position)', () => {
    const padding = 'x'.repeat(300);
    const { mentioned, position } = detectMentions(padding + ' development seed');
    assert.equal(mentioned, true);
    assert.ok(position >= 3, `Expected position >= 3, got ${position}`);
  });
});

// ============================================================
// detectRecommendation — unit tests
// ============================================================

describe('detectRecommendation', () => {
  it('detects "recommended"', () => {
    assert.equal(detectRecommendation('titiler is recommended for cog serving'), true);
  });

  it('detects "best"', () => {
    assert.equal(detectRecommendation('one of the best tools available'), true);
  });

  it('detects "widely used"', () => {
    assert.equal(detectRecommendation('this library is widely used in production'), true);
  });

  it('returns false for neutral text', () => {
    assert.equal(detectRecommendation('titiler is a python library for tile serving'), false);
  });
});

// ============================================================
// extractDsPages — unit tests
// ============================================================

describe('extractDsPages', () => {
  it('finds DS URLs in citations', () => {
    const pages = extractDsPages(
      ['https://developmentseed.org/blog/x', 'https://gdal.org'],
      [],
    );
    assert.deepEqual(pages, ['https://developmentseed.org/blog/x']);
  });

  it('finds DS URLs in search results', () => {
    const pages = extractDsPages([], [
      { url: 'https://developmentseed.org/titiler' },
    ]);
    assert.deepEqual(pages, ['https://developmentseed.org/titiler']);
  });

  it('deduplicates URLs across citations and searchResults', () => {
    const url = 'https://developmentseed.org/blog/titiler-v2';
    const pages = extractDsPages([url], [{ url }]);
    assert.equal(pages.length, 1);
  });

  it('returns empty for no DS URLs', () => {
    const pages = extractDsPages(['https://gdal.org'], [{ url: 'https://qgis.org' }]);
    assert.deepEqual(pages, []);
  });
});

// ============================================================
// calculateScore — unit tests
// ============================================================

describe('calculateScore', () => {
  it('returns 0 when not mentioned and no citations', () => {
    const score = calculateScore({
      mentioned: false,
      recommended: false,
      position: 0,
      citationCount: 0,
      contentLength: 500,
    });
    assert.equal(score, 0);
  });

  it('returns 30 for mention only', () => {
    const score = calculateScore({
      mentioned: true,
      recommended: false,
      position: 3,
      citationCount: 0,
      contentLength: 500,
    });
    assert.equal(score, 30);
  });

  it('returns max 100 even with all factors', () => {
    const score = calculateScore({
      mentioned: true,
      recommended: true,
      position: 1,
      citationCount: 5,
      contentLength: 500,
    });
    assert.equal(score, 100);
  });

  it('gives citation bonus without mention', () => {
    const score = calculateScore({
      mentioned: false,
      recommended: false,
      position: 0,
      citationCount: 1,
      contentLength: 500,
    });
    assert.equal(score, 15); // citation-only bonus
  });

  it('gives position bonus for early mention', () => {
    const earlyScore = calculateScore({
      mentioned: true,
      recommended: false,
      position: 1,
      citationCount: 0,
      contentLength: 500,
    });
    const lateScore = calculateScore({
      mentioned: true,
      recommended: false,
      position: 4,
      citationCount: 0,
      contentLength: 500,
    });
    assert.ok(earlyScore > lateScore, `Early ${earlyScore} should beat late ${lateScore}`);
  });
});
