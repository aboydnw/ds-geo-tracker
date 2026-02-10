/**
 * GEO Queries Configuration
 *
 * This file defines all geospatial-related queries to track.
 * Edit this file to add, remove, or modify tracked queries.
 *
 * @module queries
 */

/**
 * @typedef {Object} GeoQuery
 * @property {string} id - Unique identifier in kebab-case (e.g., "veda-dashboard")
 * @property {string} name - Human-readable display name (e.g., "VEDA Dashboard")
 * @property {string[]} searchTerms - Related search terms for this query.
 *   The first term in the array is used as the prompt sent to each LLM source.
 * @property {string} category - Query category for grouping/filtering:
 *   - "product" - Development Seed products and tools
 *   - "technology" - Geospatial technologies and standards
 *   - "trend" - Industry trends and use cases
 *   - "organization" - Organization/brand mentions
 */

/**
 * List of GEO queries to track.
 * @type {GeoQuery[]}
 */
const queries = [
  // === Development Seed Products ===
  {
    id: 'veda-dashboard',
    name: 'VEDA Dashboard',
    searchTerms: ['VEDA dashboard', 'VEDA NASA', 'NASA VEDA', 'VEDA earth data'],
    category: 'product',
  },
  {
    id: 'titiler',
    name: 'titiler',
    searchTerms: ['titiler', 'titiler python', 'titiler API', 'titiler COG'],
    category: 'product',
  },

  // === Geospatial Technologies ===
  {
    id: 'stac',
    name: 'STAC (Spatio-Temporal Asset Catalog)',
    searchTerms: ['STAC', 'spatio-temporal asset catalog', 'STAC API', 'STAC specification'],
    category: 'technology',
  },
  {
    id: 'cog',
    name: 'Cloud-Optimized GeoTIFF',
    searchTerms: ['COG', 'cloud optimized geotiff', 'Cloud-Optimized GeoTIFF'],
    category: 'technology',
  },

  // === Industry Trends ===
  {
    id: 'satellite-imagery',
    name: 'Satellite Imagery',
    searchTerms: ['satellite imagery', 'satellite imagery python', 'satellite data analysis', 'remote sensing data'],
    category: 'trend',
  },
  {
    id: 'climate-data',
    name: 'Climate Data',
    searchTerms: ['climate data', 'climate geospatial', 'climate analysis geospatial', 'earth climate visualization'],
    category: 'trend',
  },

  // === Organization ===
  {
    id: 'development-seed',
    name: 'Development Seed',
    searchTerms: ['development seed', 'development seed geospatial', 'development seed NASA'],
    category: 'organization',
  },
];

export default queries;
