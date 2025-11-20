'use client'

import { useState } from 'react'
import ScoreCard from './ScoreCard'

interface AddressSearchProps {
    onLocationSelect: (lng: number, lat: number, address: string) => void
}

export default function AddressSearch({
    onLocationSelect
}: AddressSearchProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [suggestions, setSuggestions] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [scoreData, setScoreData] = useState<any>(null)
    const [showScoreCard, setShowScoreCard] = useState(false)

    const handleSearch = async (query: string) => {
        if (query.length < 3) {
            setSuggestions([])
            return
        }

        setLoading(true)

        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                    query
                )}.json?` +
                    `access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&` +
                    `country=US&` +
                    `types=address,place,postcode&` +
                    `limit=5`
            )

            const data = await response.json()
            setSuggestions(data.features || [])
        } catch (error) {
            console.error('Geocoding error:', error)
            setSuggestions([])
        } finally {
            setLoading(false)
        }
    }

    const handleSelectLocation = async (feature: any) => {
        const [lng, lat] = feature.center
        const address = feature.place_name

        setSuggestions([])
        setSearchQuery(address)

        // Fly map to location
        onLocationSelect(lng, lat, address)

        // Fetch EV score logic remains the same...
        setLoading(true)
        try {
            const response = await fetch(
                `/api/ev-score?lat=${lat}&lng=${lng}&address=${encodeURIComponent(
                    address
                )}`
            )

            if (!response.ok) throw new Error('Failed to fetch score')

            const data = await response.json()
            setScoreData(data)
            setShowScoreCard(true)
        } catch (error) {
            console.error('Error fetching EV score:', error)
            // In a real app, use a toast here instead of alert
            alert('Could not calculate EV score for this location')
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            <div className='relative max-w-2xl mx-auto group'>
                {/* Input Container */}
                <div className='relative'>
                    {/* Search Icon - Lights up on hover/focus */}
                    <div className='absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40 transition-colors group-focus-within:text-neon-mid'>
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
                                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
                            />
                        </svg>
                    </div>

                    <input
                        type='text'
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value)
                            handleSearch(e.target.value)
                        }}
                        placeholder='ENTER LOCATION OR ZIP CODE...'
                        className='
                            w-full pl-12 pr-12 py-4 
                            bg-black/40 backdrop-blur-md 
                            border border-white/10 rounded-2xl 
                            text-foreground placeholder-foreground/30 
                            font-mono text-sm tracking-wide
                            transition-all duration-300 ease-out
                            focus:outline-none 
                            focus:border-neon-mid/50 
                            focus:shadow-[0_0_20px_-5px_var(--neon-mid)]
                            focus:bg-black/60
                        '
                    />

                    {/* Loading Spinner (Neon Style) */}
                    {loading && (
                        <div className='absolute right-4 top-1/2 -translate-y-1/2'>
                            <div className='w-5 h-5 border-2 border-neon-mid border-t-transparent rounded-full animate-spin shadow-[0_0_10px_var(--neon-mid)]'></div>
                        </div>
                    )}

                    {/* Clear Button (Only shows when text exists and not loading) */}
                    {!loading && searchQuery && (
                        <button
                            onClick={() => {
                                setSearchQuery('')
                                setSuggestions([])
                            }}
                            className='absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground'
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
                                    d='M6 18L18 6M6 6l12 12'
                                />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Suggestions Dropdown - The "HUD" Style */}
                {suggestions.length > 0 && (
                    <div className='absolute top-full mt-2 w-full hud-panel rounded-xl overflow-hidden z-50 animate-slide-up'>
                        {suggestions.map((suggestion, index) => (
                            <button
                                key={index}
                                onClick={() => handleSelectLocation(suggestion)}
                                className='w-full px-6 py-3.5 text-left transition-all border-b border-white/5 last:border-b-0 hover:bg-white/5 group/item'
                            >
                                <div className='flex items-center justify-between'>
                                    <span className='text-foreground/90 text-sm font-medium group-hover/item:text-neon-mid transition-colors truncate pr-4'>
                                        {suggestion.text}
                                    </span>
                                    {/* Type Badge (e.g. "City" vs "Address") */}
                                    <span className='text-[10px] font-mono uppercase tracking-wider text-foreground/30 border border-white/10 px-1.5 py-0.5 rounded'>
                                        {suggestion.place_type?.[0] || 'LOC'}
                                    </span>
                                </div>
                                <div className='text-foreground/50 text-xs truncate mt-0.5 font-light'>
                                    {suggestion.place_name}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {showScoreCard && scoreData && (
                <ScoreCard
                    data={scoreData}
                    onClose={() => setShowScoreCard(false)}
                />
            )}
        </>
    )
}
