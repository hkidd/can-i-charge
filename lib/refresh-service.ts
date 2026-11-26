import { fetchStationSnapshot } from './station-feed'
import { RefreshStore, RefreshError, type RefreshRun } from './refresh-store'
import { compareStations } from './change-detector'
import { fetchPopulationData } from './population-data'
import { buildRegionalSnapshot } from './region-aggregation'

function summarize(run: RefreshRun) {
    return {
        success: true, run_id: run.id, status: run.status, swap_performed: run.status === 'published',
        stations_inserted: run.station_count,
        states_processed: run.state_count ?? 0, counties_processed: run.county_count ?? 0,
        zips_processed: run.zip_count ?? 0, diagnostics: run.diagnostics
    }
}
async function recordFailure(store: RefreshStore, id: string, error: unknown) {
    try { await store.fail(id, error) }
    catch (failure) { console.error('Could not record refresh failure:', failure instanceof Error ? failure.message : 'Unknown error') }
}
export async function stageStationRefresh(signal: AbortSignal = AbortSignal.timeout(240000)) {
    const feed = await fetchStationSnapshot(signal)
    const store = new RefreshStore(signal)
    const run = await store.begin(feed.stations.length)
    try {
        await store.write(run.id, 'charging_stations', feed.stations)
        const staged = await store.staged(run.id)
        return { ...summarize(staged), stations_fetched: feed.received, stations_rejected: feed.rejected }
    } catch (error) {
        await recordFailure(store, run.id, error)
        throw error
    }
}

export async function publishStagedRefresh(runId?: string, signal: AbortSignal = AbortSignal.timeout(240000)) {
    const store = new RefreshStore(signal)
    const run = await store.claim(runId)
    if (run.status === 'published') return summarize(run)
    try {
        // A publication retry can reuse a previously validated snapshot.
        if (run.status === 'ready') return summarize(await store.publish(run.id))
        const [current, previous, stateRefs, countyRefs, zipRefs, people] = await Promise.all([
            store.stations(run.id), store.stations(),
            store.reference('state_level_data'), store.reference('county_level_data'), store.reference('zip_level_data'),
            fetchPopulationData(signal)
        ])
        if (current.length !== run.station_count) throw new RefreshError('Incomplete staged station snapshot')
        const changes = compareStations(current, previous)
        const snapshot = buildRegionalSnapshot(current, people, { states: stateRefs, counties: countyRefs, zips: zipRefs })
        if (snapshot.diagnostics.unassigned_county_stations > Math.max(1, current.length * 0.01)) {
            throw new RefreshError('Too many stations could not be assigned to county boundaries')
        }
        await store.write(run.id, 'state_level_data', snapshot.states)
        await store.write(run.id, 'county_level_data', snapshot.counties)
        await store.write(run.id, 'zip_level_data', snapshot.zips)
        const counts = { states: snapshot.states.length, counties: snapshot.counties.length, zips: snapshot.zips.length }
        await store.ready(run.id, counts, {
            ...snapshot.diagnostics,
            changes: { added: changes.added, removed: changes.removed, modified: changes.modified,
                total_changes: changes.total_changes, states: [...changes.states], counties: [...changes.counties], zips: [...changes.zips] }
        })
        return summarize(await store.publish(run.id))
    } catch (error) {
        await recordFailure(store, run.id, error)
        throw error
    }
}
