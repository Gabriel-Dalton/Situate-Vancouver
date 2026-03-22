export type InsightLayerState = {
  strategicNodes: boolean
  movementCorridors: boolean
  skytrainNodes: boolean
  incidentMarker: boolean
}

export type InsightLayerKey = keyof InsightLayerState
