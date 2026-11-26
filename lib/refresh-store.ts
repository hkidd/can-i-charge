import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { getSupabaseAdmin } from './supabase-admin'
import { readAllPages } from './db-pagination'
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
        for (let offset = 0; offset < rows.length; offset += 500) {
            const batch = rows.slice(offset, offset + 500)
            const inserted = await this.rpc('write_station_refresh_batch', { p_run_id: id, p_table: table, p_rows: batch })
            if (inserted !== batch.length) throw new RefreshError(`Incomplete batch write for ${table}`)
        }
    }
    async stations(runId?: string) {
        return readAllPages<Station>((from, to) => {
            let query = getSupabaseAdmin().from(runId ? 'charging_stations_staging' : 'charging_stations')
                .select('*').order('id').range(from, to)
            if (runId) query = query.eq('refresh_run_id', runId)
            return this.signal ? query.abortSignal(this.signal) : query
        })
    }
    async reference(table: Exclude<SnapshotTable, 'charging_stations'>) {
        return readAllPages<Record<string, unknown>>((from, to) => {
            const query = getSupabaseAdmin().from(table).select('*').order('id').range(from, to)
            return this.signal ? query.abortSignal(this.signal) : query
        })
    }
}
