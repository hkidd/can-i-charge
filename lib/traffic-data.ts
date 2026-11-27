/** EPA FF10 annual road-traffic activity, not a direct measure of EV charging demand. */
export const TRAFFIC_SHA256 = 'cc92bda364288128b01022ec4c052db7513720a157ec73075cf44fd126213c85'
export const TRAFFIC_YEAR = 2023
export const TRAFFIC_SOURCE = 'https://gaftp.epa.gov/Air/nei/2023/doc/supporting_data/onroad/2023NEI_onroad_activity_final_20251010/VMT_2023NEI_20250923_24sep2025_v0.csv'
export interface TrafficData {
    source: string
    source_sha256?: string
    year: number
    annual_vmt: number
    retrieved_at: string
    scope: 'county' | 'state'
    county_count: number
    expected_county_count: number
}
export function annualToDaily(annual: number, year: number): number {
    if (!Number.isFinite(annual) || annual < 0 || !Number.isInteger(year) || year < 1900) throw new Error('Invalid annual traffic observation')
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    return annual / (leap ? 366 : 365)
}
export function trafficPerCapita(traffic: TrafficData | null | undefined, population: number | null | undefined): number | null {
    if (!traffic || !population || population <= 0 || !Number.isFinite(population) || traffic.county_count !== traffic.expected_county_count) return null
    return annualToDaily(traffic.annual_vmt, traffic.year) / population
}
export function csvFields(line: string): string[] {
    const fields: string[] = []; let field = ''; let quoted = false
    for (let i = 0; i < line.length; i++) {
        const c = line[i]
        if (c === '"') {
            if (quoted && line[i + 1] === '"') { field += '"'; i++ }
            else quoted = !quoted
        } else if (c === ',' && !quoted) { fields.push(field); field = '' }
        else field += c
    }
    if (quoted) throw new Error('Unterminated quoted traffic field')
    fields.push(field)
    return fields
}
export async function parseAnnualTraffic(lines: AsyncIterable<string>) {
    const counties = new Map<string, number>(); const keys = new Set<string>()
    let header: string[] | undefined; let rows = 0
    for await (const raw of lines) {
        const line = raw.trim()
        if (!line) continue
        if (line.startsWith('#')) {
            if (line.startsWith('# country_cd,')) header = csvFields(line.slice(2))
            continue
        }
        if (!header || header[1] !== 'region_cd' || header[5] !== 'scc' || header[9] !== 'ann_parm_value' || header[10] !== 'calc_year') throw new Error('Unexpected traffic schema')
        const fields = csvFields(line)
        if (fields.length !== header.length || fields[0] !== 'US' || !/^\d{5}$/.test(fields[1]) || fields[8] !== 'VMT' || fields[10] !== String(TRAFFIC_YEAR)) throw new Error('Unexpected traffic row')
        const value = Number(fields[9])
        if (!fields[9] || !Number.isFinite(value) || value < 0) throw new Error('Invalid annual VMT')
        const key = fields.slice(0, 6).join('|')
        if (keys.has(key)) throw new Error('Duplicate traffic activity row')
        keys.add(key); rows++
        counties.set(fields[1], (counties.get(fields[1]) ?? 0) + value)
    }
    if (!rows) throw new Error('Empty traffic dataset')
    return { counties, rows }
}

/** The application uses 2017 county boundaries. These two successor areas
 * exactly partition former Valdez-Cordova (Census county-change documentation). */
export function trafficForCounty(counties: Map<string, number>, fips: string): number | undefined {
    if (counties.has(fips)) return counties.get(fips)
    if (fips === '02261' && counties.has('02063') && counties.has('02066')) return counties.get('02063')! + counties.get('02066')!
    return undefined
}
