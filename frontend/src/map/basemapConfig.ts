import type { StyleSpecification } from 'maplibre-gl'

export type BasemapId = 'dark' | 'light' | 'streets' | 'satellite'
export type BasemapRole = 'analysis' | 'quiet_day' | 'navigation' | 'imagery'

/** Esri World Imagery — no API key; attribution shown by MapLibre. */
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution:
        '<a href="https://www.esri.com/">© Esri</a> — Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
}

export const BASEMAP_ORDER: BasemapId[] = ['dark', 'light', 'streets', 'satellite']

export const BASEMAP_META: Record<
  BasemapId,
  { name: string; role: BasemapRole; purpose: string; vector: boolean }
> = {
  dark: {
    name: 'Dark',
    role: 'analysis',
    purpose: 'Low-glare analysis mode for overlays and focused monitoring.',
    vector: true,
  },
  light: {
    name: 'Light',
    role: 'quiet_day',
    purpose: 'Quiet daytime scan mode with minimal map noise at far zoom.',
    vector: true,
  },
  streets: {
    name: 'Streets',
    role: 'navigation',
    purpose: 'Navigation context mode with stronger road and place readability.',
    vector: true,
  },
  satellite: {
    name: 'Satellite',
    role: 'imagery',
    purpose: 'Imagery-first context for terrain and real-world ground conditions.',
    vector: false,
  },
}

export const BASEMAP_STYLES: Record<BasemapId, string | StyleSpecification> = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  satellite: SATELLITE_STYLE,
}

/** Default map pitch when not in satellite imagery mode. */
export const VECTOR_BASEMAP_PITCH = 42
