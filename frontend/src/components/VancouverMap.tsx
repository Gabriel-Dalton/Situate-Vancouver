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
import type { RouteFindResult } from '../services/routeService'
import MapBasemapToolbar from './MapBasemapToolbar'
import MapInsightToolbar from './MapInsightToolbar'
import { useIncidents } from '../hooks/useIncidents'
import './VancouverMap.css'

const SEVERITY_COLORS: Record<AiQueryResponse['severity'], string> = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#ff3b3b',
}

export type { InsightLayerState } from '../types/insightLayers'

const NODE_LAYERS = ['strategic-nodes-core', 'skytrain-nodes-core'] as const
const LENS_LAYER_IDS = ['lens-overlay-glow', 'lens-overlay-line'] as const

const INITIAL_BASEMAP: BasemapId = 'dark'
const VAN_CENTRE: [number, number] = [-123.1207, 49.2827]
const TOMTOM_KEY = import.meta.env.VITE_TOMTOM_API_KEY as string | undefined

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
  ] as const
  for (const id of ids) {
    if (!map.getLayer(id)) continue
    if (id.startsWith('skytrain')) {
      map.setLayoutProperty(id, 'visibility', vis(layers.skytrainNodes))
    } else if (id.startsWith('strategic')) {
      map.setLayoutProperty(id, 'visibility', vis(layers.strategicNodes))
    } else if (id.startsWith('incident')) {
      map.setLayoutProperty(id, 'visibility', vis(layers.incidentMarker))
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

type Props = {
  layers: InsightLayerState
  onToggleLayer: (key: InsightLayerKey) => void
  lens: MobilityLens
  incident?: AiQueryResponse | null
  focusLocation?: FocusLocation
  routeResult?: RouteFindResult | null
  selectedRouteIndex?: number
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

/** Decode a Google-format encoded polyline (precision 5) to [lng, lat] pairs for GeoJSON. */
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = []
  let index = 0
  let lat = 0
  let lng = 0
  while (index < encoded.length) {
    let b: number
    let shift = 0
    let result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    coords.push([lng / 1e5, lat / 1e5])
  }
  return coords
}

const ROUTE_COLORS = ['#00d4ff', '#a78bfa', '#34d399']

export default function VancouverMap({
  layers,
  onToggleLayer,
  lens,
  incident,
  focusLocation,
  routeResult,
  selectedRouteIndex = 0,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const styleReadyRef = useRef(false)
  const layersRef = useRef(layers)
  const lensRef = useRef(lens)
  const incidentRef = useRef(incident ?? null)
  const interactionsBoundRef = useRef(false)
  const focusMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [basemap, setBasemap] = useState<BasemapId>(INITIAL_BASEMAP)
  const [cursorInfo, setCursorInfo] = useState({ lat: VAN_CENTRE[1], lng: VAN_CENTRE[0], zoom: 11.35 })

  // Fetch all active incidents from DB — refresh every 60s
  const { incidents: dbIncidents } = useIncidents({ status: 'active' })

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
        [-123.6, 49.0],
        [-122.5, 49.6],
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
      const lensText = String(f.properties?.lens ?? '')
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

        const popup = new maplibregl.Popup({ maxWidth: '300px', className: 'van-popup', offset: 12 })
          .setLngLat(coords)
          .setHTML(
            accentBar +
              shimmer +
              `<div class="van-popup__title">${escapeHtml(name)}</div>` +
              `<div class="van-popup__body">${escapeHtml(lensText)}</div>`,
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
      applyInsightLayers(map, layersRef.current)
      if (incidentRef.current) installIncidentLayer(map, incidentRef.current)
      styleReadyRef.current = true

      // TomTom traffic flow tile overlay
      if (TOMTOM_KEY) {
        map.addSource('tomtom-traffic', {
          type: 'raster',
          tiles: [
            `https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${TOMTOM_KEY}&tileSize=256`,
          ],
          tileSize: 256,
        })
        map.addLayer({
          id: 'traffic-flow',
          type: 'raster',
          source: 'tomtom-traffic',
          paint: { 'raster-opacity': 0.35 },
        })
      }

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

  // Render DB incidents as a GeoJSON layer on the map
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return

    const features: GeoJSON.Feature<GeoJSON.Point>[] = dbIncidents
      .filter(inc => inc.lat != null && inc.lng != null)
      .map(inc => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [inc.lng!, inc.lat!] },
        properties: {
          id: inc.id,
          title: inc.title,
          location: inc.location,
          severity: inc.severity,
          incident_type: inc.incident_type,
          description: inc.description,
        },
      }))

    const geojson: GeoJSON.FeatureCollection<GeoJSON.Point> = {
      type: 'FeatureCollection',
      features,
    }

    const SRC = 'db-incidents'
    const LAYER_GLOW = 'db-incidents-glow'
    const LAYER_CORE = 'db-incidents-core'

    if (map.getSource(SRC)) {
      ;(map.getSource(SRC) as maplibregl.GeoJSONSource).setData(geojson)
      return
    }

    map.addSource(SRC, { type: 'geojson', data: geojson })

    const typeColor: maplibregl.ExpressionSpecification = ['match', ['get', 'incident_type'],
      'construction',    '#fb923c',  // amber-orange
      'traffic',         '#60a5fa',  // blue
      'accident',        '#f87171',  // red
      'obstruction',     '#facc15',  // yellow
      'weather',         '#a78bfa',  // violet
      'emergency',       '#ff3b3b',  // bright red
      'natural_disaster','#c084fc',  // purple
      /* general */      '#94a3b8',  // slate
    ]

    map.addLayer({
      id: LAYER_GLOW,
      type: 'circle',
      source: SRC,
      paint: {
        'circle-radius': 8,
        'circle-color': typeColor,
        'circle-opacity': 0.18,
        'circle-blur': 1,
      },
    })

    map.addLayer({
      id: LAYER_CORE,
      type: 'circle',
      source: SRC,
      paint: {
        'circle-radius': 3.5,
        'circle-color': typeColor,
        'circle-stroke-width': 1,
        'circle-stroke-color': 'rgba(0,0,0,0.5)',
        'circle-opacity': 0.88,
      },
    })

    map.on('click', LAYER_CORE, (e) => {
      const props = e.features?.[0]?.properties
      if (!props) return
      new maplibregl.Popup({ maxWidth: '300px', className: 'van-popup', offset: 14 })
        .setLngLat(e.lngLat)
        .setHTML(
          `<div class="van-popup__title">${escapeHtml(props.location)}</div>` +
          `<div class="van-popup__body">${escapeHtml(props.description)}</div>` +
          `<div class="van-popup__body" style="margin-top:4px;opacity:0.7;font-size:0.78em">` +
          `${escapeHtml(props.incident_type)} · Severity: ${escapeHtml(props.severity)}</div>`
        )
        .addTo(map)
    })

    map.on('mouseenter', LAYER_CORE, () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', LAYER_CORE, () => { map.getCanvas().style.cursor = '' })
  }, [dbIncidents])

  // Render route polylines from ORS result
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReadyRef.current) return

    // Remove previous route layers/sources
    for (let i = 0; i < 3; i++) {
      if (map.getLayer(`route-line-${i}`)) map.removeLayer(`route-line-${i}`)
      if (map.getSource(`route-${i}`)) map.removeSource(`route-${i}`)
    }
    if (map.getLayer('route-endpoints')) map.removeLayer('route-endpoints')
    if (map.getSource('route-endpoints-src')) map.removeSource('route-endpoints-src')

    if (!routeResult || routeResult.routes.length === 0) return

    // Add each route as a line, selected route on top and brighter
    routeResult.routes.forEach((route, i) => {
      const coords = decodePolyline(route.geometry)
      const isSelected = i === selectedRouteIndex
      const color = ROUTE_COLORS[i % ROUTE_COLORS.length]

      map.addSource(`route-${i}`, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        },
      })
      map.addLayer({
        id: `route-line-${i}`,
        type: 'line',
        source: `route-${i}`,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': color,
          'line-width': isSelected ? 4.5 : 2.5,
          'line-opacity': isSelected ? 0.92 : 0.4,
        },
      })
    })

    // Re-order so selected route is drawn last (on top)
    const selectedId = `route-line-${selectedRouteIndex}`
    if (map.getLayer(selectedId)) map.moveLayer(selectedId)

    // Origin + destination endpoint markers
    const { origin_lng, origin_lat, dest_lng, dest_lat } = routeResult
    map.addSource('route-endpoints-src', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [origin_lng, origin_lat] },
            properties: { role: 'origin' },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [dest_lng, dest_lat] },
            properties: { role: 'destination' },
          },
        ],
      },
    })
    map.addLayer({
      id: 'route-endpoints',
      type: 'circle',
      source: 'route-endpoints-src',
      paint: {
        'circle-radius': 7,
        'circle-color': ['match', ['get', 'role'], 'origin', '#00d4ff', '#a78bfa'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.95,
      },
    })

    // Fit map to the selected route
    const selectedCoords = decodePolyline(routeResult.routes[selectedRouteIndex]?.geometry ?? routeResult.routes[0].geometry)
    const lngs = selectedCoords.map(([lng]) => lng)
    const lats = selectedCoords.map(([, lat]) => lat)
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 80, duration: 900 },
    )
  }, [routeResult, selectedRouteIndex])

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
