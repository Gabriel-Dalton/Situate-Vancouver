import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { enrichSkytrainNodes, skytrainCircleColorExpr, skytrainStrokeColorExpr } from '../data/skytrainLineKeys'
import { SKYTRAIN_NODES } from '../data/skytrainStations'
import { MOVEMENT_CORRIDORS, STRATEGIC_NODES } from '../data/vancouverGeo'
import {
  BASEMAP_STYLES,
  type BasemapId,
  VECTOR_BASEMAP_PITCH,
} from '../map/basemapConfig'
import type { InsightLayerKey, InsightLayerState } from '../types/insightLayers'
import MapBasemapToolbar from './MapBasemapToolbar'
import MapInsightToolbar from './MapInsightToolbar'
import './VancouverMap.css'

export type { InsightLayerState } from '../types/insightLayers'

const NODE_LAYERS = ['strategic-nodes-core', 'skytrain-nodes-core'] as const

const INITIAL_BASEMAP: BasemapId = 'dark'
const VAN_CENTRE: [number, number] = [-123.1207, 49.2827]

function applyInsightLayers(map: maplibregl.Map, layers: InsightLayerState) {
  const vis = (on: boolean) => (on ? 'visible' : 'none') as 'visible' | 'none'
  const ids = [
    'skytrain-nodes-glow',
    'skytrain-nodes-core',
    'strategic-nodes-glow',
    'strategic-nodes-core',
    'corridors-line',
  ] as const
  for (const id of ids) {
    if (!map.getLayer(id)) continue
    if (id.startsWith('skytrain')) {
      map.setLayoutProperty(id, 'visibility', vis(layers.skytrainNodes))
    } else if (id.startsWith('strategic')) {
      map.setLayoutProperty(id, 'visibility', vis(layers.strategicNodes))
    } else {
      map.setLayoutProperty(id, 'visibility', vis(layers.movementCorridors))
    }
  }
}

function installInsightOverlay(map: maplibregl.Map) {
  map.addSource('skytrain-nodes', { type: 'geojson', data: enrichSkytrainNodes(SKYTRAIN_NODES) })
  map.addLayer({
    id: 'skytrain-nodes-glow',
    type: 'circle',
    source: 'skytrain-nodes',
    paint: {
      'circle-radius': 14,
      'circle-color': skytrainCircleColorExpr(),
      'circle-opacity': 0.2,
      'circle-blur': 0.75,
    },
  })
  map.addLayer({
    id: 'skytrain-nodes-core',
    type: 'circle',
    source: 'skytrain-nodes',
    paint: {
      'circle-radius': 4,
      'circle-color': skytrainCircleColorExpr(),
      'circle-opacity': 0.94,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': skytrainStrokeColorExpr(),
    },
  })

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
}

export type FocusLocation = {
  lng: number
  lat: number
  label?: string
} | null

type Props = {
  layers: InsightLayerState
  onToggleLayer?: (key: InsightLayerKey) => void
  focusLocation?: FocusLocation
}

export default function VancouverMap({ layers, onToggleLayer, focusLocation }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const styleReadyRef = useRef(false)
  const layersRef = useRef(layers)
  const interactionsBoundRef = useRef(false)
  const focusMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [basemap, setBasemap] = useState<BasemapId>(INITIAL_BASEMAP)

  useLayoutEffect(() => {
    layersRef.current = layers
  }, [layers])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const map = new maplibregl.Map({
      container: el,
      style: BASEMAP_STYLES[INITIAL_BASEMAP],
      center: VAN_CENTRE,
      zoom: 11.35,
      pitch: VECTOR_BASEMAP_PITCH,
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

    const onMapClick = (e: maplibregl.MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: [...NODE_LAYERS] })
      const f = feats[0]
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
    }

    const onMapMouseMove = (e: maplibregl.MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: [...NODE_LAYERS] })
      map.getCanvas().style.cursor = feats.length ? 'pointer' : ''
    }

    const onStyleLoad = () => {
      installInsightOverlay(map)
      applyInsightLayers(map, layersRef.current)
      styleReadyRef.current = true

      if (!interactionsBoundRef.current) {
        interactionsBoundRef.current = true
        map.on('click', onMapClick)
        map.on('mousemove', onMapMouseMove)
      }
    }

    map.on('style.load', onStyleLoad)

    return () => {
      window.removeEventListener('resize', resize)
      map.off('style.load', onStyleLoad)
      map.off('click', onMapClick)
      map.off('mousemove', onMapMouseMove)
      interactionsBoundRef.current = false
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

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (focusMarkerRef.current) {
      focusMarkerRef.current.remove()
      focusMarkerRef.current = null
    }

    if (!focusLocation) return

    const { lng, lat, label } = focusLocation

    map.flyTo({
      center: [lng, lat],
      zoom: 14.5,
      pitch: 45,
      bearing: 0,
      duration: 2200,
      essential: true,
    })

    const el = document.createElement('div')
    el.className = 'van-focus-marker'
    el.innerHTML =
      '<span class="van-focus-marker__ring van-focus-marker__ring--outer"></span>' +
      '<span class="van-focus-marker__ring van-focus-marker__ring--mid"></span>' +
      '<span class="van-focus-marker__dot"></span>'

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(map)

    if (label) {
      const popup = new maplibregl.Popup({
        offset: 28,
        closeButton: false,
        className: 'van-popup',
        maxWidth: '260px',
      }).setHTML(
        `<div class="van-popup__title">${escapeHtml(label)}</div>` +
        `<div class="van-popup__body">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>`,
      )
      marker.setPopup(popup).togglePopup()
    }

    focusMarkerRef.current = marker

    return () => {
      marker.remove()
      focusMarkerRef.current = null
    }
  }, [focusLocation])

  const handleBasemap = (id: BasemapId) => {
    setBasemap(id)
    const map = mapRef.current
    if (!map) return
    map.setStyle(BASEMAP_STYLES[id])
    if (id === 'satellite') {
      map.easeTo({ pitch: 0, duration: 480, easing: (t) => t * (2 - t) })
    } else {
      map.easeTo({ pitch: VECTOR_BASEMAP_PITCH, duration: 480, easing: (t) => t * (2 - t) })
    }
  }

  return (
    <div className="van-map-shell">
      <div ref={containerRef} className="van-map" role="application" aria-label="Vancouver map" />
      <div className="van-map-toolbars">
        <MapBasemapToolbar active={basemap} onSelect={handleBasemap} />
        <MapInsightToolbar layers={layers} onToggleLayer={onToggleLayer} />
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
