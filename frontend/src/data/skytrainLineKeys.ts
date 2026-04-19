import type { FeatureCollection } from 'geojson'
import type { ExpressionSpecification } from 'maplibre-gl'

/** Logical line grouping for map styling (interchanges get their own keys). */
export type SkytrainLineKey = 'expo' | 'millennium' | 'canada' | 'expo-millennium' | 'expo-canada'

/** Every `lineKey` assigned by `enrichSkytrainNodes` — use when the SkyTrain layer is on without line sub-filters. */
export const ALL_SKYTRAIN_LINE_KEYS: readonly SkytrainLineKey[] = [
  'expo',
  'millennium',
  'canada',
  'expo-millennium',
  'expo-canada',
]

/**
 * Station → line key (TransLink network as of Evergreen + Capstan).
 * Interchanges: Commercial–Broadway, Lougheed, Production Way (Expo + Millennium); Waterfront (Expo + Canada).
 */
const STATION_LINE_KEY: Record<string, SkytrainLineKey> = {
  '22nd Street': 'expo',
  '29th Avenue': 'expo',
  Aberdeen: 'canada',
  Braid: 'expo',
  'Brentwood Town Centre': 'millennium',
  Bridgeport: 'canada',
  'Broadway–City Hall': 'canada',
  Burquitlam: 'millennium',
  Burrard: 'expo',
  Capstan: 'canada',
  Columbia: 'expo',
  'Commercial–Broadway': 'expo-millennium',
  'Coquitlam Central': 'millennium',
  Edmonds: 'expo',
  Gateway: 'expo',
  Gilmore: 'millennium',
  Granville: 'expo',
  Holdom: 'millennium',
  'Inlet Centre': 'millennium',
  'Joyce–Collingwood': 'expo',
  'King Edward': 'canada',
  'King George': 'expo',
  'Lafarge Lake–Douglas': 'millennium',
  'Lake City Way': 'millennium',
  'Langara-49th Avenue': 'canada',
  Lansdowne: 'canada',
  Lincoln: 'millennium',
  'Lougheed Town Centre': 'expo-millennium',
  'Main Street–Science World': 'expo',
  'Marine Drive': 'canada',
  Metrotown: 'expo',
  'Moody Centre': 'millennium',
  Nanaimo: 'expo',
  'New Westminster': 'expo',
  'Oakridge-41st Avenue': 'canada',
  'Olympic Village': 'canada',
  Patterson: 'expo',
  'Production Way–University': 'expo-millennium',
  Renfrew: 'millennium',
  'Richmond–Brighouse': 'canada',
  'Royal Oak': 'expo',
  Rupert: 'millennium',
  Sapperton: 'expo',
  'Scott Road': 'expo',
  'Sea Island Centre': 'canada',
  'Sperling–Burnaby Lake': 'millennium',
  'Stadium–Chinatown': 'expo',
  'Surrey Central': 'expo',
  Templeton: 'canada',
  'VCC–Clark': 'millennium',
  'Vancouver City Centre': 'canada',
  Waterfront: 'expo-canada',
  'YVR–Airport': 'canada',
  'Yaletown–Roundhouse': 'canada',
}

function lineLabel(key: SkytrainLineKey): string {
  switch (key) {
    case 'expo':
      return 'Expo Line'
    case 'millennium':
      return 'Millennium Line'
    case 'canada':
      return 'Canada Line'
    case 'expo-millennium':
      return 'Expo · Millennium'
    case 'expo-canada':
      return 'Expo · Canada Line'
    default:
      return 'SkyTrain'
  }
}

/** Dark-theme palette: distinct on CARTO Dark Matter, readable vs cyan strategic nodes. */
export const SKYTRAIN_LINE_COLORS: Record<SkytrainLineKey, string> = {
  expo: '#5c9dff',
  millennium: '#f5e642',
  canada: '#2cdbb8',
  'expo-millennium': '#5c9dff',  // interchange stations → show as Expo blue
  'expo-canada': '#5c9dff',      // interchange stations → show as Expo blue
}

/** Order for UI legend — interchange combos omitted, they show as Expo colour. */
export const SKYTRAIN_LEGEND: { key: SkytrainLineKey; shortLabel: string }[] = [
  { key: 'expo', shortLabel: 'Expo' },
  { key: 'millennium', shortLabel: 'Millennium' },
  { key: 'canada', shortLabel: 'Canada' },
]

export function skytrainCircleColorExpr(): ExpressionSpecification {
  return [
    'match',
    ['get', 'lineKey'],
    'expo',
    SKYTRAIN_LINE_COLORS.expo,
    'millennium',
    SKYTRAIN_LINE_COLORS.millennium,
    'canada',
    SKYTRAIN_LINE_COLORS.canada,
    'expo-millennium',
    SKYTRAIN_LINE_COLORS['expo-millennium'],
    'expo-canada',
    SKYTRAIN_LINE_COLORS['expo-canada'],
    '#94a3b8',
  ]
}

/** Slightly darker rim so dots stay crisp on the basemap. */
export function skytrainStrokeColorExpr(): ExpressionSpecification {
  return [
    'match',
    ['get', 'lineKey'],
    'expo',
    '#0c1830',
    'millennium',
    '#1a1408',
    'canada',
    '#061f1c',
    'expo-millennium',
    '#140a24',
    'expo-canada',
    '#061a1e',
    '#080d14',
  ]
}

export function enrichSkytrainNodes(fc: FeatureCollection): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: fc.features.map((f) => {
      const name = String(f.properties?.name ?? '')
      const lineKey = STATION_LINE_KEY[name]
      if (!lineKey) {
        console.warn(`[skytrain] missing line key for station: ${name}`)
      }
      const key: SkytrainLineKey = lineKey ?? 'expo'
      return {
        ...f,
        properties: {
          ...f.properties,
          lineKey: key,
          lens: `SkyTrain · ${lineLabel(key)}`,
        },
      }
    }),
  }
}
