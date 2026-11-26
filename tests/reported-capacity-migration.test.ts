import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
// Historical v3 SQL remains immutable after the v4 model supersedes it.
const legacyScores = new Map<number, number | null>([[20714,54],[20,41],[100,64],[10,null],[1,null],[40,null]])

let db: PGlite
const tables = ['state_level_data', 'county_level_data', 'zip_level_data',
    'state_level_data_staging', 'county_level_data_staging', 'zip_level_data_staging']
const cases = [
    { charger_count: 20714, unknown_port_station_count: 1, population: 39287377, level1_count: 37, level2_count: 18182, dcfast_count: 2783,
        level1_ports: 284, level2_ports: 50059, dcfast_ports: 19862, tesla_count: 1925, ccs_count: 19512 },
    { charger_count: 20, unknown_port_station_count: 1, population: 10000, level1_count: 0, level2_count: 19, dcfast_count: 0,
        level1_ports: 0, level2_ports: 38, dcfast_ports: 0, tesla_count: 0, ccs_count: 19 },
    { charger_count: 10, unknown_port_station_count: 1, population: 10000, level1_count: 0, level2_count: 9, dcfast_count: 0,
        level1_ports: 0, level2_ports: 18, dcfast_ports: 0, tesla_count: 0, ccs_count: 9 },
    { charger_count: 1, unknown_port_station_count: 1, population: 10000, level1_count: 0, level2_count: 0, dcfast_count: 0,
        level1_ports: 0, level2_ports: 0, dcfast_ports: 0, tesla_count: 0, ccs_count: 0 },
    { charger_count: 100, unknown_port_station_count: 0, population: 10000, level1_count: 0, level2_count: 100, dcfast_count: 0,
        level1_ports: 0, level2_ports: 200, dcfast_ports: 0, tesla_count: 0, ccs_count: 100 },
    { charger_count: 40, unknown_port_station_count: 1, population: null, level1_count: 0, level2_count: 39, dcfast_count: 0,
        level1_ports: 0, level2_ports: 78, dcfast_ports: 0, tesla_count: 0, ccs_count: 39 }
]
beforeAll(async () => {
    db = new PGlite()
    await db.exec('create table public.station_refresh_runs(status text)')
    for (const table of tables) {
        await db.exec(`create table public.${table}(id uuid primary key default gen_random_uuid(),
            charger_count integer, unknown_port_station_count integer, population integer,
            level1_count integer,level2_count integer,dcfast_count integer,
            level1_ports integer,level2_ports integer,dcfast_ports integer,
            tesla_count integer,ccs_count integer,ev_infrastructure_score integer,scoring_version text)`)
        for (const row of cases) {
            const fields = Object.keys(row)
            await db.query(`insert into public.${table}(${fields.join(',')},ev_infrastructure_score,scoring_version) values(${fields.map((_, i) => `$${i + 1}`).join(',')},$${fields.length + 1},'regional-v2')`,
                [...Object.values(row), row.unknown_port_station_count === 0 ? legacyScores.get(row.charger_count) : null])
        }
    }
    await db.exec(readFileSync(new URL('../supabase/migrations/20261125140053_reported_capacity_scoring.sql', import.meta.url), 'utf8'))
})
afterAll(async () => db?.close())

it('preserves the historical v3 migration contract for all six region tables', async () => {
    for (const table of tables) {
        const result = await db.query<{ charger_count: number; ev_infrastructure_score: number | null; scoring_version: string }>(
            `select charger_count,ev_infrastructure_score,scoring_version from public.${table} order by charger_count desc`)
        expect(result.rows).toEqual([...cases].sort((a, b) => b.charger_count - a.charger_count).map(row => ({ charger_count: row.charger_count,
            ev_infrastructure_score: legacyScores.get(row.charger_count), scoring_version: 'regional-v3' })))
    }
})
