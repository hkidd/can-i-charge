import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

let db: PGlite
beforeAll(async () => {
    db = new PGlite()
    await db.exec(`create role anon; create role authenticated; create role service_role;
        grant usage on schema public to anon, authenticated, service_role;
        create table public.api_keys(
            api_key text primary key, email text, status text, polar_customer_id text,
            polar_subscription_id text, created_at timestamptz default now(),
            requests_today integer default 0, last_request_date date
        );`)
    await db.exec(readFileSync(new URL('../supabase/migrations/20261124222817_subscription_access.sql', import.meta.url), 'utf8'))
})
afterAll(async () => db?.close())
beforeEach(async () => db.exec('truncate public.subscription_access,public.api_keys'))

async function apply(active: boolean, timestamp = '2026-11-23T12:00:00Z', key = 'fixture-key') {
    const result = await db.query<{ result: { api_key: string | null; send_email: boolean; stale: boolean } }>(
        "select public.apply_subscription_access('sub',$1,$2,'fixture@example.invalid','customer',$3) as result",
        [timestamp, active, key]
    )
    return result.rows[0].result
}

it('reuses the same key across duplicate and concurrent activation deliveries', async () => {
    const results = await Promise.all([apply(true), apply(true, undefined, 'different-key')])
    expect(results.map(result => result.api_key)).toEqual(['fixture-key', 'fixture-key'])
    expect((await db.query('select * from public.api_keys')).rows).toHaveLength(1)
    await db.query("select public.mark_subscription_email_sent('sub','fixture-key')")
    expect((await apply(true)).send_email).toBe(false)
})

it('does not reactivate access after a newer revocation arrives first', async () => {
    await apply(false, '2026-11-23T13:00:00Z')
    expect((await apply(true)).stale).toBe(true)
    expect((await db.query('select * from public.api_keys')).rows).toHaveLength(0)
})

it('revokes the existing key and permits a genuinely newer reactivation', async () => {
    await apply(true)
    await apply(false, '2026-11-23T13:00:00Z')
    expect((await db.query('select status from public.api_keys')).rows[0]).toEqual({ status: 'revoked' })
    expect((await apply(true, '2026-11-23T14:00:00Z', 'unused-key')).api_key).toBe('fixture-key')
    expect((await db.query('select status from public.api_keys')).rows).toEqual([{ status: 'active' }])
})

it('lets revocation win a timestamp tie', async () => {
    await apply(true)
    await apply(false)
    expect((await apply(true)).stale).toBe(true)
})

it('consumes the daily quota atomically and resets it on the next UTC date', async () => {
    await apply(true)
    await db.exec("update public.api_keys set requests_today=995,last_request_date='2026-11-23'")
    const results = await Promise.all(Array.from({ length: 10 }, () => db.query<{ result: { valid: boolean } }>(
        "select public.consume_api_key('fixture-key','2026-11-23') as result"
    )))
    expect(results.filter(result => result.rows[0].result.valid)).toHaveLength(5)
    expect((await db.query("select public.consume_api_key('fixture-key','2026-11-24') as result")).rows[0])
        .toMatchObject({ result: { valid: true, remainingRequests: 999 } })
    await apply(false, '2026-11-23T13:00:00Z')
    expect((await db.query("select public.consume_api_key('fixture-key','2026-11-24') as result")).rows[0])
        .toMatchObject({ result: { valid: false, reason: 'invalid' } })
})

it('restricts direct key writes while allowing backend RPC execution', async () => {
    await db.exec('set role service_role')
    try {
        await expect(db.exec("insert into public.api_keys(api_key) values('direct')")).rejects.toThrow('permission denied')
        expect((await apply(true)).api_key).toBe('fixture-key')
    } finally { await db.exec('reset role') }
    await db.exec('set role anon')
    try { await expect(apply(true)).rejects.toThrow('permission denied') }
    finally { await db.exec('reset role') }
})
