import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

let db: PGlite
beforeAll(async () => {
    db = new PGlite()
    await db.exec('create role anon; create role authenticated; create role service_role; create table public.zip_level_data(zip_code text);')
    await db.exec(readFileSync(new URL('../supabase/migrations/20261124222816_region_lookup.sql', import.meta.url), 'utf8'))
})
afterAll(async () => db?.close())

it('allows county fallback when ZIP geometry is absent', async () => {
    expect((await db.query('select * from public.find_zip_region(39,-105)')).rows).toEqual([])
})
it('rejects invalid coordinates', async () => {
    await expect(db.query('select * from public.find_zip_region(91,-105)')).rejects.toThrow('Invalid coordinates')
})
it('keeps the geometry RPC restricted to the backend role', async () => {
    await db.exec('set role anon')
    try { await expect(db.query('select * from public.find_zip_region(39,-105)')).rejects.toThrow('permission denied') }
    finally { await db.exec('reset role') }
})
