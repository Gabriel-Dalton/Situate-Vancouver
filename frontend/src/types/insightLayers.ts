export type InsightLayerState = {
  skytrainNodes: boolean
  expoLine: boolean
  millenniumLine: boolean
  incidentMarker: boolean
  buildings: boolean
  outages: boolean
  cameras: boolean
}

export type InsightLayerKey = keyof InsightLayerState
