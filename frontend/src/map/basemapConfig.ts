import type { StyleSpecification } from 'maplibre-gl'

export type BasemapId = 'dark' | 'light' | 'streets' | 'satellite'

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

export const BASEMAP_STYLES: Record<BasemapId, string | StyleSpecification> = {
  dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  streets: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  satellite: SATELLITE_STYLE,
}

/** Default map pitch when not in satellite imagery mode. */
export const VECTOR_BASEMAP_PITCH = 42
