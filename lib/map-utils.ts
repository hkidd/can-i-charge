import { selectedSiteCount } from './station-filters'
import { calculateRegionalScore, getScoreDataQuality, selectScoreInputs, type ScoreFilters, type ScoreInputs } from './regional-score'

export function getStateCodeFromFIPS(fips: string): string | null {
    const fipsToState: Record<string, string> = {
        '01': 'AL',
        '02': 'AK',
        '04': 'AZ',
        '05': 'AR',
        '06': 'CA',
        '08': 'CO',
        '09': 'CT',
        '10': 'DE',
        '11': 'DC',
        '12': 'FL',
        '13': 'GA',
        '15': 'HI',
        '16': 'ID',
        '17': 'IL',
        '18': 'IN',
        '19': 'IA',
        '20': 'KS',
        '21': 'KY',
        '22': 'LA',
        '23': 'ME',
        '24': 'MD',
        '25': 'MA',
        '26': 'MI',
        '27': 'MN',
        '28': 'MS',
        '29': 'MO',
        '30': 'MT',
        '31': 'NE',
        '32': 'NV',
        '33': 'NH',
        '34': 'NJ',
        '35': 'NM',
        '36': 'NY',
        '37': 'NC',
        '38': 'ND',
        '39': 'OH',
        '40': 'OK',
        '41': 'OR',
        '42': 'PA',
        '44': 'RI',
        '45': 'SC',
        '46': 'SD',
        '47': 'TN',
        '48': 'TX',
        '49': 'UT',
        '50': 'VT',
        '51': 'VA',
        '53': 'WA',
        '54': 'WV',
        '55': 'WI',
        '56': 'WY'
    }

    return fipsToState[fips] || null
}

export function calculateTrafficScore(vmtPerCapita: number): number {
    // Normalize traffic volume to 0-100 scale
    // Based on typical US VMT per capita ranges (10-50 miles/day)
    const normalizedVMT = Math.min(vmtPerCapita / 50, 1)
    return Math.round(normalizedVMT * 100)
}

export function applyFiltersToData<T extends ScoreInputs>(data: T[], filters: ScoreFilters) {
    return data.map(region => {
        const selected = selectScoreInputs(region, filters)
        const result = calculateRegionalScore(region, region.population, filters)
        const score = result.score
        const mask = Number(filters.showLevel1) | (Number(filters.showLevel2) << 1) | (Number(filters.showDCFast) << 2)
        const none = mask === 0 || (filters.showTesla === false && filters.showCCS === false)
        let count: number | null = none ? 0 : null
        if (selected && !none) {
            const ports = [selected.level1_ports, selected.level2_ports, selected.dcfast_ports]
            if (filters.usePortWeighting !== false) {
                if (ports.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) {
                    count = ports.reduce<number>((n, value, index) => n + (mask & (1 << index) ? value! : 0), 0)
                }
            } else {
                const family = filters.showTesla === false ? 'other' : filters.showCCS === false ? 'tesla' : 'all'
                const summaries = region.filter_summary
                const masks = region.public_supply?.[family]?.site_masks ?? (summaries?.version === 1 ? family === 'all' ? summaries.all : summaries[family].site_masks : undefined)
                count = selectedSiteCount(masks, mask)
                if (mask === 7) count = selected.charger_count ?? null
                // Compatibility with snapshots without speed masks.
                if (count === null && [1, 2, 4].includes(mask)) count = mask === 1 ? selected.level1_count ?? null : mask === 2 ? selected.level2_count ?? null : selected.dcfast_count ?? null
            }
        }
        const trafficMessage = result.evidence
            ? result.evidence.traffic_basis === 'regional_2023' ? 'Demand adjusted using historical 2023 regional road traffic.'
                : result.evidence.traffic_basis === 'state_2023_proxy' ? 'Traffic demand uses a state-level proxy; local traffic is not measured.'
                : 'Traffic data is unavailable; the model uses the fleet baseline.' : null

        return { ...region, traffic_message: trafficMessage, model_message: result.evidence?.summary ?? 'EV fleet data is unavailable for this region.', evidence: result.evidence, score, filtered_charger_count: count, data_quality: getScoreDataQuality(selected ?? {}) }
    })
}

export function getScoreColor(score: number | null): string {
    if (score === null) return '#64748b'
    if (score >= 80) return '#059669'
    if (score >= 60) return '#3b82f6'
    if (score >= 40) return '#f97316'
    return '#dc2626'
}

export function getScoreLabel(score: number | null): string {
    if (score === null) return 'Unrated'
    if (score >= 80) return 'Excellent'
    if (score >= 60) return 'Good'
    if (score >= 40) return 'Fair'
    return 'Poor'
}
