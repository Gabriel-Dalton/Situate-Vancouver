import type { FeatureCollection } from 'geojson'
import { enrichSkytrainNodes, SKYTRAIN_LINE_COLORS, SKYTRAIN_LEGEND } from './skytrainLineKeys'

describe('enrichSkytrainNodes', () => {
  it('adds lineKey and lens for a known station', () => {
    const input: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Waterfront' },
          geometry: { type: 'Point', coordinates: [-123.113, 49.286] },
        },
      ],
    }
    const out = enrichSkytrainNodes(input)
    expect(out.features[0].properties).toMatchObject({
      lineKey: 'expo-canada',
      lens: 'SkyTrain · Expo · Canada Line',
    })
  })

  it('defaults missing stations to expo and keeps other properties', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const input: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Unknown Station X', id: 1 },
          geometry: { type: 'Point', coordinates: [0, 0] },
        },
      ],
    }
    const out = enrichSkytrainNodes(input)
    expect(out.features[0].properties).toMatchObject({
      lineKey: 'expo',
      lens: 'SkyTrain · Expo Line',
      id: 1,
    })
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('SKYTRAIN_LEGEND', () => {
  it('exposes one entry per displayed line color', () => {
    expect(SKYTRAIN_LEGEND).toHaveLength(3)
    const keys = SKYTRAIN_LEGEND.map((e) => e.key)
    expect(new Set(keys).size).toBe(3)
    expect(keys).toEqual(['expo', 'millennium', 'canada'])
    for (const { key } of SKYTRAIN_LEGEND) {
      expect(SKYTRAIN_LINE_COLORS[key]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
