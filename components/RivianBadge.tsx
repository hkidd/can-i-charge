'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

export default function RivianBadge() {
    const [isVisible, setIsVisible] = useState(false)
    const [isDismissed, setIsDismissed] = useState(() => {
        // Initialize state from sessionStorage
        if (typeof window !== 'undefined') {
            return !!sessionStorage.getItem('rivian-badge-dismissed')
        }
        return false
    })

    useEffect(() => {
        // Don't show timer if already dismissed
        if (isDismissed) return

        // Show badge after 4 seconds
        const timer = setTimeout(() => {
            setIsVisible(true)
        }, 4000)

        return () => clearTimeout(timer)
    }, [isDismissed])

    const handleDismiss = () => {
        setIsVisible(false)
        setIsDismissed(true)
        sessionStorage.setItem('rivian-badge-dismissed', 'true')
    }

    if (isDismissed || !isVisible) return null

    return (
        <div
            className={`fixed bottom-20 right-4 z-50 transition-all duration-500 ease-in-out transform ${
                isVisible
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-4 opacity-0'
            }`}
        >
            <div className='relative'>
                {/* Dismiss button */}
                <button
                    onClick={handleDismiss}
                    className='absolute -top-2 -right-2 w-6 h-6 bg-black/80 hover:bg-black/90 rounded-full flex items-center justify-center text-white/60 hover:text-white/80 transition-colors z-10 text-xs'
                    title='Dismiss'
                >
                    ×
                </button>

                {/* Main badge */}
                <Link
                    href='https://rivian.com/configurations/list?reprCode=HARRISON19045910'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='block group'
                >
                    <div className='bg-gradient-to-r from-emerald-600/90 to-teal-600/90 backdrop-blur-md rounded-2xl px-4 py-3 shadow-lg border border-emerald-500/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 hover:scale-105'>
                        <div className='flex items-center gap-3'>
                            {/* Compass icon */}
                            <div className='w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0'>
                                <svg
                                    className='w-4 h-4 text-white'
                                    fill='none'
                                    stroke='currentColor'
                                    viewBox='0 0 24 24'
                                >
                                    <circle cx='12' cy='12' r='10' />
                                    <polygon points='16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88' />
                                </svg>
                            </div>

                            <div className='text-white'>
                                <div className='font-semibold text-sm leading-tight'>
                                    Interested in a Rivian EV?
                                </div>
                                <div className='text-emerald-100/70 text-xs font-medium'>
                                    Get referral rewards
                                </div>
                            </div>

                            {/* Arrow icon */}
                            <svg
                                className='w-4 h-4 text-white/60 group-hover:text-white/80 transition-colors'
                                fill='none'
                                stroke='currentColor'
                                viewBox='0 0 24 24'
                            >
                                <path
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                    strokeWidth={2}
                                    d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                                />
                            </svg>
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    )
}
