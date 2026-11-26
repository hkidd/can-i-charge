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
