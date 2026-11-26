import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase-admin', () => ({ getSupabaseAdmin: vi.fn() }))
const mocks = vi.hoisted(() => ({
    feed: vi.fn(), population: vi.fn(), build: vi.fn(),
    store: { begin: vi.fn(), staged: vi.fn(), claim: vi.fn(), stations: vi.fn(), reference: vi.fn(), write: vi.fn(), ready: vi.fn(), publish: vi.fn(), fail: vi.fn() }
}))
vi.mock('@/lib/station-feed', () => ({ fetchStationSnapshot: mocks.feed }))
vi.mock('@/lib/population-data', () => ({ fetchPopulationData: mocks.population }))
vi.mock('@/lib/region-aggregation', () => ({ buildRegionalSnapshot: mocks.build }))
vi.mock('@/lib/refresh-store', async importOriginal => {
    const actual = await importOriginal<typeof import('@/lib/refresh-store')>()
    return { ...actual, RefreshStore: vi.fn(function () { return mocks.store }) }
})
import { stageStationRefresh, publishStagedRefresh } from '@/lib/refresh-service'
import { processNRELStation } from '@/lib/station-model'
const id = '00000000-0000-4000-8000-000000000001'
const station = processNRELStation({ id: 1, station_name: 'Fixture', latitude: 40, longitude: -105, state: 'CO', zip: '80000', ev_level2_evse_num: 2 })
const run = { id, status: 'aggregating', station_count: 1, state_count: 1, county_count: 1, zip_count: 1, diagnostics: {} }
beforeEach(() => {
    vi.clearAllMocks()
    mocks.feed.mockResolvedValue({ stations: [station], received: 1, rejected: 0 })
    mocks.store.begin.mockResolvedValue({ ...run, status: 'fetching' })
    mocks.store.staged.mockResolvedValue({ ...run, status: 'staged' })
    mocks.store.claim.mockResolvedValue(run)
    mocks.store.stations.mockResolvedValue([station])
    mocks.store.reference.mockResolvedValue([])
    mocks.store.write.mockResolvedValue(undefined)
    mocks.store.ready.mockResolvedValue({ ...run, status: 'ready' })
    mocks.store.publish.mockResolvedValue({ ...run, status: 'published' })
    mocks.store.fail.mockResolvedValue(undefined)
    mocks.population.mockResolvedValue({})
    mocks.build.mockReturnValue({ states: [{ state_name: 'Colorado' }], counties: [{ county_fips: '08001' }], zips: [{ zip_code: '80000' }], diagnostics: { unassigned_county_stations: 0 } })
})
afterEach(() => vi.restoreAllMocks())
it('only marks a station snapshot staged after every batch succeeds', async () => {
    expect((await stageStationRefresh()).status).toBe('staged')
    expect(mocks.store.write).toHaveBeenCalledWith(id, 'charging_stations', [station])
    expect(mocks.store.staged).toHaveBeenCalledWith(id)
    expect(mocks.store.publish).not.toHaveBeenCalled()
})
it('records ingestion failures without advancing or publishing', async () => {
    mocks.store.write.mockRejectedValueOnce(new Error('fixture insert failed'))
    await expect(stageStationRefresh()).rejects.toThrow('fixture insert failed')
    expect(mocks.store.fail).toHaveBeenCalledWith(id, expect.any(Error))
    expect(mocks.store.staged).not.toHaveBeenCalled()
    expect(mocks.store.publish).not.toHaveBeenCalled()
})
it('rebuilds a complete regional snapshot even when station data is unchanged', async () => {
    const result = await publishStagedRefresh(id)
    expect(result.swap_performed).toBe(true)
    expect(mocks.store.stations.mock.calls.map(args => args[0])).toEqual([id, undefined])
    expect(mocks.store.write.mock.calls.map(args => args[1])).toEqual(['state_level_data','county_level_data','zip_level_data'])
    expect(mocks.store.ready).toHaveBeenCalledWith(id, { states: 1, counties: 1, zips: 1 }, expect.objectContaining({ changes: expect.objectContaining({ total_changes: 0 }) }))
    expect(mocks.store.publish).toHaveBeenCalledExactlyOnceWith(id)
})
it('does not publish after a failed aggregate batch or truncated station read', async () => {
    mocks.store.write.mockRejectedValueOnce(new Error('fixture aggregate failure'))
    await expect(publishStagedRefresh(id)).rejects.toThrow('fixture aggregate failure')
    expect(mocks.store.publish).not.toHaveBeenCalled()
    mocks.store.write.mockResolvedValue(undefined)
    mocks.store.stations.mockResolvedValue([])
    await expect(publishStagedRefresh(id)).rejects.toThrow('Incomplete staged station snapshot')
    expect(mocks.store.publish).not.toHaveBeenCalled()
})
it('supports publication retries without regenerating data', async () => {
    mocks.store.claim.mockResolvedValue({ ...run, status: 'ready' })
    expect((await publishStagedRefresh(id)).swap_performed).toBe(true)
    expect(mocks.build).not.toHaveBeenCalled()
    expect(mocks.store.write).not.toHaveBeenCalled()
    mocks.store.publish.mockClear()
    mocks.store.claim.mockResolvedValue({ ...run, status: 'published' })
    expect((await publishStagedRefresh(id)).swap_performed).toBe(true)
    expect(mocks.store.publish).not.toHaveBeenCalled()
})
it('does not mark another worker failed when the run cannot be claimed', async () => {
    mocks.store.claim.mockRejectedValueOnce(new Error('Another worker is active'))
    await expect(publishStagedRefresh(id)).rejects.toThrow('Another worker is active')
    expect(mocks.store.fail).not.toHaveBeenCalled()
})
