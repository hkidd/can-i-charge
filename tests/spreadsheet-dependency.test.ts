import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'

it('keeps the ingestion script workbook API compatible after the SheetJS update', () => {
    const XLSX = createRequire(import.meta.url)('xlsx') as typeof import('xlsx')
    const directory = mkdtempSync(join(tmpdir(), 'can-i-charge-sheet-'))
    try {
        const rows = [{ County: 'Fixture County', VMT: 123 }]
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'VM-2')
        const file = join(directory, 'fixture.xlsx')
        XLSX.writeFile(workbook, file)
        const read = XLSX.readFile(file)
        expect(XLSX.utils.sheet_to_json(read.Sheets[read.SheetNames[0]])).toEqual(rows)
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
})
