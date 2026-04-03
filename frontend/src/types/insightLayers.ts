export type InsightLayerState = {
  skytrainNodes: boolean
  expoLine: boolean
  millenniumLine: boolean
  incidentMarker: boolean
  buildings: boolean
  outages: boolean
}

export type InsightLayerKey = keyof InsightLayerState
