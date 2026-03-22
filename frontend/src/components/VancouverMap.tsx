import { useEffect, useLayoutEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MOVEMENT_CORRIDORS, STRATEGIC_NODES } from '../data/vancouverGeo'
import './VancouverMap.css'

export type InsightLayerState = {
  strategicNodes: boolean
  movementCorridors: boolean
}

const STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const VAN_CENTRE: [number, number] = [-123.1207, 49.2827]

function applyInsightLayers(map: maplibregl.Map, layers: InsightLayerState) {
  const vis = (on: boolean) => (on ? 'visible' : 'none') as 'visible' | 'none'
  const ids = ['strategic-nodes-glow', 'strategic-nodes-core', 'corridors-line'] as const
  for (const id of ids) {
    if (!map.getLayer(id)) continue
    if (id.startsWith('strategic')) {
      map.setLayoutProperty(id, 'visibility', vis(layers.strategicNodes))
    } else {
      map.setLayoutProperty(id, 'visibility', vis(layers.movementCorridors))
    }
  }
}

type Props = {
  layers: InsightLayerState
}

export default function VancouverMap({ layers }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const styleReadyRef = useRef(false)
  const layersRef = useRef(layers)
  useLayoutEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const map = new maplibregl.Map({
      container: el,
      style: STYLE_URL,
      center: VAN_CENTRE,
      zoom: 11.35,
      pitch: 42,
      bearing: -28,
      maxPitch: 78,
      minZoom: 9.2,
      maxZoom: 18,
      maxBounds: [
        [-123.38, 49.12],
        [-122.78, 49.42],
      ],
      attributionControl: {},
    })

    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right')

    const resize = () => map.resize()
    window.addEventListener('resize', resize)

    map.on('load', () => {
      map.addSource('strategic-nodes', { type: 'geojson', data: STRATEGIC_NODES })
      map.addLayer({
        id: 'strategic-nodes-glow',
        type: 'circle',
        source: 'strategic-nodes',
        paint: {
          'circle-radius': 20,
          'circle-color': '#00aaef',
          'circle-opacity': 0.22,
          'circle-blur': 0.85,
        },
      })
      map.addLayer({
        id: 'strategic-nodes-core',
        type: 'circle',
        source: 'strategic-nodes',
        paint: {
          'circle-radius': 6,
          'circle-color': '#00aaef',
          'circle-opacity': 0.95,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#001b3d',
        },
      })

      map.addSource('corridors', { type: 'geojson', data: MOVEMENT_CORRIDORS })
      map.addLayer({
        id: 'corridors-line',
        type: 'line',
        source: 'corridors',
        paint: {
          'line-color': '#00aaef',
          'line-width': 2.2,
          'line-opacity': 0.5,
          'line-blur': 0.35,
        },
      })

      map.on('mouseenter', 'strategic-nodes-core', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'strategic-nodes-core', () => {
        map.getCanvas().style.cursor = ''
      })

      map.on('click', 'strategic-nodes-core', (e) => {
        const f = e.features?.[0]
        if (!f?.geometry || f.geometry.type !== 'Point') return
        const coords = f.geometry.coordinates.slice() as [number, number]
        const name = String(f.properties?.name ?? 'Node')
        const lens = String(f.properties?.lens ?? '')

        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
        }

        new maplibregl.Popup({ maxWidth: '280px', className: 'van-popup' })
          .setLngLat(coords)
          .setHTML(
            `<div class="van-popup__title">${escapeHtml(name)}</div>` +
              `<div class="van-popup__body">${escapeHtml(lens)}</div>`,
          )
          .addTo(map)
      })

      styleReadyRef.current = true
      applyInsightLayers(map, layersRef.current)
    })

    return () => {
      window.removeEventListener('resize', resize)
      styleReadyRef.current = false
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return
    applyInsightLayers(map, layers)
  }, [layers])

  return <div ref={containerRef} className="van-map" role="application" aria-label="Vancouver map" />
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
