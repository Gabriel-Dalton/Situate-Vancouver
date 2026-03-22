export type InsightLayerState = {
  strategicNodes: boolean
  movementCorridors: boolean
  skytrainNodes: boolean
  incidentMarker: boolean
  open511Events: boolean
}

export type InsightLayerKey = keyof InsightLayerState
