import { calculateRegionalScore, SCORING_VERSION } from './regional-score'
import type { Station } from './station-model'
import type { PopulationData } from './population-data'
import { getCountyIndex, type CountyIndex } from './region-geography'
import { US_STATES } from './us-states'
import { annualToDaily, trafficPerCapita, type TrafficData } from './traffic-data'
import registrations from '../data/ev-registrations-2025.json'
import { emptyPublicSupply, addPublicStation, emptyFilterSummary, addFilterStation } from './station-filters'

export const DATA_VERSION = 'station-snapshot-v2'
const nonTesla = new Set(['J1772COMBO','J1772','CHADEMO','J3271','NEMA515','NEMA520','NEMA1450'])
const tesla = new Set(['TESLA','NACS','J3400'])

export function emptySummary() {
    return {
        charger_count: 0, level1_count: 0, level2_count: 0, dcfast_count: 0,
        level1_ports: 0, level2_ports: 0, dcfast_ports: 0, total_ports: 0,
        tesla_count: 0, ccs_count: 0, j1772_count: 0, chademo_count: 0,
        tesla_ports: 0, ccs_ports: 0, j1772_ports: 0, chademo_ports: 0,
        unknown_port_station_count: 0, connector_ports_complete: true,
        filter_summary: emptyFilterSummary(), public_supply: emptyPublicSupply()
    }
}
export type ChargerSummary = ReturnType<typeof emptySummary>
export function addStation(summary: ChargerSummary, station: Station) {
    addFilterStation(summary.filter_summary, station)
    addPublicStation(summary.public_supply, station)
    summary.charger_count++
    for (const level of ['level1', 'level2', 'dcfast'] as const) {
        if (station[`${level}_ports`] > 0) summary[`${level}_count`]++
        summary[`${level}_ports`] += station[`${level}_ports`]
    }
    summary.total_ports += station.num_ports ?? 0
    if (!station.port_counts_known) summary.unknown_port_station_count++
    const hasTesla = station.ev_connector_types.some(type => tesla.has(type))
    const hasOther = station.ev_connector_types.some(type => nonTesla.has(type))
    if (hasTesla) summary.tesla_count++
    if (hasOther) summary.ccs_count++ // Historical field: sites with any non-Tesla connector.
    if (station.ev_connector_types.includes('J1772')) summary.j1772_count++
    if (station.ev_connector_types.includes('CHADEMO')) summary.chademo_count++
    if (station.charging_units_complete) {
        for (const unit of station.charging_units) {
            summary.tesla_ports += Math.min(unit.ports, Object.entries(unit.connectors).reduce((n, [type, ports]) => n + (tesla.has(type) ? ports : 0), 0))
            summary.ccs_ports += Math.min(unit.ports, Object.entries(unit.connectors).reduce((n, [type, ports]) => n + (nonTesla.has(type) ? ports : 0), 0))
            summary.j1772_ports += Math.min(unit.ports, unit.connectors.J1772 ?? 0)
            summary.chademo_ports += Math.min(unit.ports, unit.connectors.CHADEMO ?? 0)
        }
    } else {
        // Do not allocate all mixed-site ports to every connector family.
        if (station.ev_connector_types.length === 1 && station.port_counts_known) {
            const ports = station.num_ports ?? 0
            if (hasTesla) summary.tesla_ports += ports
            if (hasOther) summary.ccs_ports += ports
            if (station.ev_connector_types[0] === 'J1772') summary.j1772_ports += ports
            if (station.ev_connector_types[0] === 'CHADEMO') summary.chademo_ports += ports
        } else summary.connector_ports_complete = false
    }
}

export function regionalScore(summary: import('./regional-score').ScoreInputs, population: number | null): number | null {
    return calculateRegionalScore(summary, population).score
}

