import { expect, it, vi } from 'vitest'
import { readAllPages } from '@/lib/db-pagination'
it('continues after a server-capped page rather than silently truncating the snapshot', async () => {
    const data = [1,2,3,4,5]
    const read = vi.fn(async (from: number) => ({ data: data.slice(from, from + 2), error: null }))
    expect(await readAllPages(read, 1000)).toEqual(data)
    expect(read.mock.calls.map(call => call[0])).toEqual([0,2,4,5])
})
it('fails an incomplete read rather than returning partial data', async () => {
    const read = vi.fn().mockResolvedValueOnce({ data: [1], error: null }).mockResolvedValueOnce({ data: null, error: { message: 'fixture failure' } })
    await expect(readAllPages(read)).rejects.toThrow('fixture failure')
})

it('walks primary-key pages even when the server caps them below the requested limit', async () => {
    const { readAllKeysetPages } = await import('@/lib/db-pagination')
    const data = ['a','b','c','d','e'].map(id => ({ id }))
    const read = vi.fn(async (after: string | undefined) => ({
        data: data.filter(row => !after || row.id > after).slice(0, 2), error: null
    }))
    expect(await readAllKeysetPages(read)).toEqual(data)
    expect(read.mock.calls.map(call => call[0])).toEqual([undefined,'b','d','e'])
})
it('rejects a repeated or out-of-order key instead of looping or accepting duplicate rows', async () => {
    const { readAllKeysetPages } = await import('@/lib/db-pagination')
    const read = vi.fn().mockResolvedValue({ data: [{ id: 'a' }], error: null })
    await expect(readAllKeysetPages(read)).rejects.toThrow('cursor did not advance')
})
it('identifies the failing table and does not return a partial keyset snapshot', async () => {
    const { readAllKeysetPages } = await import('@/lib/db-pagination')
    const read = vi.fn().mockResolvedValueOnce({ data: [{ id: 'a' }], error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'statement timeout' } })
    await expect(readAllKeysetPages(read, 500, 1000, 'zip_level_data')).rejects.toThrow('Database read failed (zip_level_data): statement timeout')
})
it('bounds keyset reads rather than accepting an unexpectedly large snapshot', async () => {
    const { readAllKeysetPages } = await import('@/lib/db-pagination')
    const read = vi.fn().mockResolvedValueOnce({ data: [{ id: 'a' }, { id: 'b' }], error: null })
    await expect(readAllKeysetPages(read, 500, 1)).rejects.toThrow('supported row limit')
})
