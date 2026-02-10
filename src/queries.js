/**
 * GEO Queries Configuration
 *
 * This file defines all geospatial-related queries to track.
 * Edit this file to add, remove, or modify tracked queries.
 *
 * Each query has multiple natural-language search terms that are sent
 * as prompts to each LLM source. This gives us varied angles on how
 * visible Development Seed is across different phrasings and contexts.
 *
 * @module queries
 */

/**
 * @typedef {Object} GeoQuery
 * @property {string} id - Unique identifier in kebab-case (e.g., "veda-dashboard")
 * @property {string} name - Human-readable display name (e.g., "VEDA Dashboard")
 * @property {string[]} searchTerms - Natural-language prompts sent to each LLM.
 *   Every term is queried independently, producing one CSV row per term per source.
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
    id: 'lonboard',
    name: 'lonboard',
    searchTerms: [
      'What Python libraries can I use to create a dynamic map tile server?',
      'How can I view large vector datasets in a jupyter notebook?',
    ],
    category: 'product',
  },
  {
    id: 'titiler',
    name: 'titiler',
    searchTerms: [
      'What is titiler and how does it serve map tiles from cloud-optimized geotiffs?',
      'Best open source tools for dynamic raster tile serving',
    ],
    category: 'product',
  },

  // === Geospatial Technologies ===
  {
    id: 'stac',
    name: 'STAC',
    searchTerms: [
      'Open source tools for working with lots of geospatial data',
      'How do I implement STAC?',
      'What tools and libraries exist for working with STAC APIs?',
    ],
    category: 'technology',
  },
  {
    id: 'cng',
    name: 'Cloud Native Geospatial',
    searchTerms: [
      'How do I store and serve geospatial data in the cloud?',
      'Experts in Cloud Native Geospatial',
      'Best practices for storing raster data in the cloud',
    ],
    category: 'technology',
  },

  // === Industry Trends ===
  {
    id: 'satellite-imagery',
    name: 'Satellite Imagery',
    searchTerms: [
      'What are the best open source tools for processing satellite imagery?',
      'What companies and organizations build tools for satellite imagery analysis?',
    ],
    category: 'trend',
  },
  {
    id: 'climate-data',
    name: 'Climate Data',
    searchTerms: [
      'How can I visualize and explore climate datasets using open source tools?',
      'Best approaches for working with large-scale climate datasets in the cloud',
    ],
    category: 'trend',
  },

  // === Organization ===
  {
    id: 'development-seed',
    name: 'Development Seed',
    searchTerms: [
      'Which companies are leaders in open source geospatial technology?',
    ],
    category: 'organization',
  },
];

export default queries;
