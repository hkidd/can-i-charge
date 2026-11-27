import { afterEach, expect, it, vi } from 'vitest'
import { fetchPopulationData } from '@/lib/population-data'
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
it('fetches populations in three bulk requests and preserves leading-zero codes', async () => {
    const fetch = vi.fn(async (input: URL) => {
        const geography = input.searchParams.get('for')
        const rows = geography === 'state:*' ? [['B01003_001E','state'],['5000000','08']] :
            geography === 'county:*' ? [['B01003_001E','state','county'],['10000','08','001']] :
            [['B01003_001E','zip code tabulation area'],['12000','00123'],[null,'00124'],['-666666666','00125']]
        return Response.json(rows)
    })
    vi.stubGlobal('fetch', fetch)
    vi.stubEnv('CENSUS_API_KEY', undefined)
    const result = await fetchPopulationData(new AbortController().signal)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(result.counties.get('08001')).toBe(10000)
    expect(result.zips.get('00123')).toBe(12000)
    expect(result.zips.has('00124')).toBe(false)
    expect(result.zips.has('00125')).toBe(false)
    expect(result.failures).toEqual([])
})
it('reports a failed dataset without generating substitute populations', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Unavailable', { status: 503 })))
    const result = await fetchPopulationData(new AbortController().signal)
    expect(result.states.size + result.counties.size + result.zips.size).toBe(0)
    expect(result.failures).toEqual(['states','counties','zips'])
})
