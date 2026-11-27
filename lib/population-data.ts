/** Bulk ACS population lookups replace thousands of individual ZIP/county requests. */
export interface PopulationData {
    states: Map<string, number>
    counties: Map<string, number>
    zips: Map<string, number>
    source: string
    failures: string[]
}
export const CENSUS_YEAR = 2024

function populationRows(input: unknown, fields: string[]): Map<string, number> {
    if (!Array.isArray(input) || !Array.isArray(input[0])) throw new Error('Invalid Census data')
    const header = input[0] as unknown[]
    const countIndex = header.indexOf('B01003_001E')
    const keys = fields.map(field => header.indexOf(field))
    if (countIndex < 0 || keys.includes(-1)) throw new Error('Missing Census population columns')
    const result = new Map<string, number>()
    for (const row of input.slice(1)) {
        if (!Array.isArray(row)) continue
        const rawCount: unknown = row[countIndex]
        if (typeof rawCount !== 'string' || !/^\d+$/.test(rawCount)) continue
        const count = Number(rawCount)
        const code = keys.map(index => row[index]).join('')
        if (Number.isSafeInteger(count) && count >= 0 && code) result.set(code, count)
    }
    if (!result.size) throw new Error('Census population dataset was empty')
    return result
}

export async function fetchPopulationData(signal: AbortSignal): Promise<PopulationData> {
    const requests = [
        { name: 'states', geography: 'state:*', fields: ['state'] },
        { name: 'counties', geography: 'county:*', fields: ['state', 'county'] },
        { name: 'zips', geography: 'zip code tabulation area:*', fields: ['zip code tabulation area'] }
    ] as const
    const results = await Promise.allSettled(requests.map(async request => {
        const url = new URL(`https://api.census.gov/data/${CENSUS_YEAR}/acs/acs5`)
        url.searchParams.set('get', 'B01003_001E')
        url.searchParams.set('for', request.geography)
        if (request.name === 'counties') url.searchParams.set('in', 'state:*')
        if (process.env.CENSUS_API_KEY) url.searchParams.set('key', process.env.CENSUS_API_KEY)
        const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20000)]), cache: 'no-store' })
        if (!response.ok) throw new Error(`Census HTTP ${response.status}`)
        return populationRows(await response.json(), [...request.fields])
    }))
    return {
        states: results[0].status === 'fulfilled' ? results[0].value : new Map(),
        counties: results[1].status === 'fulfilled' ? results[1].value : new Map(),
        zips: results[2].status === 'fulfilled' ? results[2].value : new Map(),
        source: `census_acs_${CENSUS_YEAR}`,
        failures: results.flatMap((result, index) => result.status === 'rejected' ? [requests[index].name] : [])
    }
}
