import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { enrichSkytrainNodes, skytrainCircleColorExpr, skytrainStrokeColorExpr, SKYTRAIN_LINE_COLORS } from '../data/skytrainLineKeys'
import { fetchStationThumb } from '../data/stationWikiTitles'
import { SKYTRAIN_NODES } from '../data/skytrainStations'
import { LENS_OVERLAYS } from '../data/lensOverlays'
import { MOVEMENT_CORRIDORS, STRATEGIC_NODES } from '../data/vancouverGeo'
import {
  BASEMAP_STYLES,
  type BasemapId,
  VECTOR_BASEMAP_PITCH,
} from '../map/basemapConfig'
import type { InsightLayerKey, InsightLayerState } from '../types/insightLayers'
import type { MobilityLens } from '../types/mobilityLens'
import { MOBILITY_LENS_META } from '../types/mobilityLens'
import type { AiQueryResponse } from './AiQuery'
import type { Open511MapEvent } from '../hooks/useOpen511Events'
import MapBasemapToolbar from './MapBasemapToolbar'
import MapInsightToolbar from './MapInsightToolbar'
import './VancouverMap.css'

const SEVERITY_COLORS: Record<AiQueryResponse['severity'], string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#ff3b3b',
}

export type { InsightLayerState } from '../types/insightLayers'

const NODE_LAYERS = ['strategic-nodes-core', 'skytrain-nodes-core', 'open511-events-core'] as const
const LENS_LAYER_IDS = ['lens-overlay-glow', 'lens-overlay-line'] as const

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
    'incident-glow',
    'incident-core',
    'open511-events-glow',
    'open511-events-core',
  ] as const
  for (const id of ids) {
    if (!map.getLayer(id)) continue
    if (id.startsWith('skytrain')) {
      map.setLayoutProperty(id, 'visibility', vis(layers.skytrainNodes))
    } else if (id.startsWith('strategic')) {
      map.setLayoutProperty(id, 'visibility', vis(layers.strategicNodes))
    } else if (id.startsWith('incident')) {
      map.setLayoutProperty(id, 'visibility', vis(layers.incidentMarker))
    } else if (id.startsWith('open511')) {
      map.setLayoutProperty(id, 'visibility', vis(layers.open511Events))
    } else {
      map.setLayoutProperty(id, 'visibility', vis(layers.movementCorridors))
    }
  }
}

function installLensOverlay(map: maplibregl.Map, lens: MobilityLens) {
  const color = MOBILITY_LENS_META[lens].color
  const data = LENS_OVERLAYS[lens]

  if (map.getSource('lens-overlay')) {
    ;(map.getSource('lens-overlay') as maplibregl.GeoJSONSource).setData(data)
    for (const id of LENS_LAYER_IDS) {
      if (!map.getLayer(id)) continue
      if (id.endsWith('-glow')) {
        map.setPaintProperty(id, 'line-color', color)
      } else {
        map.setPaintProperty(id, 'line-color', color)
      }
    }
    return
  }

  map.addSource('lens-overlay', { type: 'geojson', data })
  map.addLayer({
    id: 'lens-overlay-glow',
    type: 'line',
    source: 'lens-overlay',
    paint: {
      'line-color': color,
      'line-width': 8,
      'line-opacity': 0.12,
      'line-blur': 5,
    },
  })
  map.addLayer({
    id: 'lens-overlay-line',
    type: 'line',
    source: 'lens-overlay',
    paint: {
      'line-color': color,
      'line-width': 2.5,
      'line-opacity': 0.72,
      'line-blur': 0.25,
      'line-dasharray': [4, 2.5],
    },
  })
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

const OPEN511_SEVERITY_COLOR: maplibregl.ExpressionSpecification = [
  'match',
  ['get', 'severity'],
  'MAJOR', '#ef4444',
  'MODERATE', '#f59e0b',
  'MINOR', '#22c55e',
  '#94a3b8',
]

function installOpen511Layer(map: maplibregl.Map, events: Open511MapEvent[]) {
  const SRC_ID = 'open511-events'
  const GLOW_ID = 'open511-events-glow'
  const CORE_ID = 'open511-events-core'

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: 'FeatureCollection',
    features: events.map((ev) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [ev.coordinates.lng, ev.coordinates.lat] },
      properties: {
        id: ev.id,
        headline: ev.headline,
        description: ev.description,
        severity: ev.severity,
        event_type: ev.event_type,
        roads: ev.roads,
        updated: ev.updated,
      },
    })),
  }

  if (map.getSource(SRC_ID)) {
    ;(map.getSource(SRC_ID) as maplibregl.GeoJSONSource).setData(geojson)
    return
  }

  map.addSource(SRC_ID, { type: 'geojson', data: geojson })
  map.addLayer({
    id: GLOW_ID,
    type: 'circle',
    source: SRC_ID,
    paint: {
      'circle-radius': 16,
      'circle-color': OPEN511_SEVERITY_COLOR,
      'circle-opacity': 0.18,
      'circle-blur': 0.8,
    },
  })
  map.addLayer({
    id: CORE_ID,
    type: 'circle',
    source: SRC_ID,
    paint: {
      'circle-radius': 5,
      'circle-color': OPEN511_SEVERITY_COLOR,
      'circle-opacity': 0.92,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#001b3d',
    },
  })
}

