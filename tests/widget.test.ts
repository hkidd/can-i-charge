import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, it, vi } from 'vitest'

it('renders returned names and locations as text and restricts custom colors', async () => {
    const window = { location: { hostname: 'example.invalid' } } as {
        location: { hostname: string }, CanICharge?: { initWidget(element: unknown): Promise<void> }
    }
    const data = {
        grade: 'A', score: 90, percentile: 95, location: '<b>Fixture location</b>',
        nearest_charger_miles: 1,
        data_quality: { message: 'Capacity reported at 19 of 20 stations. <b>Reported capacity only</b>' },
        chargers: { within_5_miles: 3, dcfast_count: 1, nearest: { name: '<b>Fixture station</b>' } }
    }
    const fetch = vi.fn(async () => ({ ok: true, json: async () => data }))
    runInNewContext(readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8'), {
        window, document: { readyState: 'loading', addEventListener() {} }, URLSearchParams, fetch
    })
    const element = {
        dataset: { zip: '80000', theme: 'custom', primaryColor: 'invalid-color', backgroundColor: '#123456' },
        innerHTML: ''
    }
    await window.CanICharge!.initWidget(element)
    expect(fetch).toHaveBeenCalledOnce()
    expect(element.innerHTML).toContain('&lt;b&gt;Fixture location&lt;/b&gt;')
    expect(element.innerHTML).toContain('&lt;b&gt;Fixture station&lt;/b&gt;')
    expect(element.innerHTML).not.toContain('<b>Fixture')
    expect(element.innerHTML).not.toContain('invalid-color')
    expect(element.innerHTML).toContain('#123456')
    expect(element.innerHTML).toContain('Capacity reported at 19 of 20 stations.')
    expect(element.innerHTML).toContain('&lt;b&gt;Reported capacity only&lt;/b&gt;')
    const compact = { dataset: { zip: '80000', size: 'compact' }, innerHTML: '' }
    await window.CanICharge!.initWidget(compact)
    expect(compact.innerHTML).toContain('role="note"')
    expect(compact.innerHTML).toContain('Capacity reported at 19 of 20 stations.')
})

it('uses the embedding script origin and sends configured credentials in a header', async () => {
    const window = { location: { hostname: 'customer.invalid' } } as {
        location: { hostname: string }, CanICharge?: { initWidget(element: unknown): Promise<void> }
    }
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({
        score: null, grade: 'Unrated', percentile: null, location: 'Fixture', nearest_charger_miles: null,
        chargers: { within_5_miles: 0, dcfast_within_5_miles: 0, nearest: null }
    }) }))
    runInNewContext(readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8'), {
        window, URL, URLSearchParams, fetch,
        document: { currentScript: { src: 'https://preview.invalid/widget.js' }, readyState: 'loading', addEventListener() {} }
    })
    await window.CanICharge!.initWidget({ dataset: { zip: '07001', apiKey: 'fixture-key' }, innerHTML: '' })
    expect(fetch).toHaveBeenCalledWith('https://preview.invalid/api/ev-score?zip=07001', {
        headers: { Authorization: 'Bearer fixture-key' }
    })
})

it('renders an unrated result without a numeric score, percentile, or fabricated breakdown', async () => {
    const window = { location: { hostname: 'example.invalid' } } as {
        location: { hostname: string }, CanICharge?: { initWidget(element: unknown): Promise<void> }
    }
    const data = {
        grade: 'Unrated', score: null, percentile: null, breakdown: null, location: 'Fixture location',
        nearest_charger_miles: null,
        chargers: { within_5_miles: 0, dcfast_within_5_miles: 0, nearest: null }
    }
    runInNewContext(readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8'), {
        window, document: { readyState: 'loading', addEventListener() {} }, URLSearchParams,
        fetch: async () => ({ ok: true, json: async () => data })
    })
    const element = { dataset: { zip: '80000', showBreakdown: 'true' }, innerHTML: '' }
    await window.CanICharge!.initWidget(element)
    expect(element.innerHTML).toContain('Unrated')
    expect(element.innerHTML).toContain('Estimated public charging provision.')
    expect(element.innerHTML).not.toContain('SCORE BREAKDOWN')
    expect(element.innerHTML).not.toContain('null')
    expect(element.innerHTML).not.toContain('NaN')
})

it('explains absolute provision, escapes evidence text, and shows only the two target components',async()=>{
    const {calculateRegionalScore}=await import('@/lib/regional-score')
    const {scoreFixture}=await import('./fixtures/demand')
    const result=calculateRegionalScore(scoreFixture())
    const window={location:{hostname:'fixture.invalid'}} as {location:{hostname:string},CanICharge?:{initWidget(element:unknown):Promise<void>}}
    const data={...result,evidence:{...result.evidence,summary:'<b>Demand evidence</b>',limitations:'<b>Model assumptions</b>'},grade:'A+',percentile:null,location:'Fixture',nearest_charger_miles:null,chargers:{within_5_miles:0,dcfast_within_5_miles:0,nearest:null}}
    runInNewContext(readFileSync(new URL('../public/widget.js',import.meta.url),'utf8'),{window,document:{readyState:'loading',addEventListener(){}},URLSearchParams,fetch:async()=>({ok:true,json:async()=>data})})
    const element={dataset:{zip:'80000',showBreakdown:'true'},innerHTML:''}
    await window.CanICharge!.initWidget(element)
    expect(element.innerHTML).toContain('&lt;b&gt;Demand evidence&lt;/b&gt;')
    expect(element.innerHTML).toContain('Level 2 Target')
    expect(element.innerHTML).not.toContain('Charging Options')
    expect(element.innerHTML).not.toContain('Higher score than')
})
