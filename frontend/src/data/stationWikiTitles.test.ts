import { fetchStationThumb, NODE_WIKI_TITLE, STATION_WIKI_TITLE } from './stationWikiTitles'

describe('stationWikiTitles maps', () => {
  it('maps Waterfront to a Vancouver-specific Wikipedia title', () => {
    expect(STATION_WIKI_TITLE.Waterfront).toBe('Waterfront_station_(Vancouver)')
  })

  it('covers all strategic node display names', () => {
    expect(NODE_WIKI_TITLE['Central Business District']).toBe('Downtown_Vancouver')
    expect(NODE_WIKI_TITLE['Granville Island / False Creek']).toBe('Granville_Island')
    expect(NODE_WIKI_TITLE.Kitsilano).toBe('Kitsilano')
    expect(NODE_WIKI_TITLE['Mount Pleasant']).toBe('Mount_Pleasant,_Vancouver')
    expect(NODE_WIKI_TITLE['Commercial–East Hastings']).toBe('Commercial_Drive_(Vancouver)')
  })
})

describe('fetchStationThumb', () => {
  it('returns thumbnail URL from Wikipedia summary API', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        thumbnail: { source: 'https://upload.wikimedia.org/example-thumb.jpg' },
      }),
    }) as unknown as typeof fetch

    const url = await fetchStationThumb('Metrotown')
    expect(url).toBe('https://upload.wikimedia.org/example-thumb.jpg')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('Metrotown_station'),
    )
  })

  it('returns null when there is no Wikipedia title mapping (no network)', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch
    const url = await fetchStationThumb('Totally Unknown Station Name 12345')
    expect(url).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns null when the API responds with an error', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
    }) as unknown as typeof fetch

    const url = await fetchStationThumb('Nanaimo')
    expect(url).toBeNull()
    expect(fetch).toHaveBeenCalled()
  })
})
