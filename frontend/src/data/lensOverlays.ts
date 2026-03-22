import type { FeatureCollection } from 'geojson'
import type { MobilityLens } from '../types/mobilityLens'

/**
 * Seed GeoJSON per mobility lens.
 * Replace with city open-data or API-driven geometry when available.
 */

const CYCLE_OVERLAY: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Burrard Bridge Bikeway', lens: 'Protected bike lane · high volume' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.1365, 49.2717],
          [-123.1348, 49.2753],
          [-123.1340, 49.2780],
          [-123.1327, 49.2815],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Seaside Greenway (False Creek S)', lens: 'Seawall · separated path' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.1025, 49.2717],
          [-123.1095, 49.2700],
          [-123.1185, 49.2697],
          [-123.1255, 49.2710],
          [-123.1310, 49.2720],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Ontario St Bikeway', lens: 'Neighbourhood greenway' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.1025, 49.2605],
          [-123.1025, 49.2535],
          [-123.1023, 49.2465],
          [-123.1020, 49.2395],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: '10th Ave Bikeway', lens: 'Local street bikeway · east-west' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.1680, 49.2625],
          [-123.1480, 49.2625],
          [-123.1280, 49.2623],
          [-123.1080, 49.2621],
          [-123.0880, 49.2620],
        ],
      },
    },
  ],
}

const PEDESTRIAN_OVERLAY: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Robson Street corridor', lens: 'Primary pedestrian spine · retail' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.1090, 49.2825],
          [-123.1175, 49.2832],
          [-123.1260, 49.2840],
          [-123.1340, 49.2847],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Granville Mall', lens: 'Pedestrian priority · transit access' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.1158, 49.2843],
          [-123.1152, 49.2820],
          [-123.1148, 49.2800],
          [-123.1145, 49.2780],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Seawall (Coal Harbour)', lens: 'Waterfront promenade · accessible' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.1135, 49.2890],
          [-123.1205, 49.2905],
          [-123.1285, 49.2910],
          [-123.1345, 49.2895],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Commercial Drive (pedestrian zone)', lens: 'High foot traffic · neighbourhood retail' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.0695, 49.2680],
          [-123.0695, 49.2630],
          [-123.0693, 49.2580],
          [-123.0690, 49.2530],
        ],
      },
    },
  ],
}

const DRIVE_OVERLAY: FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Granville St arterial', lens: 'North–south arterial · congestion corridor' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.1163, 49.2840],
          [-123.1155, 49.2760],
          [-123.1152, 49.2680],
          [-123.1148, 49.2600],
          [-123.1145, 49.2520],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Broadway arterial', lens: 'East–west major route · signal density high' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.1860, 49.2635],
          [-123.1480, 49.2633],
          [-123.1100, 49.2631],
          [-123.0720, 49.2628],
          [-123.0400, 49.2625],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Knight St corridor', lens: 'Truck route · bridge access' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.0733, 49.2620],
          [-123.0733, 49.2520],
          [-123.0730, 49.2420],
          [-123.0728, 49.2320],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Georgia St viaduct zone', lens: 'Downtown access · peak congestion' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [-123.0960, 49.2765],
          [-123.1020, 49.2780],
          [-123.1095, 49.2795],
          [-123.1160, 49.2810],
        ],
      },
    },
  ],
}

export const LENS_OVERLAYS: Record<MobilityLens, FeatureCollection> = {
  cycle: CYCLE_OVERLAY,
  pedestrian: PEDESTRIAN_OVERLAY,
  drive: DRIVE_OVERLAY,
}
