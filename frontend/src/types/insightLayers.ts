export type InsightLayerState = {
  skytrainNodes: boolean
  incidentMarker: boolean
  buildings: boolean
  outages: boolean
}

export type InsightLayerKey = keyof InsightLayerState
