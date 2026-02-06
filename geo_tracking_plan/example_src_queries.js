// src/queries.js
// This file defines all the GEO queries you want to track.
//
// In the MVP (Epic 1), searchTerms are stored as metadata and included in
// Plausible event properties for reference. They become actively used in
// Epic 3 when data source integrations (e.g., Google Trends) query these
// terms for real search volume data.

/**
 * @typedef {Object} GeoQuery
 * @property {string} id - Unique identifier (kebab-case)
 * @property {string} name - Display name for the query
 * @property {string[]} searchTerms - Related search terms (metadata in MVP; queried in Epic 3)
 * @property {string} category - Query category (product|technology|trend|use-case|competitor|organization)
 */

/** @type {GeoQuery[]} */
const GEO_QUERIES = [
  // === Your Products ===
  {
    id: "veda-dashboard",
    name: "VEDA Dashboard",
    searchTerms: [
      "VEDA dashboard",
      "VEDA NASA",
      "NASA VEDA",
      "VEDA earth data",
    ],
    category: "product",
  },

  {
    id: "titiler",
    name: "titiler",
    searchTerms: [
      "titiler",
      "titiler python",
      "titiler API",
      "titiler COG",
    ],
    category: "product",
  },

  // === Core Technologies ===
  {
    id: "stac",
    name: "STAC (Spatio-Temporal Asset Catalog)",
    searchTerms: [
      "STAC",
      "spatio-temporal asset catalog",
      "STAC API",
      "STAC specification",
    ],
    category: "technology",
  },

  {
    id: "cog",
    name: "Cloud-Optimized GeoTIFF",
    searchTerms: [
      "COG",
      "cloud optimized geotiff",
      "Cloud-Optimized GeoTIFF",
    ],
    category: "technology",
  },

  // === Use Cases / Trends ===
  {
    id: "satellite-imagery",
    name: "Satellite Imagery",
    searchTerms: [
      "satellite imagery",
      "satellite imagery python",
      "satellite data analysis",
      "remote sensing data",
    ],
    category: "trend",
  },

  {
    id: "climate-data",
    name: "Climate Data",
    searchTerms: [
      "climate data",
      "climate geospatial",
      "climate analysis geospatial",
      "earth climate visualization",
    ],
    category: "trend",
  },

  {
    id: "disaster-mapping",
    name: "Disaster Mapping",
    searchTerms: [
      "disaster mapping",
      "flood mapping",
      "earthquake mapping",
      "disaster geospatial",
    ],
    category: "use-case",
  },

  // === Competitors / Adjacent Tools ===
  {
    id: "mapbox",
    name: "Mapbox",
    searchTerms: [
      "mapbox",
      "mapbox geospatial",
      "mapbox satellite",
    ],
    category: "competitor",
  },

  {
    id: "arcgis",
    name: "ArcGIS",
    searchTerms: [
      "arcgis",
      "esri arcgis",
      "arcgis online",
    ],
    category: "competitor",
  },

  // === Custom / Development Seed ===
  {
    id: "development-seed",
    name: "Development Seed",
    searchTerms: [
      "development seed",
      "development seed geospatial",
      "development seed NASA",
    ],
    category: "organization",
  },
];

export default GEO_QUERIES;

// NOTES:
// - Each query can have multiple searchTerms
// - Categories help you filter in Plausible later
// - Start with 5-10 of your highest priority queries
// - You can always add more later!