interface Region {
    summary: ChargerSummary
    reference?: Record<string, unknown>
    lat: number; lng: number
    demand?: import('./charging-demand').DemandData
    sumLat: number; sumLng: number
    state: string; code: string; name: string
}
export interface References {
    states: Record<string, unknown>[]; counties: Record<string, unknown>[]; zips: Record<string, unknown>[]
}
function numeric(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null }
function population(code: string, values: Map<string, number>, reference: Region['reference'], source: string) {
    const census = values.get(code)
    if (census !== undefined) return { population: census, population_source: source }
    const old = numeric(reference?.population)
    // Pre-upgrade population may be an unmarked estimate. Preserve it with explicit provenance.
    const priorSource = reference?.population_source
    const provenance = typeof priorSource === 'string' && !['unknown', 'previous_unverified'].includes(priorSource)
        ? priorSource.startsWith('previous_') ? priorSource : `previous_${priorSource}` : 'previous_unverified'
    return { population: old != null && old > 0 ? old : null, population_source: old != null && old > 0 ? provenance : 'unknown' }
}
function fields(region: Region, people: ReturnType<typeof population>, now: string) {
    const summary = region.summary
    return {
        ...summary, ...people,
        demand_data: region.demand ?? null,
        traffic_data: region.reference?.traffic_data ?? null,
        center_lat: numeric(region.reference?.center_lat) ?? region.lat,
        center_lng: numeric(region.reference?.center_lng) ?? region.lng,
        fast_charger_count: summary.dcfast_count,
        ev_infrastructure_score: regionalScore({ ...summary, demand_data: region.demand, traffic_data: region.reference?.traffic_data as TrafficData | undefined }, people.population),
        need_score: people.population == null ? null : Math.max(0, Math.min(100, people.population / 10000 - summary.charger_count * 5)),
        data_version: DATA_VERSION, scoring_version: SCORING_VERSION, updated_at: now
    }
}
function region(code: string, name: string, state: string, lat: number, lng: number, reference?: Region['reference']): Region {
    return { code, name, state, lat, lng, summary: emptySummary(), sumLat: 0, sumLng: 0, reference }
}

