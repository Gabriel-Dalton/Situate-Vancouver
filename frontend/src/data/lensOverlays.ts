import type { FeatureCollection } from 'geojson'
import type { MobilityLens } from '../types/mobilityLens'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

export const LENS_OVERLAYS: Record<MobilityLens, FeatureCollection> = {
  cycle: EMPTY,
  pedestrian: EMPTY,
  drive: EMPTY,
}
