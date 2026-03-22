/**
 * SkyTrain station name → Wikipedia article title.
 * Used to fetch thumbnail images from the Wikipedia REST API.
 */
export const STATION_WIKI_TITLE: Record<string, string> = {
  '22nd Street': '22nd_Street_station_(SkyTrain)',
  '29th Avenue': '29th_Avenue_station',
  Aberdeen: 'Aberdeen_station_(SkyTrain)',
  Braid: 'Braid_station',
  'Brentwood Town Centre': 'Brentwood_Town_Centre_station',
  Bridgeport: 'Bridgeport_station_(Vancouver)',
  'Broadway–City Hall': 'Broadway–City_Hall_station',
  Burquitlam: 'Burquitlam_station',
  Burrard: 'Burrard_station',
  Capstan: 'Capstan_station',
  Columbia: 'Columbia_station_(SkyTrain)',
  'Commercial–Broadway': 'Commercial–Broadway_station',
  'Coquitlam Central': 'Coquitlam_Central_station',
  Edmonds: 'Edmonds_station_(SkyTrain)',
  Gateway: 'Gateway_station_(SkyTrain)',
  Gilmore: 'Gilmore_station',
  Granville: 'Granville_station_(SkyTrain)',
  Holdom: 'Holdom_station',
  'Inlet Centre': 'Inlet_Centre_station',
  'Joyce–Collingwood': 'Joyce–Collingwood_station',
  'King Edward': 'King_Edward_station',
  'King George': 'King_George_station',
  'Lafarge Lake–Douglas': 'Lafarge_Lake–Douglas_station',
  'Lake City Way': 'Lake_City_Way_station',
  'Langara-49th Avenue': 'Langara–49th_Avenue_station',
  Lansdowne: 'Lansdowne_station_(SkyTrain)',
  Lincoln: 'Lincoln_station_(SkyTrain)',
  'Lougheed Town Centre': 'Lougheed_Town_Centre_station',
  'Main Street–Science World': 'Main_Street–Science_World_station',
  'Marine Drive': 'Marine_Drive_station',
  Metrotown: 'Metrotown_station',
  'Moody Centre': 'Moody_Centre_station',
  Nanaimo: 'Nanaimo_station',
  'New Westminster': 'New_Westminster_station',
  'Oakridge-41st Avenue': 'Oakridge–41st_Avenue_station',
  'Olympic Village': 'Olympic_Village_station',
  Patterson: 'Patterson_station',
  'Production Way–University': 'Production_Way–University_station',
  Renfrew: 'Renfrew_station',
  'Richmond–Brighouse': 'Richmond–Brighouse_station',
  'Royal Oak': 'Royal_Oak_station_(SkyTrain)',
  Rupert: 'Rupert_station',
  Sapperton: 'Sapperton_station',
  'Scott Road': 'Scott_Road_station',
  'Sea Island Centre': 'Sea_Island_Centre_station',
  'Sperling–Burnaby Lake': 'Sperling–Burnaby_Lake_station',
  'Stadium–Chinatown': 'Stadium–Chinatown_station',
  'Surrey Central': 'Surrey_Central_station',
  Templeton: 'Templeton_station',
  'VCC–Clark': 'VCC–Clark_station',
  'Vancouver City Centre': 'Vancouver_City_Centre_station',
  Waterfront: 'Waterfront_station_(Vancouver)',
  'YVR–Airport': 'YVR–Airport_station',
  'Yaletown–Roundhouse': 'Yaletown–Roundhouse_station',
}

const thumbCache = new Map<string, string | null>()

/**
 * Fetches a thumbnail URL for a station from the Wikipedia REST API.
 * Returns null if no image is available. Results are cached in memory.
 */
export async function fetchStationThumb(stationName: string): Promise<string | null> {
  if (thumbCache.has(stationName)) return thumbCache.get(stationName)!

  const title = STATION_WIKI_TITLE[stationName]
  if (!title) {
    thumbCache.set(stationName, null)
    return null
  }

  try {
    const resp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    )
    if (!resp.ok) {
      thumbCache.set(stationName, null)
      return null
    }
    const data = await resp.json()
    const url: string | null = data.thumbnail?.source ?? data.originalimage?.source ?? null
    thumbCache.set(stationName, url)
    return url
  } catch {
    thumbCache.set(stationName, null)
    return null
  }
}