type Props = {
  layers: InsightLayerState
  onToggleLayer: (key: InsightLayerKey) => void
  lens: MobilityLens
  incident?: AiQueryResponse | null
  open511Events?: Open511MapEvent[]
  focusLocation?: FocusLocation
}

function installIncidentLayer(map: maplibregl.Map, inc: AiQueryResponse) {
  const SRC_ID = 'incident-point'
  const GLOW_ID = 'incident-glow'
  const CORE_ID = 'incident-core'
  const { lat, lng } = inc.coordinates
  const color = SEVERITY_COLORS[inc.severity] ?? SEVERITY_COLORS.low

  const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: { verdict: inc.verdict, location: inc.location, severity: inc.severity },
      },
    ],
  }

  if (map.getSource(SRC_ID)) {
    ;(map.getSource(SRC_ID) as maplibregl.GeoJSONSource).setData(geojson)
    if (map.getLayer(GLOW_ID)) map.setPaintProperty(GLOW_ID, 'circle-color', color)
    if (map.getLayer(CORE_ID)) map.setPaintProperty(CORE_ID, 'circle-color', color)
  } else {
    map.addSource(SRC_ID, { type: 'geojson', data: geojson })
    map.addLayer({
      id: GLOW_ID,
      type: 'circle',
      source: SRC_ID,
      paint: {
        'circle-radius': 22,
        'circle-color': color,
        'circle-opacity': 0.22,
        'circle-blur': 0.9,
      },
    })
    map.addLayer({
      id: CORE_ID,
      type: 'circle',
      source: SRC_ID,
      paint: {
        'circle-radius': 7,
        'circle-color': color,
        'circle-opacity': 0.96,
        'circle-stroke-width': 2,
        'circle-stroke-color': '#001b3d',
      },
    })
  }
}

