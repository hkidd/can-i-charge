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

/** Walk an indexed, immutable primary key without increasingly expensive OFFSET scans. */
export async function readAllKeysetPages<T extends { id: string }>(
    read: (after: string | undefined, limit: number) => PromiseLike<Page<T>>,
    pageSize = 1000,
    maximumRows = 1000000,
    context = 'snapshot'
): Promise<T[]> {
    const rows: T[] = []
    let after: string | undefined
    for (;;) {
        const { data, error } = await read(after, pageSize)
        if (error) throw new Error(`Database read failed (${context}): ${error.message}`)
        if (!data?.length) return rows
        for (const row of data) {
            if (typeof row.id !== 'string' || !row.id || (after !== undefined && row.id <= after)) {
                throw new Error(`Database cursor did not advance (${context})`)
            }
            after = row.id
            rows.push(row)
        }
        if (rows.length > maximumRows) throw new Error('Snapshot exceeded the supported row limit')
    }
}
