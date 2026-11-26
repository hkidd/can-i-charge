import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getSupabaseAdmin } from './supabase-admin'
import { readAllKeysetPages } from './db-pagination'
import type { Station } from './station-model'

const runSchema = z.object({
    id: z.uuid(), status: z.enum(['fetching','staged','aggregating','ready','published','failed']),
    station_count: z.number().int(), state_count: z.number().int().nullable(),
    county_count: z.number().int().nullable(), zip_count: z.number().int().nullable(),
    started_at: z.string(), completed_at: z.string().nullable(), diagnostics: z.record(z.string(), z.unknown())
})
export type RefreshRun = z.infer<typeof runSchema>
export type SnapshotTable = 'charging_stations' | 'state_level_data' | 'county_level_data' | 'zip_level_data'
export class RefreshError extends Error {
    constructor(message: string, public readonly status = 500) { super(message) }
}
export class RefreshStore {
    private readonly workerId = randomUUID()
    constructor(private readonly signal?: AbortSignal) {}

    private async rpc(name: string, args: Record<string, unknown>) {
        let request = getSupabaseAdmin().rpc(name, args)
        if (this.signal) request = request.abortSignal(this.signal)
        const { data, error } = await request
        if (error) {
            if (error.code === 'PGRST202' || error.code === '42P01' || error.code === '42703') {
                throw new RefreshError('Station refresh migration must be applied before running this job', 503)
            }
            throw new RefreshError(error.message, error.code === '55P03' ? 409 : 500)
        }
        return data
    }
    async begin(count: number) { return runSchema.parse(await this.rpc('begin_station_refresh', { p_station_count: count, p_run_id: randomUUID() })) }
    async staged(id: string) { return runSchema.parse(await this.rpc('mark_station_refresh_staged', { p_run_id: id })) }
    async claim(id?: string) { return runSchema.parse(await this.rpc('claim_station_refresh', { p_run_id: id ?? null, p_worker_id: this.workerId })) }
    async ready(id: string, counts: { states: number; counties: number; zips: number }, diagnostics: Record<string, unknown>) {
        return runSchema.parse(await this.rpc('finish_station_refresh_aggregates', {
            p_run_id: id, p_states: counts.states, p_counties: counts.counties, p_zips: counts.zips, p_diagnostics: diagnostics
        }))
    }
    async publish(id: string) { return runSchema.parse(await this.rpc('publish_station_refresh', { p_run_id: id })) }
    async fail(id: string, error: unknown) {
        // Failure reporting must still work if the request's processing deadline elapsed.
        const { error: failure } = await getSupabaseAdmin().rpc('fail_station_refresh', {
            p_run_id: id, p_error: error instanceof Error ? error.message : 'Refresh failed'
        }).abortSignal(AbortSignal.timeout(5000))
        if (failure) console.error('Could not record refresh failure:', failure.message)
    }
    async write(id: string, table: SnapshotTable, rows: object[]) {
        // Keep JSON expansion and writes small enough to leave room for interactive reads.
        const batchSize = table === 'charging_stations' ? 500 : 250
        for (let offset = 0; offset < rows.length; offset += batchSize) {
            if (offset) await new Promise(resolve => setTimeout(resolve, 50))
            const batch = rows.slice(offset, offset + batchSize)
            const inserted = await this.rpc('write_station_refresh_batch', { p_run_id: id, p_table: table, p_rows: batch })
            if (inserted !== batch.length) throw new RefreshError(`Incomplete batch write for ${table}`)
        }
    }
    async stations(runId?: string) {
        const table = runId ? 'charging_stations_staging' : 'charging_stations'
        return readAllKeysetPages<Station>((after, limit) => {
            let query = getSupabaseAdmin().from(table)
                .select('*').order('id').limit(limit)
            if (after) query = query.gt('id', after)
            if (runId) query = query.eq('refresh_run_id', runId)
            return this.signal ? query.abortSignal(this.signal) : query
        }, 1000, 1000000, table)
    }
    async reference(table: Exclude<SnapshotTable, 'charging_stations'>) {
        // Counts and supply/filter JSON are rebuilt from stations, never reference inputs.
        // Fetching them for every ZIP made late OFFSET pages exceed the database timeout.
        const shared = 'id,center_lat,center_lng,population,population_source,traffic_data'
        const columns: string = table === 'state_level_data' ? `${shared},state_name`
            : table === 'county_level_data' ? `${shared},county_name,county_fips,state,daily_vmt,vmt_per_capita,traffic_score`
            : `${shared},zip_code,state`
        return readAllKeysetPages<Record<string, unknown> & { id: string }>((after, limit) => {
            let query = getSupabaseAdmin().from(table).select(columns).order('id').limit(limit)
            if (after) query = query.gt('id', after)
            if (this.signal) query = query.abortSignal(this.signal)
            return query.overrideTypes<(Record<string, unknown> & { id: string })[], { merge: false }>()
        }, 500, 1000000, table)
    }
}
