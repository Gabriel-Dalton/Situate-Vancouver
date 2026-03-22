export type MobilityLens = 'cycle' | 'pedestrian' | 'drive'

export const MOBILITY_LENS_ORDER: MobilityLens[] = ['cycle', 'pedestrian', 'drive']

export const MOBILITY_LENS_META: Record<
  MobilityLens,
  { label: string; shortLabel: string; color: string }
> = {
  cycle: { label: 'Cycling', shortLabel: 'Cycle', color: '#3ddc97' },
  pedestrian: { label: 'Walking', shortLabel: 'Walk', color: '#f5b942' },
  drive: { label: 'Driving', shortLabel: 'Drive', color: '#ff6b6b' },
}

export type LensSignal = { label: string; value: string; trend: string }

/** Signal data per lens — sourced from City of Vancouver open data and published reports. */
export const LENS_SIGNALS: Record<MobilityLens, LensSignal[]> = {
  cycle: [
    {
      label: 'Active bikeway network',
      value: '344 km',
      trend: '114 km protected · 43 km painted · 177 km local street',
    },
    {
      label: 'Protected lane ratio',
      value: '33.2%',
      trend: '114.4 km of 344.3 km total — City of Vancouver',
    },
    {
      label: 'Collision density (30 d)',
      value: '12.4',
      trend: 'Per km of bikeway · ICBC regional data',
    },
  ],
  pedestrian: [
    {
      label: 'Walk Score (city avg)',
      value: '79',
      trend: 'City of Vancouver published average',
    },
    {
      label: 'Pedestrian corridors',
      value: '4',
      trend: 'City-designated priority walking spines',
    },
    {
      label: '15-min accessibility',
      value: '73%',
      trend: 'Residents within 15-min walk of daily services',
    },
  ],
  drive: [
    {
      label: 'Congestion index',
      value: '1.38',
      trend: 'Peak-hour ratio vs free-flow · Metro Vancouver avg',
    },
    {
      label: 'Metered parking (active)',
      value: '3,571',
      trend: '3,571 of 3,956 meters in service · City of Vancouver',
    },
    {
      label: 'Avg arterial speed',
      value: '34 km/h',
      trend: 'Peak-hour average · major corridors',
    },
  ],
}
