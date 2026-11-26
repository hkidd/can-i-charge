'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import ScoreCard from './ScoreCard'
import type { EVScoreResponse } from '@/lib/api-validation'
import { Button } from '@/components/landing'

const EXAMPLE_LOCATIONS = [
    'Austin, TX',
    '90210',
    'Seattle, WA',
    'Brooklyn, NY',
    'Miami Beach, FL',
    'Denver, CO',
    'San Francisco, CA',
    '60601'
]

interface AddressSuggestion {
    place_name: string
    text: string
    center: [number, number]
    place_type: string[]
}

interface AddressSearchProps {
    onLocationSelect?: (lng: number, lat: number, address: string) => void
    onScoreResult?: (data: EVScoreResponse) => void
    showButton?: boolean
    buttonText?: string
    showAnimatedPlaceholder?: boolean
    showScoreCard?: boolean
    variant?: 'default' | 'hero'
    className?: string
}

export default function AddressSearch({
    onLocationSelect,
    onScoreResult,
    showButton = false,
    buttonText = 'Get Score',
    showAnimatedPlaceholder = false,
    showScoreCard: showScoreCardProp = true,
    variant = 'default',
    className = ''
}: AddressSearchProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const suggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const suggestionRequest = useRef<AbortController | null>(null)
    const scoreRequest = useRef<AbortController | null>(null)
    const [scoreData, setScoreData] = useState<EVScoreResponse | null>(null)
    const [showScoreCard, setShowScoreCard] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [placeholderIndex, setPlaceholderIndex] = useState(0)

    // Rotate placeholder examples
    useEffect(() => {
        if (!showAnimatedPlaceholder || searchQuery || isTyping) return

        const interval = setInterval(() => {
            setPlaceholderIndex((prev) => (prev + 1) % EXAMPLE_LOCATIONS.length)
        }, 3000)

        return () => clearInterval(interval)
    }, [showAnimatedPlaceholder, searchQuery, isTyping])

    const cancelSuggestions = useCallback(() => {
        if (suggestionTimer.current) clearTimeout(suggestionTimer.current)
        suggestionRequest.current?.abort()
    }, [])

    useEffect(() => () => {
        cancelSuggestions()
        scoreRequest.current?.abort()
    }, [cancelSuggestions])

    const scheduleSuggestions = (query: string) => {
        cancelSuggestions()
        scoreRequest.current?.abort()
        setSuggestions([])
        setLoading(false)
        setError('')
        if (query.trim().length < 3) return

        const controller = new AbortController()
        suggestionRequest.current = controller
        suggestionTimer.current = setTimeout(async () => {
            setLoading(true)
            try {
                const response = await fetch(
                    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
                    `access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&country=US&types=address,place,postcode&limit=5`,
                    { signal: controller.signal }
                )
                if (!response.ok) throw new Error('Address lookup failed')
                const data = await response.json()
                if (!controller.signal.aborted) setSuggestions(data.features || [])
            } catch {
                if (!controller.signal.aborted) setError('Address lookup is unavailable. Please try again.')
            } finally {
                if (!controller.signal.aborted) setLoading(false)
            }
        }, 250)
    }

    const handleSelectLocation = async (feature: AddressSuggestion) => {
        const [lng, lat] = feature.center
        const address = feature.place_name
        cancelSuggestions()
        scoreRequest.current?.abort()
        const controller = new AbortController()
        scoreRequest.current = controller
        setError('')

        setSuggestions([])
        setSearchQuery(address)

        // Notify parent of location selection
        onLocationSelect?.(lng, lat, address)

        // Fetch EV score
        setLoading(true)
        try {
            const response = await fetch(
                `/api/ev-score?lat=${lat}&lng=${lng}&address=${encodeURIComponent(
                    address
                )}`, { signal: controller.signal }
            )

            if (!response.ok) throw new Error('Failed to fetch score')

            const data = await response.json()
            if (controller.signal.aborted) return
            setScoreData(data)

            if (showScoreCardProp) {
                setShowScoreCard(true)
            }

            onScoreResult?.(data)
        } catch {
            if (!controller.signal.aborted) setError('Unable to load the score. Please try again.')
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!searchQuery.trim()) return

        // If there are suggestions, select the first one
        if (suggestions.length > 0) {
            handleSelectLocation(suggestions[0])
            return
        }

        // Otherwise, geocode the query directly.
        cancelSuggestions()
        scoreRequest.current?.abort()
        const controller = new AbortController()
        scoreRequest.current = controller
        setError('')
        setLoading(true)
        try {
            const response = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                    searchQuery
                )}.json?` +
                    `access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&` +
                    `country=US&` +
                    `types=address,place,postcode&` +
                    `limit=1`, { signal: controller.signal }
            )
            if (!response.ok) throw new Error('Address lookup failed')
            const data = await response.json()
            if (controller.signal.aborted) return
            if (data.features?.[0]) await handleSelectLocation(data.features[0])
            else setError('No matching address found.')
        } catch {
            if (!controller.signal.aborted) setError('Address lookup is unavailable. Please try again.')
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }

    const getPlaceTypeLabel = (type: string) => {
        switch (type) {
            case 'address': return 'Address'
            case 'place': return 'City'
            case 'postcode': return 'ZIP'
            default: return 'Location'
        }
    }

    const isHero = variant === 'hero'

    return (
        <>
            <form
                onSubmit={handleSubmit}
                className={`relative ${isHero ? 'flex flex-col sm:flex-row gap-4 max-w-xl mx-auto' : 'w-full max-w-md'} ${className}`}
            >
                <div className={`relative ${isHero ? 'flex-1' : 'w-full'} group`}>
                    {/* Search Icon (only for non-hero variant) */}
                    {!isHero && (
                        <div className='absolute left-4 top-1/2 -translate-y-1/2 text-white/40 transition-colors group-focus-within:text-blue-400 z-10'>
                            <Search className='w-5 h-5' />
                        </div>
                    )}

                    <input
                        type='text'
                        aria-label='Search address or ZIP code'
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value)
                            scheduleSuggestions(e.target.value)
                        }}
                        onKeyDown={(event) => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) void handleSubmit(event) }}
                        onFocus={() => setIsTyping(true)}
                        onBlur={() => {
                            setIsTyping(false)
                            // Delay hiding suggestions to allow click
                            setTimeout(() => {
                                if (!document.activeElement?.closest('.suggestions-dropdown')) {
                                    setSuggestions([])
                                }
                            }, 200)
                        }}
                        placeholder={showAnimatedPlaceholder ? '' : 'Search address or ZIP code...'}
                        className={`
                            w-full py-4
                            bg-black/60 backdrop-blur-xl
                            border border-white/20 rounded-full
                            text-white placeholder-white/40
                            transition-all duration-200
                            focus:outline-none
                            focus:border-blue-500/60
                            focus:bg-black/70
                            focus:shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)]
                            ${isHero ? 'px-6' : 'pl-12 pr-12 text-sm'}
                        `}
                    />

                    {/* Animated placeholder for hero */}
                    {showAnimatedPlaceholder && !searchQuery && !isTyping && (
                        <div className='absolute inset-0 flex items-center px-6 pointer-events-none'>
                            <span className='text-white/40'>Try </span>
                            <AnimatePresence mode='wait'>
                                <motion.span
                                    key={placeholderIndex}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                    className='text-blue-400/70 ml-1'
                                >
                                    {EXAMPLE_LOCATIONS[placeholderIndex]}
                                </motion.span>
                            </AnimatePresence>
                        </div>
                    )}

                    {/* Loading Spinner */}
                    {loading && !isHero && (
                        <div className='absolute right-4 top-1/2 -translate-y-1/2'>
                            <div className='w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin'></div>
                        </div>
                    )}

                    {/* Clear Button (non-hero only) */}
                    {!loading && !isHero && searchQuery && (
                        <button
                            type='button'
                            aria-label='Clear location'
                            onClick={() => {
                                cancelSuggestions()
                                scoreRequest.current?.abort()
                                setLoading(false)
                                setError('')
                                setSearchQuery('')
                                setSuggestions([])
                            }}
                            className='absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors'
                        >
                            <X className='w-5 h-5' />
                        </button>
                    )}

                    {/* Suggestions Dropdown */}
                    {suggestions.length > 0 && (
                        <div className={`suggestions-dropdown ${isHero ? 'relative sm:absolute sm:top-full' : 'absolute top-full'} mt-2 w-full bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden z-50 shadow-xl`}>
                            {suggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    type='button'
                                    onClick={() => handleSelectLocation(suggestion)}
                                    className='w-full px-4 py-3 text-left transition-all border-b border-white/5 last:border-b-0 hover:bg-white/5 group/item'
                                >
                                    <div className='flex items-center gap-3'>
                                        <div className='w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0'>
                                            <MapPin className='w-4 h-4 text-blue-400' />
                                        </div>
                                        <div className='flex-1 min-w-0'>
                                            <div className='flex items-center justify-between gap-2'>
                                                <span className='text-white text-sm font-medium truncate group-hover/item:text-blue-400 transition-colors'>
                                                    {suggestion.text}
                                                </span>
                                                <span className='text-[10px] uppercase tracking-wider text-white/30 bg-white/5 px-2 py-0.5 rounded-full flex-shrink-0'>
                                                    {getPlaceTypeLabel(suggestion.place_type?.[0])}
                                                </span>
                                            </div>
                                            <div className='text-white/50 text-xs truncate mt-0.5'>
                                                {suggestion.place_name}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Submit Button (hero variant) */}
                {showButton && (
                    <Button type='submit' variant='primary' size='lg' disabled={loading}>
                        {loading ? 'Loading...' : buttonText}
                    </Button>
                )}
            </form>
            {error && <p role='alert' className='mt-2 text-sm text-red-400'>{error}</p>}

            {showScoreCardProp && showScoreCard && scoreData && (
                <ScoreCard
                    data={scoreData}
                    onClose={() => setShowScoreCard(false)}
                />
            )}
        </>
    )
}