export default function VancouverMap({
  layers,
  onToggleLayer,
  lens,
  incident,
  open511Events = [],
  focusLocation,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const styleReadyRef = useRef(false)
  const layersRef = useRef(layers)
  const lensRef = useRef(lens)
  const incidentRef = useRef(incident ?? null)
  const open511EventsRef = useRef<Open511MapEvent[]>(open511Events)
  const interactionsBoundRef = useRef(false)
  const focusMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [basemap, setBasemap] = useState<BasemapId>(INITIAL_BASEMAP)
  const [cursorInfo, setCursorInfo] = useState({ lat: VAN_CENTRE[1], lng: VAN_CENTRE[0], zoom: 11.35 })

  const updateCursorInfo = useCallback((map: maplibregl.Map, e?: maplibregl.MapMouseEvent) => {
    const z = map.getZoom()
    if (e) {
      setCursorInfo({ lat: e.lngLat.lat, lng: e.lngLat.lng, zoom: z })
    } else {
      const c = map.getCenter()
      setCursorInfo({ lat: c.lat, lng: c.lng, zoom: z })
    }
  }, [])

  useLayoutEffect(() => {
    layersRef.current = layers
  }, [layers])

  useLayoutEffect(() => {
    lensRef.current = lens
  }, [lens])

  useLayoutEffect(() => {
    incidentRef.current = incident ?? null
  }, [incident])

  useLayoutEffect(() => {
    open511EventsRef.current = open511Events
  }, [open511Events])

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
      const isOpen511 = f.layer?.id === 'open511-events-core'
      const name = isOpen511
        ? String(f.properties?.headline ?? 'Road Event')
        : String(f.properties?.name ?? 'Node')
      const lensText = isOpen511
        ? String(f.properties?.description ?? '')
        : String(f.properties?.lens ?? '')
      const lineKey = String(f.properties?.lineKey ?? '')
      const isSkytrainNode = f.layer?.id === 'skytrain-nodes-core'
      const isStrategicNode = f.layer?.id === 'strategic-nodes-core'
      const lineColor = (lineKey && SKYTRAIN_LINE_COLORS[lineKey as keyof typeof SKYTRAIN_LINE_COLORS]) || ''
      const accentColor = isSkytrainNode ? lineColor : isStrategicNode ? '#00aaef' : ''

      while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
        coords[0] += e.lngLat.lng > coords[0] ? 360 : -360
      }

      const targetZoom = Math.max(map.getZoom(), 14)
      map.flyTo({
        center: coords,
        zoom: targetZoom,
        duration: 800,
        easing: (t) => 1 - Math.pow(1 - t, 3),
      })

      map.once('moveend', () => {
        const accentBar = accentColor
          ? `<div class="van-popup__accent" style="background:${accentColor}"></div>`
          : ''
        const shimmer = isSkytrainNode || isStrategicNode
          ? `<div class="van-popup__img-wrap"><div class="van-popup__shimmer" id="popup-img-slot"></div></div>`
          : ''
        const severityTag = isOpen511 && f.properties?.severity
          ? `<div class="van-popup__body" style="margin-top:4px;opacity:0.7;font-size:0.78em">` +
            `Severity: ${escapeHtml(String(f.properties.severity))} · ` +
            `${escapeHtml(String(f.properties.roads ?? ''))}</div>`
          : ''

        const popup = new maplibregl.Popup({ maxWidth: '300px', className: 'van-popup', offset: 12 })
          .setLngLat(coords)
          .setHTML(
            accentBar +
              shimmer +
              `<div class="van-popup__title">${escapeHtml(name)}</div>` +
              `<div class="van-popup__body">${escapeHtml(lensText)}</div>` +
              severityTag,
          )
          .addTo(map)

        if (isSkytrainNode || isStrategicNode) {
          fetchStationThumb(name).then((url) => {
            const slot = popup.getElement()?.querySelector('#popup-img-slot')
            if (!slot) return
            if (url) {
              const img = document.createElement('img')
              img.src = url
              img.alt = name
              img.className = 'van-popup__img'
              img.onload = () => {
                slot.replaceWith(img)
              }
              img.onerror = () => {
                slot.remove()
              }
            } else {
              slot.remove()
            }
          })
        }
      })
    }

    const onMapMouseMove = (e: maplibregl.MapMouseEvent) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: [...NODE_LAYERS] })
      map.getCanvas().style.cursor = feats.length ? 'pointer' : ''
      updateCursorInfo(map, e)
    }

    const onZoom = () => updateCursorInfo(map)
    const onMoveEnd = () => updateCursorInfo(map)

    const onStyleLoad = () => {
      installInsightOverlay(map)
      installLensOverlay(map, lensRef.current)
      if (open511EventsRef.current.length) installOpen511Layer(map, open511EventsRef.current)
      applyInsightLayers(map, layersRef.current)
      if (incidentRef.current) installIncidentLayer(map, incidentRef.current)
      styleReadyRef.current = true

      if (!interactionsBoundRef.current) {
        interactionsBoundRef.current = true
        map.on('click', onMapClick)
        map.on('mousemove', onMapMouseMove)
        map.on('zoom', onZoom)
        map.on('moveend', onMoveEnd)
      }
    }

    map.on('style.load', onStyleLoad)

    return () => {
      window.removeEventListener('resize', resize)
      map.off('style.load', onStyleLoad)
      map.off('click', onMapClick)
      map.off('mousemove', onMapMouseMove)
      map.off('zoom', onZoom)
      map.off('moveend', onMoveEnd)
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
    if (!map || !styleReadyRef.current) return
    installLensOverlay(map, lens)
  }, [lens])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return

    if (!incident) {
      if (map.getLayer('incident-glow')) map.removeLayer('incident-glow')
      if (map.getLayer('incident-core')) map.removeLayer('incident-core')
      if (map.getSource('incident-point')) map.removeSource('incident-point')
      return
    }

    installIncidentLayer(map, incident)

    const { lat, lng } = incident.coordinates
    map.flyTo({ center: [lng, lat], zoom: 15, duration: 900, easing: (t) => 1 - Math.pow(1 - t, 3) })

    map.once('moveend', () => {
      new maplibregl.Popup({ maxWidth: '300px', className: 'van-popup', offset: 14 })
        .setLngLat([lng, lat])
        .setHTML(
          `<div class="van-popup__title">${escapeHtml(incident.location)}</div>` +
          `<div class="van-popup__body">${escapeHtml(incident.verdict)}</div>` +
          `<div class="van-popup__body" style="margin-top:4px;opacity:0.7;font-size:0.78em">` +
          `Severity: ${escapeHtml(incident.severity)}</div>`,
        )
        .addTo(map)
    })
  }, [incident])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return
    installOpen511Layer(map, open511Events)
    applyInsightLayers(map, layersRef.current)
  }, [open511Events])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return

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

  const fmtCoord = (v: number, pos: string, neg: string) => {
    const abs = Math.abs(v)
    const d = pos === 'N' || pos === 'S' ? 4 : 4
    return `${abs.toFixed(d)}° ${v >= 0 ? pos : neg}`
  }

  return (
    <div className="van-map-shell">
      <div ref={containerRef} className="van-map" role="application" aria-label="Vancouver map" />
      <div className="van-map-toolbars">
        <MapBasemapToolbar active={basemap} onSelect={handleBasemap} />
        <MapInsightToolbar layers={layers} onToggleLayer={onToggleLayer} />
      </div>
      <div className="van-map-footer" aria-label="Cursor coordinates">
        <span className="van-map-footer__coord">{fmtCoord(cursorInfo.lat, 'N', 'S')}</span>
        <span className="van-map-footer__sep" aria-hidden>,</span>
        <span className="van-map-footer__coord">{fmtCoord(cursorInfo.lng, 'E', 'W')}</span>
        <span className="van-map-footer__sep" aria-hidden>·</span>
        <span className="van-map-footer__zoom">z{cursorInfo.zoom.toFixed(1)}</span>
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
