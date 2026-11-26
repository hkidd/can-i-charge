import { config } from 'dotenv'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// A read-only backup of the existing production database. Credentials stay in
// the child process environment, never command arguments or printed output.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
process.umask(0o077)
chmodSync(join(root, '.env.local'), 0o600)
config({ path: join(root, '.env.local'), quiet: true })

async function main() {
    if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env.local')
    const connection = new URL(process.env.DATABASE_URL)
    if (!['postgres:', 'postgresql:'].includes(connection.protocol) ||
        !connection.username || !connection.password) {
        throw new Error('DATABASE_URL must be a PostgreSQL URI with username and password')
    }
    const project = 'lwymugddoqggxkvilodu'
    const username = decodeURIComponent(connection.username)
    if ((!connection.hostname.endsWith('.supabase.com') && !connection.hostname.endsWith('.supabase.co')) ||
        (!username.includes(project) && connection.hostname !== `db.${project}.supabase.co`)) {
        throw new Error('DATABASE_URL does not identify the expected production project')
    }
    const password = decodeURIComponent(connection.password)
    const directory = join(homedir(), '.local/share/can-i-charge/backups', new Date().toISOString().replace(/[:.]/g, '-'))
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    const environment = {
        ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || '5432',
        PGUSER: username, PGPASSWORD: password,
        PGDATABASE: connection.pathname.slice(1) || 'postgres',
        PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '20'
    }
    const binaryDirectory = process.env.PG_BIN || '/opt/homebrew/opt/postgresql@18/bin'
    const run = (binary, args) => {
        const result = spawnSync(join(binaryDirectory, binary), args, {
            env: environment, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024
        })
        if (result.status !== 0) {
            const detail = (result.stderr || result.error?.message || 'Unknown error').replaceAll(password, '[redacted]')
            throw new Error(`${binary} failed: ${detail}`)
        }
        return result.stdout
    }
    console.log(`Creating production backup in ${directory}`)
    const archive = join(directory, 'database.dump')
    run('pg_dump', ['--format=custom', `--file=${archive}`])
    const listing = run('pg_restore', ['--list', archive])
    for (const table of ['charging_stations', 'state_level_data', 'county_level_data',
        'zip_level_data', 'zip_geometries', 'api_keys']) {
        if (!listing.includes(`TABLE DATA public ${table} `)) throw new Error(`Archive lacks ${table} data`)
    }
    if (!listing.includes('ACL')) throw new Error('Archive lacks database grants')
    // Read and decompress every archive entry without touching any database.
    run('pg_restore', ['--file=/dev/null', archive])
    writeFileSync(join(directory, 'archive.list'), listing, { mode: 0o600 })
    writeFileSync(join(directory, 'roles.sql'), run('pg_dumpall', ['--roles-only', '--no-role-passwords']), { mode: 0o600 })
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(archive)) hash.update(chunk)
    const manifest = {
        project, completed_at: new Date().toISOString(), archive_bytes: statSync(archive).size,
        archive_sha256: hash.digest('hex'),
        validation: 'Required table data and ACL entries present; full archive decompression passed. Restore not rehearsed.',
        role_passwords_included: false
    }
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 })
    console.log(JSON.stringify({ directory, ...manifest }, null, 2))
}

main().catch(error => {
    console.error(error.message)
    console.error('Backup incomplete. Do not apply production migrations.')
    process.exitCode = 1
})