/** A single station pass supplies every level, including zero-charger regions. */
export function buildRegionalSnapshot(stations: Station[], people: PopulationData, refs: References, index: CountyIndex = getCountyIndex(), now = new Date().toISOString()) {
    const stateRefs = new Map(refs.states.map(row => [String(row.state_name), row]))
    const countyRefs = new Map(refs.counties.map(row => [String(row.county_fips || `${row.state}:${row.county_name}`), row]))
    const stateRegions = new Map(US_STATES.map(item => [item.code as string, region(item.code, item.name, item.code, item.lat, item.lng, stateRefs.get(item.name))]))
    const counties = new Map(index.counties.map(item => [item.fips, region(item.fips, item.name, item.state, item.lat, item.lng,
        countyRefs.get(item.fips) ?? countyRefs.get(`${item.state}:${item.name}`))]))
    const stationStateByZip = new Map<string, Map<string, number>>()
    for (const station of stations) {
        if (!station.zip) continue
        if (!stationStateByZip.has(station.zip)) stationStateByZip.set(station.zip, new Map())
        const votes = stationStateByZip.get(station.zip)!
        votes.set(station.state, (votes.get(station.state) ?? 0) + 1)
    }
    const zips = new Map<string, Region>()
    for (const reference of refs.zips) {
        if (typeof reference.zip_code !== 'string' || !/^\d{5}$/.test(reference.zip_code)) continue
        const validState = US_STATES.some(state => state.code === reference.state)
        const geographicState = typeof reference.center_lng === 'number' && typeof reference.center_lat === 'number'
            ? index.locatePoint(reference.center_lng, reference.center_lat)?.state : undefined
        const stationState = [...(stationStateByZip.get(reference.zip_code) ?? [])].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
        const resolvedState = validState ? String(reference.state) : geographicState ?? stationState ?? String(reference.state)
        zips.set(reference.zip_code, region(reference.zip_code, reference.zip_code, resolvedState,
            numeric(reference.center_lat) ?? 0, numeric(reference.center_lng) ?? 0, reference))
    }
    const stateDemand = new Map<string, import('./charging-demand').DemandData>()
    const nationalPopulation = US_STATES.reduce((total, state) => {
        const ref = stateRefs.get(state.name)
        const fips = index.counties.find(c => c.state === state.code)?.fips.slice(0, 2) ?? ''
        return total + (population(fips, people.states, ref, people.source).population ?? 0)
    }, 0)
    // Canonical ordering prevents row/UUID order from changing floating-point metadata.
    const nationalDailyVmt = US_STATES.reduce((total, state) => {
        const traffic = stateRefs.get(state.name)?.traffic_data as TrafficData | undefined
        return total + (traffic && traffic.county_count === traffic.expected_county_count ? annualToDaily(traffic.annual_vmt, traffic.year) : 0)
    }, 0)
    // Require national coverage before using national road intensity as a baseline.
    const completeTraffic = stateRefs.size === 51 && [...stateRefs.values()].every(ref => {
        const t = ref.traffic_data as TrafficData | undefined
        return t && t.county_count === t.expected_county_count
    })
    for (const state of US_STATES) {
        const ref = stateRefs.get(state.name)
        const fips = index.counties.find(c => c.state === state.code)?.fips.slice(0, 2) ?? ''
        const pop = population(fips, people.states, ref, people.source).population
        const registration = registrations.states.find(r => r.state_name === state.name)
        if (!pop || !registration) continue
        const demand: import('./charging-demand').DemandData = {
            source: registrations.source, source_year: registrations.year, state_code: state.code,
            bev: registration.bev, phev: registration.phev, state_population: pop,
            national_plugin_count: registrations.national_plugin_count, allocation: 'population_estimate',
            state_road_miles_per_capita: trafficPerCapita(ref?.traffic_data as TrafficData | undefined, pop),
            national_road_miles_per_capita: completeTraffic && nationalPopulation > 0 ? nationalDailyVmt / nationalPopulation : null
        }
        stateDemand.set(state.code, demand)
        stateRegions.get(state.code)!.demand = { ...demand, allocation: 'state_registration' }
    }
    for (const county of counties.values()) county.demand = stateDemand.get(county.state)
    for (const zip of zips.values()) zip.demand = stateDemand.get(zip.state)
    let unassignedCounties = 0, missingZip = 0
    for (const station of stations) {
        const stateRegion = stateRegions.get(station.state)
        if (!stateRegion) throw new Error(`Unsupported snapshot state: ${station.state}`)
        addStation(stateRegion.summary, station)
        const county = index.locate(station.state, station.longitude, station.latitude)
        if (county) addStation(counties.get(county.fips)!.summary, station)
        else unassignedCounties++
        if (!station.zip) { missingZip++; continue }
        if (!zips.has(station.zip)) zips.set(station.zip, region(station.zip, station.zip, station.state, station.latitude, station.longitude))
        const zip = zips.get(station.zip)!
        zip.demand = stateDemand.get(zip.state)
        addStation(zip.summary, station)
        zip.sumLat += station.latitude; zip.sumLng += station.longitude
    }
    const states = [...stateRegions.values()].map(item => {
        // Census state FIPS are supplied by the geography index.
        const fips = index.counties.find(county => county.state === item.state)?.fips.slice(0, 2) ?? ''
        return { state_name: item.name, ...fields(item, population(fips, people.states, item.reference, people.source), now), zoom_range: '0-4' }
    })
    const countyRows = [...counties.values()].map(item => ({
        county_name: item.name, county_fips: item.code, state: item.state,
        ...fields(item, population(item.code, people.counties, item.reference, people.source), now),
        // Preserve traffic observations while rebuilding charger counts.
        daily_vmt: item.reference?.traffic_data ? annualToDaily((item.reference.traffic_data as TrafficData).annual_vmt, (item.reference.traffic_data as TrafficData).year) : numeric(item.reference?.daily_vmt),
        vmt_per_capita: item.reference?.traffic_data ? trafficPerCapita(item.reference.traffic_data as TrafficData, population(item.code, people.counties, item.reference, people.source).population) : numeric(item.reference?.vmt_per_capita),
        traffic_score: numeric(item.reference?.traffic_score), zoom_range: '5-8'
    }))
    const zipRows = [...zips.values()].map(item => {
        if (!item.reference && item.summary.charger_count) {
            item.lat = item.sumLat / item.summary.charger_count; item.lng = item.sumLng / item.summary.charger_count
        }
        return { zip_code: item.code, state: item.state, ...fields(item, population(item.code, people.zips, item.reference, people.source), now), zoom_range: '9-11' }
    })
    return {
        states, counties: countyRows, zips: zipRows,
        diagnostics: { unassigned_county_stations: unassignedCounties, stations_without_zip: missingZip,
            county_geometry: 'us-atlas@3/counties-10m (Census 2017)', population_failures: people.failures,
            unknown_population_regions: [...states, ...countyRows, ...zipRows].filter(row => row.population == null).length }
    }
}
