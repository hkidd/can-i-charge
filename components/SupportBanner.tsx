'use client'

import { useState, useEffect } from 'react'

export default function SupportBanner() {
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        const dismissedAt = localStorage.getItem('support-banner-dismissed')
        if (dismissedAt) {
            const hours =
                (new Date().getTime() - new Date(dismissedAt).getTime()) /
                (1000 * 60 * 60)
            if (hours < 24) return
        }
        const timer = setTimeout(() => setVisible(true), 8000)
        return () => clearTimeout(timer)
    }, [])

    const handleDismiss = () => {
        setVisible(false)
        localStorage.setItem(
            'support-banner-dismissed',
            new Date().toISOString()
        )
    }

    if (!visible) return null

    return (
        <div className='fixed bottom-24 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4 animate-slide-up'>
            <div className='hud-panel rounded-2xl p-6 relative animate-slide-up backdrop-blur-xl'>
                {/* Close X */}
                <button
                    onClick={handleDismiss}
                    className='absolute top-3 right-3 w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-foreground/40 hover:text-foreground'
                >
                    <svg
                        className='w-3 h-3'
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

                <div className='flex gap-5'>
                    {/* Animated Icon */}
                    <div className='hidden sm:flex w-12 h-12 rounded-full bg-gradient-to-br from-neon-mid to-blue-600 items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]'>
                        <svg
                            className='w-6 h-6 text-white'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                        >
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z'
                            />
                        </svg>
                    </div>

                    <div className='flex-1'>
                        <h3 className='text-lg font-bold text-foreground mb-1'>
                            Enjoying Can I Charge?
                        </h3>
                        <p className='text-sm text-foreground/60 mb-4 leading-relaxed font-light'>
                            I&apos;m committed to keeping this tool{' '}
                            <span className='text-foreground font-medium'>
                                free and ad-free
                            </span>
                            . Your support would mean the world to help maintain
                            and improve the service. Thanks!
                        </p>

                        <div className='flex gap-3'>
                            <a
                                href='https://buymeacoffee.com/harrisonkidd'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='flex-1 sm:flex-none px-5 py-2.5 bg-[#FFDD00] text-black font-bold text-sm rounded-lg hover:shadow-[0_0_15px_rgba(255,221,0,0.4)] transition-all text-center'
                            >
                                ☕ Buy me a coffee
                            </a>
                            <button
                                onClick={handleDismiss}
                                className='px-5 py-2.5 bg-white/5 border border-white/10 text-foreground/60 text-sm rounded-lg hover:bg-white/10 hover:text-foreground transition-colors'
                            >
                                Maybe later
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
