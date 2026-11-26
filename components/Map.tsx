'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import AddressSearch from './AddressSearch'
import SupportBanner from './SupportBanner'
import {
    cancelMapLoads,
    loadStatePolygons,
    loadCountyPolygons,
    loadZipPolygons,
    loadChargerPoints
} from '@/lib/map-data-loader'
import MapFilters from './MapFilters'
import type { HoveredData } from '@/types'
import { ToastContainer, useToast } from './Toast'
import { DEFAULT_SCORE_FILTERS } from '@/lib/regional-score'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

export default function Map() {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<mapboxgl.Map | null>(null)
    const [loading, setLoading] = useState(true)
    const [hoveredState, setHoveredState] = useState<HoveredData | null>(null)
    const [chargerFilters, setChargerFilters] = useState({ ...DEFAULT_SCORE_FILTERS })
    const chargerFiltersRef = useRef(chargerFilters)
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const { messages, showError, dismissToast } = useToast()

    useEffect(() => {
        chargerFiltersRef.current = chargerFilters
    }, [chargerFilters])

    const configuredInteractions = useRef(new Set<string>())
    const setupInteractions = useCallback((layerType: string) => {
        if (!map.current) return
        const layerId =
            layerType === 'polygon' ? 'region-fills' : 'charger-points'

        if (configuredInteractions.current.has(layerId)) return
        configuredInteractions.current.add(layerId)

        map.current.on('mouseenter', layerId, () => {
            if (map.current) map.current.getCanvas().style.cursor = 'pointer'
        })

        map.current.on('mouseleave', layerId, () => {
            if (map.current) map.current.getCanvas().style.cursor = ''
            setHoveredState(null)
        })

        map.current.on('mousemove', layerId, (e) => {
            if (e.features && e.features.length > 0) {
                const feature = e.features[0]
                setHoveredState({
                    state_name: feature.properties?.state_name,
                    county_name: feature.properties?.county_name,
                    zip_code: feature.properties?.zip_code,
                    state: feature.properties?.state,
                    score: feature.properties?.score,
                    charger_count: feature.properties?.charger_count,
                    filtered_charger_count:
                        feature.properties?.filtered_charger_count,
                    population: feature.properties?.population,
                    model_message: feature.properties?.model_message,
                    traffic_message: feature.properties?.traffic_message,
                    capacity_message: feature.properties?.capacity_message,
                    unknown_port_station_count: feature.properties?.unknown_port_station_count
                })
            }
        })
    }, [])

    const loadGeneration = useRef(0)
    const loadMapData = useCallback(async () => {
        if (!map.current) return
        const generation = ++loadGeneration.current

        try {
            const zoom = map.current.getZoom()
            if (zoom <= 4.5)
                await loadStatePolygons(
                    map.current,
                    chargerFiltersRef.current,
                    setupInteractions,
                    (e) => console.error(e)
                )
            else if (zoom <= 8)
                await loadCountyPolygons(
                    map.current,
                    chargerFiltersRef.current,
                    setupInteractions,
                    (e) => console.error(e)
                )
            else
                await loadZipPolygons(
                    map.current,
                    chargerFiltersRef.current,
                    setupInteractions,
                    (e) => console.error(e)
                )

            if (generation !== loadGeneration.current || !map.current) return
            if (zoom >= 13) {
                await loadChargerPoints(map.current, chargerFiltersRef.current)
            } else {
                // Remove charger points when zoomed out below level 13
                if (map.current.getLayer('charger-points')) {
                    map.current.removeLayer('charger-points')
                }
                if (map.current.getSource('charger-points')) {
                    map.current.removeSource('charger-points')
                }
            }

            setLoading(false)
        } catch (error) {
            console.error('Failed to load map data:', error)
            setLoading(false)
        }
    }, [setupInteractions])

    // Initialize map
    useEffect(() => {
        if (map.current) return
        const interactions = configuredInteractions.current
        let moveTimer: ReturnType<typeof setTimeout> | undefined

        try {
            map.current = new mapboxgl.Map({
                container: mapContainer.current!,
                style: 'mapbox://styles/mapbox/dark-v11', // Always dark
                center: [-98.5795, 39.8283],
                zoom: 4,
                projection: 'mercator',
                accessToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN
            })

            map.current.on('load', async () => {
                try {
                    await loadMapData()
                } catch (error) {
                    console.error('Failed to load map data:', error)
                    showError(
                        'Failed to load map data. Please refresh the page.'
                    )
                }
            })

            map.current.on('error', (e) => {
                console.error('Map error:', e.error)
                showError(
                    'Map failed to load. Please check your connection and refresh.'
                )
            })

            map.current.on('movestart', () => {
                loadGeneration.current++
                clearTimeout(moveTimer)
                if (map.current) cancelMapLoads(map.current)
            })
            map.current.on('moveend', () => {
                clearTimeout(moveTimer)
                moveTimer = setTimeout(() => { void loadMapData() }, 250)
            })

            return () => {
                clearTimeout(moveTimer)
                if (map.current) cancelMapLoads(map.current)
                map.current?.remove()
                map.current = null
                interactions.clear()
            }
        } catch (error) {
            console.error('Failed to initialize map:', error)
            showError('Failed to initialize map. Please check your connection.')
        }
    }, [loadMapData, showError])

    const isInitialMount = useRef(true)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }
        if (!map.current || !map.current.isStyleLoaded()) return
        const timer = setTimeout(() => {
            if (map.current) {
                loadMapData()
            }
        }, 100)
        return () => clearTimeout(timer)
    }, [chargerFilters, loadMapData])

    const handleLocationSelect = (lng: number, lat: number) => {
        if (map.current) {
            map.current.flyTo({ center: [lng, lat], zoom: 12, duration: 2000 })
        }
    }

    const getScoreColor = (score: number | null) => {
        if (score === null) return '#64748b'
        if (chargerFilters.opportunityMode) {
            if (score >= 75) return '#ef4444' // Large shortfall
            if (score >= 35) return '#f59e0b' // Moderate shortfall
            return '#10b981' // Small shortfall
        } else {
            if (score >= 80) return '#059669' // Emerald
            if (score >= 50) return '#0891b2' // Cyan
            return '#7c3aed' // Violet
        }
    }

    return (
        <div className='relative w-full h-screen bg-background overflow-hidden'>
            <div ref={mapContainer} className='w-full h-full' />

            {/* Top Controls - offset for fixed header */}
            <div className='absolute left-4 right-4 z-10 flex flex-col gap-3' style={{ top: 'calc(5rem + var(--service-banner-height, 0px))' }}>
                {/* Centered search with side buttons */}
                <div className='relative flex items-center min-h-[48px]'>
                    {/* Mobile Filter Button - Left Side */}
                    <button
                        onClick={() => setShowMobileFilters(true)}
                        className='absolute left-0 md:hidden w-12 h-12 rounded-full hud-panel flex items-center justify-center text-foreground hover:text-neon-mid transition-colors z-20'
                    >
                        <svg
                            className='w-5 h-5'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                        >
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z'
                            />
                        </svg>
                    </button>

                    {/* Centered Search Bar */}
                    <div className='flex-1 max-w-md mx-auto'>
                        <div className='px-14 md:px-0'>
                            <AddressSearch
                                onLocationSelect={handleLocationSelect}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* --- FUTURISTIC HOVER CARD --- */}
            {hoveredState && (
                <div className='absolute top-36 right-4 md:right-8 pointer-events-auto md:pointer-events-none z-20'>
                    <div className='hud-panel rounded-2xl p-5 w-[calc(100vw-2rem)] max-w-[420px] max-h-[calc(100dvh-10rem)] overflow-y-auto animate-slide-in backdrop-blur-xl relative'>
                        {/* Close button - mobile only */}
                        <button
                            onClick={() => setHoveredState(null)}
                            className='absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors text-foreground/60 hover:text-foreground md:hidden'
                            aria-label='Close'
                        >
                            <svg
                                className='w-4 h-4'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M6 18L18 6M6 6l12 12'
                                />
                            </svg>
                        </button>
                        {/* Header: Region Name */}
                        <h2 className='text-2xl font-bold text-foreground mb-1 tracking-tight pr-8 md:pr-0'>
                            {hoveredState.state_name ||
                                hoveredState.county_name ||
                                hoveredState.zip_code}
                        </h2>
                        {hoveredState.state &&
                            (hoveredState.county_name ||
                                hoveredState.zip_code) && (
                                <span className='text-xs font-mono text-neon-mid tracking-widest uppercase mb-4 block opacity-80'>
                                    {hoveredState.state}
                                    {hoveredState.zip_code
                                        ? ` // ZIP REGION`
                                        : ` // SECTOR`}
                                </span>
                            )}

                        {/* Main Score Display */}
                        <div className='mb-6 mt-4'>
                            <div className='flex justify-between items-end mb-1'>
                                <span className='text-xs font-mono text-foreground/60 uppercase tracking-wider'>
                                    {chargerFilters.opportunityMode
                                        ? 'Projected 2030 Gap'
                                        : 'EV Readiness'}
                                </span>
                                <span
                                    className='text-4xl font-bold'
                                    style={{
                                        color: getScoreColor(
                                            hoveredState.score ?? null
                                        )
                                    }}
                                >
                                    {hoveredState.score == null ? 'Unrated' : `${Math.round(hoveredState.score)}${chargerFilters.opportunityMode ? '%' : ''}`}
                                </span>
                            </div>
                            <p className='text-xs text-foreground/70 mb-3'>
                                {chargerFilters.opportunityMode ? 'Lower is better · less charging provision missing' : 'Higher is better · more of the current target met'}
                            </p>
                            {chargerFilters.opportunityMode && hoveredState.score != null && (
                                <p className='text-sm text-foreground/90 mb-3'>
                                    {Math.round(hoveredState.score)}% still needed · {100 - Math.round(hoveredState.score)}% of the modeled 2030 target covered
                                </p>
                            )}
                            {/* Visual Progress Bar */}
                            <div className='w-full h-1.5 bg-white/10 rounded-full overflow-hidden'>
                                <div
                                    className='h-full transition-all duration-500 ease-out shadow-[0_0_10px_currentColor]'
                                    style={{
                                        width: `${hoveredState.score ?? 0}%`,
                                        backgroundColor: getScoreColor(
                                            hoveredState.score ?? null
                                        )
                                    }}
                                />
                            </div>
                        </div>

                        {hoveredState.model_message && (
                            <p role='note' className='text-xs text-foreground/80 mb-4 leading-relaxed'>{hoveredState.model_message}</p>
                        )}
                        {hoveredState.traffic_message && (
                            <p role='note' className='text-xs text-foreground/70 mb-4 leading-relaxed'>{hoveredState.traffic_message}</p>
                        )}
                        {/* Data Grid */}
                        {hoveredState.capacity_message && (
                            <p role='note' className='text-xs text-foreground/70 mb-4 leading-relaxed'>
                                {hoveredState.capacity_message}
                            </p>
                        )}
                        <div className='grid grid-cols-2 gap-4 border-t border-white/10 pt-4'>
                            <div>
                                <span className='text-[10px] font-mono text-foreground/50 uppercase block mb-1'>
                                    {chargerFilters.usePortWeighting
                                        ? 'Open-access ports'
                                        : 'Open-access sites'}
                                </span>
                                <span className='text-xl font-semibold text-foreground'>
                                    {hoveredState.filtered_charger_count ?? '—'}
                                </span>
                            </div>

                            <div>
                                <span className='text-[10px] font-mono text-foreground/50 uppercase block mb-1'>
                                    {chargerFilters.opportunityMode ? 'Projected Gap' : 'Target Coverage'}
                                </span>
                                <span
                                    className='text-xl font-semibold'
                                    style={{
                                        color: getScoreColor(hoveredState.score ?? null)
                                    }}
                                >
                                    {hoveredState.score == null ? 'Unrated' : chargerFilters.opportunityMode
                                        ? `${hoveredState.score}% gap` : `${hoveredState.score}% of target`}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SupportBanner />

            {/* --- LEGEND --- */}
            <div data-map-controls className='absolute left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 z-10 w-[300px] max-w-[calc(100vw-2rem)] md:max-h-[calc(100dvh-10rem)] flex flex-col items-start gap-3'
                style={{ bottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
                <div data-map-filters className='hidden md:block min-h-0 overflow-y-auto max-w-full shrink'>
                    <MapFilters filters={chargerFilters} onFilterChange={setChargerFilters} />
                </div>
                <div data-map-legend className='hud-panel rounded-2xl px-5 py-3 w-full shrink-0'>
                    <p className='text-[11px] text-center text-foreground/80 mb-2'>
                        {chargerFilters.opportunityMode ? '2030 projected gap · lower is better' : 'Current target coverage · higher is better'}
                    </p>
                    <div className='flex items-center justify-between gap-3 text-xs font-medium'>
                        {chargerFilters.opportunityMode ? <>
                            <span className='flex items-center gap-2'><span className='w-2 h-2 rounded-full bg-emerald-500' />0% gap</span>
                            <span className='flex items-center gap-2'><span className='w-2 h-2 rounded-full bg-amber-500' />50%</span>
                            <span className='flex items-center gap-2'><span className='w-2 h-2 rounded-full bg-red-500' />100% gap</span>
                        </> : <>
                            <span className='flex items-center gap-2'><span className='w-2 h-2 rounded-full bg-purple-900' />0% met</span>
                            <span className='flex items-center gap-2'><span className='w-2 h-2 rounded-full bg-blue-600' />50%</span>
                            <span className='flex items-center gap-2'><span className='w-2 h-2 rounded-full bg-emerald-600' />100% met</span>
                        </>}
                    </div>
                </div>
            </div>

            {loading && (
                <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50'>
                    <div className='w-12 h-12 border-2 border-neon-mid border-t-transparent rounded-full animate-spin shadow-[0_0_15px_var(--neon-mid)]'></div>
                </div>
            )}

            <ToastContainer messages={messages} onDismiss={dismissToast} />

            {/* Mobile Filters Modal */}
            {showMobileFilters && (
                <>
                    <div
                        className='fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden'
                        onClick={() => setShowMobileFilters(false)}
                    />
                    <MapFilters
                        filters={chargerFilters}
                        onFilterChange={setChargerFilters}
                        isMobile={true}
                        onClose={() => setShowMobileFilters(false)}
                    />
                </>
            )}
        </div>
    )
}
