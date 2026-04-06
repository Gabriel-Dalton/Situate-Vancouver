export type MobilityLens = 'cycle' | 'pedestrian' | 'drive'

export const MOBILITY_LENS_ORDER: MobilityLens[] = ['cycle', 'pedestrian', 'drive']

export const MOBILITY_LENS_META: Record<
  MobilityLens,
  { label: string; shortLabel: string; color: string }
> = {
  cycle: { label: 'Cycling', shortLabel: 'Cycle', color: '#3ddc97' },
  pedestrian: { label: 'Walking', shortLabel: 'Walk', color: '#f5b942' },
  drive: { label: 'Driving', shortLabel: 'Drive', color: '#00aaef' },
}

