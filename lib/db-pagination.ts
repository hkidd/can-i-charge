import type { PostgrestError } from '@supabase/supabase-js'

interface Page<T> { data: T[] | null; error: PostgrestError | null }

/** Advance by returned rows, since PostgREST may cap responses below the requested size. */
export async function readAllPages<T>(
    read: (from: number, to: number) => PromiseLike<Page<T>>,
    pageSize = 1000,
    maximumRows = 1000000
): Promise<T[]> {
    const rows: T[] = []
    for (;;) {
        const { data, error } = await read(rows.length, rows.length + pageSize - 1)
        if (error) throw new Error(`Database read failed: ${error.message}`)
        if (!data?.length) return rows
        rows.push(...data)
        if (rows.length > maximumRows) throw new Error('Snapshot exceeded the supported row limit')
    }
}
