'use client'

import { useEffect, useState } from 'react'

export interface ScoreData {
    score: number
    grade: string
    percentile: number
    message: string
    location: string
    breakdown: {
        nearby_chargers: number
        fast_charging: number
        network_diversity: number
        charging_density: number
    }
    chargers: {
        within_5_miles: number
        dcfast_count: number
        nearest: {
            name: string
            distance: number
        } | null
    }
    nearest_charger_miles: number | null
}

export interface WidgetConfig {
    // Location (one required)
    address?: string
    zip?: string
    county?: string
    state?: string
    lat?: number
    lng?: number

    // Styling (Pro features)
    theme?: 'light' | 'dark' | 'glass' | 'custom'
    primaryColor?: string
    backgroundColor?: string
    textColor?: string
    size?: 'compact' | 'standard' | 'detailed'
    showBranding?: boolean
    showBreakdown?: boolean
    borderRadius?: number

    // API
    apiKey?: string

    // Demo mode (bypasses API fetch)
    demoData?: ScoreData
}

const DEFAULT_CONFIG: Partial<WidgetConfig> = {
    theme: 'light',
    size: 'standard',
    showBranding: true,
    showBreakdown: false,
    borderRadius: 16,
    primaryColor: '#10b981',
}

export default function EVScoreWidget(props: WidgetConfig) {
    const config = { ...DEFAULT_CONFIG, ...props }
    const [data, setData] = useState<ScoreData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Use props directly for dependencies to ensure proper reactivity
    const { address, zip, county, state, lat, lng, demoData } = props

    useEffect(() => {
        // If demoData is provided, use it directly without fetching
        if (demoData) {
            setData(demoData)
            setLoading(false)
            return
        }

        async function fetchScore() {
            setLoading(true)
            setError(null)

            try {
                const params = new URLSearchParams()
                if (address) params.set('address', address)
                if (zip) params.set('zip', zip)
                if (county) params.set('county', county)
                if (state) params.set('state', state)
                if (lat) params.set('lat', lat.toString())
                if (lng) params.set('lng', lng.toString())

                if (params.toString() === '') {
                    setLoading(false)
                    return
                }

                const res = await fetch(`/api/ev-score?${params.toString()}`)
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}))
                    throw new Error(errData.error || 'Failed to fetch score')
                }

                const result = await res.json()
                setData(result)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load')
            } finally {
                setLoading(false)
            }
        }

        fetchScore()
    }, [address, zip, county, state, lat, lng, demoData])

    // Theme styles
    const getThemeStyles = () => {
        if (config.theme === 'custom') {
            return {
                background: config.backgroundColor || '#ffffff',
                color: config.textColor || '#1f2937',
                primary: config.primaryColor || '#10b981',
                muted: 'rgba(0,0,0,0.5)',
                border: 'rgba(0,0,0,0.1)',
                isGlass: false,
            }
        }
        if (config.theme === 'glass') {
            return {
                background: 'rgba(255, 255, 255, 0.03)',
                color: '#ecfdf5',
                primary: '#10b981',
                muted: 'rgba(255,255,255,0.5)',
                border: 'rgba(255,255,255,0.08)',
                isGlass: true,
            }
        }
        if (config.theme === 'dark') {
            return {
                background: '#09090b',
                color: '#ecfdf5',
                primary: config.primaryColor || '#10b981',
                muted: 'rgba(255,255,255,0.5)',
                border: 'rgba(255,255,255,0.1)',
                isGlass: false,
            }
        }
        return {
            background: '#ffffff',
            color: '#1f2937',
            primary: config.primaryColor || '#10b981',
            muted: 'rgba(0,0,0,0.5)',
            border: 'rgba(0,0,0,0.1)',
            isGlass: false,
        }
    }

    const theme = getThemeStyles()

    const getGradeColor = (grade: string) => {
        if (grade.startsWith('A')) return '#22c55e'
        if (grade.startsWith('B')) return '#84cc16'
        if (grade.startsWith('C')) return '#eab308'
        if (grade.startsWith('D')) return '#f97316'
        return '#ef4444'
    }

    // Compact size
    if (config.size === 'compact') {
        return (
            <div
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: theme.background,
                    color: theme.color,
                    borderRadius: config.borderRadius,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '14px',
                }}
            >
                {loading ? (
                    <span style={{ color: '#9ca3af' }}>Loading...</span>
                ) : error ? (
                    <span style={{ color: '#ef4444' }}>Error</span>
                ) : data ? (
                    <>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: getGradeColor(data.grade),
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '12px',
                            }}
                        >
                            {data.grade}
                        </span>
                        <span style={{ fontWeight: 600 }}>EV Ready: {data.score}</span>
                    </>
                ) : null}
            </div>
        )
    }

    // Standard/Detailed size
    const isDark = config.theme === 'dark' || config.theme === 'glass'
    const mutedBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'

    return (
        <div
            style={{
                width: config.size === 'detailed' ? '340px' : '300px',
                padding: '24px',
                background: theme.background,
                color: theme.color,
                borderRadius: config.borderRadius,
                border: `1px solid ${theme.border}`,
                boxShadow: theme.isGlass
                    ? '0 8px 32px rgba(0,0,0,0.4)'
                    : '0 4px 6px -1px rgba(0,0,0,0.1)',
                fontFamily: 'var(--font-geist-sans), system-ui, -apple-system, sans-serif',
                backdropFilter: theme.isGlass ? 'blur(16px)' : undefined,
                WebkitBackdropFilter: theme.isGlass ? 'blur(16px)' : undefined,
            }}
        >
            {/* Header */}
            <div style={{ marginBottom: '20px', fontSize: '12px', fontWeight: 600, opacity: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                EV Readiness Score
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', opacity: 0.5 }}>
                    <div style={{ marginBottom: '8px' }}>Loading...</div>
                </div>
            ) : error ? (
                <div style={{ textAlign: 'center', padding: '32px 20px', color: '#ef4444' }}>
                    {error}
                </div>
            ) : data ? (
                <>
                    {/* Score display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
                        <div
                            style={{
                                width: '72px',
                                height: '72px',
                                borderRadius: '16px',
                                background: `linear-gradient(135deg, ${getGradeColor(data.grade)}, ${getGradeColor(data.grade)}dd)`,
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '28px',
                                fontWeight: 700,
                                boxShadow: `0 4px 20px ${getGradeColor(data.grade)}40`,
                            }}
                        >
                            {data.grade}
                        </div>
                        <div>
                            <div style={{ fontSize: '40px', fontWeight: 700, lineHeight: 1, background: `linear-gradient(135deg, ${theme.color}, ${theme.color}aa)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                                {data.score}
                            </div>
                            <div style={{ fontSize: '13px', opacity: 0.5, marginTop: '4px' }}>
                                out of 100
                            </div>
                        </div>
                    </div>

                    {/* Percentile */}
                    <div
                        style={{
                            padding: '12px 16px',
                            background: mutedBg,
                            borderRadius: '12px',
                            fontSize: '13px',
                            marginBottom: '20px',
                            border: `1px solid ${theme.border}`,
                        }}
                    >
                        Better than <span style={{ fontWeight: 600, color: theme.primary }}>{data.percentile}%</span> of US locations
                    </div>

                    {/* Quick stats */}
                    <div style={{ fontSize: '13px', marginBottom: '20px', lineHeight: 1.6 }}>
                        <div style={{ marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600 }}>{data.chargers.within_5_miles} chargers</span>
                            <span style={{ opacity: 0.6 }}> within 5 miles</span>
                            {data.chargers.dcfast_count > 0 && (
                                <span style={{ opacity: 0.6 }}> ({data.chargers.dcfast_count} fast)</span>
                            )}
                        </div>
                        {data.chargers.nearest && (
                            <div style={{ opacity: 0.6 }}>
                                Nearest: <span style={{ fontWeight: 500, color: theme.color }}>{data.nearest_charger_miles?.toFixed(1)} mi</span>
                                {data.chargers.nearest.name && (
                                    <span> — {data.chargers.nearest.name}</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Breakdown */}
                    {config.showBreakdown && (
                        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: '20px', marginBottom: '20px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: '12px', opacity: 0.5, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                                Score Breakdown
                            </div>
                            {[
                                { label: 'Nearby Chargers', value: data.breakdown.nearby_chargers, max: 40 },
                                { label: 'Fast Charging', value: data.breakdown.fast_charging, max: 25 },
                                { label: 'Network Diversity', value: data.breakdown.network_diversity, max: 20 },
                                { label: 'Charging Density', value: data.breakdown.charging_density, max: 15 },
                            ].map((item) => (
                                <div key={item.label} style={{ marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                                        <span style={{ opacity: 0.7 }}>{item.label}</span>
                                        <span style={{ fontWeight: 500 }}>{item.value}/{item.max}</span>
                                    </div>
                                    <div style={{ height: '6px', background: mutedBg, borderRadius: '3px', overflow: 'hidden' }}>
                                        <div
                                            style={{
                                                height: '100%',
                                                width: `${(item.value / item.max) * 100}%`,
                                                background: `linear-gradient(90deg, ${theme.primary}, ${theme.primary}cc)`,
                                                borderRadius: '3px',
                                                transition: 'width 0.5s ease-out',
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Location */}
                    <div style={{ fontSize: '12px', opacity: 0.5, marginBottom: config.showBranding ? '16px' : 0 }}>
                        {data.location}
                    </div>

                    {/* Branding */}
                    {config.showBranding && (
                        <div
                            style={{
                                borderTop: `1px solid ${theme.border}`,
                                paddingTop: '16px',
                                fontSize: '11px',
                                opacity: 0.4,
                            }}
                        >
                            Powered by{' '}
                            <a
                                href="https://canicharge.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: theme.primary, textDecoration: 'none', fontWeight: 500 }}
                            >
                                CanICharge
                            </a>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    )
}
