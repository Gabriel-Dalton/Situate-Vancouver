import type { FeatureCollection } from 'geojson'

/** Seed points for the insight canvas — replace or augment with API-driven GeoJSON later. */
export const STRATEGIC_NODES: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        name: 'Central Business District',
        lens: 'Employment density · office pulse',
      },
      geometry: { type: 'Point', coordinates: [-123.1165, 49.2827] },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Granville Island / False Creek',
        lens: 'Waterfront activity · mobility interchange',
      },
      geometry: { type: 'Point', coordinates: [-123.127, 49.271] },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Kitsilano',
        lens: 'Neighbourhood services · shore access',
      },
      geometry: { type: 'Point', coordinates: [-123.155, 49.268] },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Mount Pleasant',
        lens: 'Mixed-use corridors · growth pressure',
      },
      geometry: { type: 'Point', coordinates: [-123.097, 49.263] },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Commercial–East Hastings',
        lens: 'Transit spine · equity indicators',
      },
      geometry: { type: 'Point', coordinates: [-123.069, 49.281] },
    },
  ],
}

/** Example corridor geometry — swap for GTFS, bike counts, or modelled flows from the API. */
export const MOVEMENT_CORRIDORS: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Burrard–Granville axis', lens: 'North–south mobility' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.144, 49.275],
          [-123.13, 49.278],
          [-123.12, 49.282],
          [-123.105, 49.278],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Broadway corridor', lens: 'Rapid transit spine' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.245, 49.263],
          [-123.18, 49.2635],
          [-123.12, 49.263],
          [-123.05, 49.262],
        ],
      },
    },
  ],
}
