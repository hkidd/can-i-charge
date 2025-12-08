'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import AddressSearch from './AddressSearch'
import dynamic from 'next/dynamic'

const AboutModal = dynamic(() => import('./AboutModal'), { ssr: false })
import SupportBanner from './SupportBanner'
import {
    loadStatePolygons,
    loadCountyPolygons,
    loadZipPolygons,
    loadChargerPoints
} from '@/lib/map-data-loader'
import MapFilters from './MapFilters'
import type { HoveredData } from '@/types'
import { ToastContainer, useToast } from './Toast'

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

export default function Map() {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<mapboxgl.Map | null>(null)
    const [loading, setLoading] = useState(true)
    const [showAbout, setShowAbout] = useState(false)
    const [hoveredState, setHoveredState] = useState<HoveredData | null>(null)
    const [chargerFilters, setChargerFilters] = useState({
        showDCFast: true,
        showLevel2: true,
        showLevel1: false,
        showTesla: true,
        showCCS: true,
        opportunityMode: false,
        usePortWeighting: true
    })
    const chargerFiltersRef = useRef(chargerFilters)
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const { messages, showError, dismissToast } = useToast()

    useEffect(() => {
        chargerFiltersRef.current = chargerFilters
    }, [chargerFilters])

    // ... [Keep your existing setupInteractions and loadMapData functions exactly as they are] ...
    const setupInteractions = useCallback((layerType: string) => {
        if (!map.current) return
        const layerId =
            layerType === 'polygon' ? 'region-fills' : 'charger-points'

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
                    population: feature.properties?.population
                })
            }
        })
        // ... keep mobile click handlers ...
    }, [])

    const loadMapData = useCallback(async () => {
        if (!map.current) return

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
    }, [])

    // Initialize map
    useEffect(() => {
        if (map.current) return

        try {
            // FORCE DARK MODE for the futuristic aesthetic
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

            map.current.on('moveend', async () => {
                try {
                    await loadMapData()
                } catch (error) {
                    console.error('Failed to update map data:', error)
                    // Don't show error for move events to avoid spam
                }
            })

            map.current.on('zoomend', async () => {
                try {
                    await loadMapData()
                } catch (error) {
                    console.error('Failed to update map data:', error)
                    // Don't show error for zoom events to avoid spam
                }
            })

            return () => map.current?.remove()
        } catch (error) {
            console.error('Failed to initialize map:', error)
            showError('Failed to initialize map. Please check your connection.')
        }
    }, [loadMapData])

    const isInitialMount = useRef(true)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false
            return
        }
        if (!map.current || !map.current.isStyleLoaded()) return
        const timer = setTimeout(() => {
            if (map.current && map.current.getSource('regions')) {
                loadMapData()
            }
        }, 100)
        return () => clearTimeout(timer)
    }, [chargerFilters])

    const handleLocationSelect = (lng: number, lat: number) => {
        if (map.current) {
            map.current.flyTo({ center: [lng, lat], zoom: 12, duration: 2000 })
        }
    }

    // --- NEW COLOR LOGIC (Energy Spectrum) ---
    const getScoreColor = (score: number) => {
        if (score >= 80) return 'var(--neon-high)' // Green/Emerald
        if (score >= 50) return 'var(--neon-mid)' // Cyan
        return 'var(--neon-low)' // Indigo/Purple
    }

    return (
        <div className='relative w-full h-screen bg-background overflow-hidden'>
            <div ref={mapContainer} className='w-full h-full' />

            {/* Top Controls */}
            <div className='absolute top-4 left-4 right-4 z-10 flex flex-col gap-3'>
                {/* Centered search with side buttons */}
                <div className='relative flex items-center'>
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
                        <div className='pl-14 pr-16 md:px-0'>
                            <AddressSearch
                                onLocationSelect={handleLocationSelect}
                            />
                        </div>
                    </div>

                    {/* Info Button - Right Side */}
                    <button
                        onClick={() => setShowAbout(true)}
                        className='absolute right-0 w-12 h-12 md:w-14 md:h-14 rounded-full hud-panel flex items-center justify-center text-foreground hover:text-neon-mid transition-colors z-20'
                    >
                        <svg
                            className='w-6 h-6'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                        >
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                            />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Filter Controls - Desktop Only */}
            <div className='hidden md:block absolute bottom-24 left-4 z-10'>
                <MapFilters
                    filters={chargerFilters}
                    onFilterChange={setChargerFilters}
                />
            </div>

            {/* --- FUTURISTIC HOVER CARD --- */}
            {hoveredState && (
                <div className='absolute top-24 right-4 md:right-8 pointer-events-none z-20'>
                    <div className='hud-panel rounded-2xl p-5 min-w-[280px] md:min-w-[320px] animate-slide-in backdrop-blur-xl'>
                        {/* Header: Region Name */}
                        <h2 className='text-2xl font-bold text-foreground mb-1 tracking-tight'>
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
                                        ? 'Opportunity Score'
                                        : 'EV Readiness'}
                                </span>
                                <span
                                    className='text-4xl font-bold'
                                    style={{
                                        color: getScoreColor(
                                            hoveredState.score || 0
                                        )
                                    }}
                                >
                                    {hoveredState.score}
                                </span>
                            </div>
                            {/* Visual Progress Bar */}
                            <div className='w-full h-1.5 bg-white/10 rounded-full overflow-hidden'>
                                <div
                                    className='h-full transition-all duration-500 ease-out shadow-[0_0_10px_currentColor]'
                                    style={{
                                        width: `${hoveredState.score}%`,
                                        backgroundColor: getScoreColor(
                                            hoveredState.score || 0
                                        )
                                    }}
                                />
                            </div>
                        </div>

                        {/* Data Grid */}
                        <div className='grid grid-cols-2 gap-4 border-t border-white/10 pt-4'>
                            <div>
                                <span className='text-[10px] font-mono text-foreground/50 uppercase block mb-1'>
                                    {chargerFilters.usePortWeighting
                                        ? 'Ports'
                                        : 'Stations'}
                                </span>
                                <span className='text-xl font-semibold text-foreground'>
                                    {hoveredState.filtered_charger_count ||
                                        hoveredState.charger_count ||
                                        0}
                                </span>
                            </div>

                            <div>
                                <span className='text-[10px] font-mono text-foreground/50 uppercase block mb-1'>
                                    Service Level
                                </span>
                                <span
                                    className='text-xl font-semibold'
                                    style={{
                                        color:
                                            (hoveredState.score || 0) >= 80
                                                ? '#10b981' // Neon Emerald
                                                : (hoveredState.score || 0) >=
                                                  60
                                                ? '#06b6d4' // Cyan
                                                : (hoveredState.score || 0) >=
                                                  40
                                                ? '#2563eb' // Royal Blue
                                                : '#4c1d95' // Lighter Violet
                                    }}
                                >
                                    {(hoveredState.score || 0) >= 80
                                        ? 'Excellent'
                                        : (hoveredState.score || 0) >= 60
                                        ? 'Good'
                                        : (hoveredState.score || 0) >= 40
                                        ? 'Fair'
                                        : hoveredState.population &&
                                          hoveredState.population < 10000
                                        ? 'Rural'
                                        : 'Poor'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SupportBanner />

            {/* --- LEGEND (UPDATED TO SPECTRUM) --- */}
            <div className='absolute bottom-8 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 z-10 w-[260px]'>
                <div className='hud-panel rounded-full px-6 py-3'>
                    <div className='flex items-center gap-6 text-xs font-medium'>
                        <div className='flex items-center gap-2'>
                            <div
                                className={`w-2 h-2 rounded-full ${
                                    chargerFilters.opportunityMode
                                        ? 'bg-yellow-400 shadow-[0_0_8px_rgb(251,191,36)]'
                                        : 'bg-neon-high shadow-[0_0_8px_var(--neon-high)]'
                                }`}
                            ></div>
                            <span className='text-foreground/90'>
                                {chargerFilters.opportunityMode
                                    ? 'High Opportunity'
                                    : 'Excellent'}
                            </span>
                        </div>
                        <div className='flex items-center gap-2'>
                            <div
                                className={`w-2 h-2 rounded-full ${
                                    chargerFilters.opportunityMode
                                        ? 'bg-orange-400 shadow-[0_0_8px_rgb(251,146,60)]'
                                        : 'bg-neon-mid shadow-[0_0_8px_var(--neon-mid)]'
                                }`}
                            ></div>
                            <span className='text-foreground/90'>
                                {chargerFilters.opportunityMode
                                    ? 'Med Opportunity'
                                    : 'Good'}
                            </span>
                        </div>
                        <div className='flex items-center gap-2'>
                            <div
                                className={`w-2 h-2 rounded-full ${
                                    chargerFilters.opportunityMode
                                        ? 'bg-red-400 shadow-[0_0_8px_rgb(248,113,113)]'
                                        : 'bg-neon-low shadow-[0_0_8px_var(--neon-low)]'
                                }`}
                            ></div>
                            <span className='text-foreground/90'>
                                {chargerFilters.opportunityMode
                                    ? 'Low Opportunity'
                                    : 'Poor'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {loading && (
                <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50'>
                    <div className='w-12 h-12 border-2 border-neon-mid border-t-transparent rounded-full animate-spin shadow-[0_0_15px_var(--neon-mid)]'></div>
                </div>
            )}

            <AboutModal
                isOpen={showAbout}
                onClose={() => setShowAbout(false)}
            />
            <ToastContainer messages={messages} onDismiss={dismissToast} />

            {/* Mobile Filters Modal Logic (unchanged structure, just styling) */}
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
