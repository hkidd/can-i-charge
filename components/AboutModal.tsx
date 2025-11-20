'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface AboutModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
    const [feedbackEmail, setFeedbackEmail] = useState('')
    const [feedbackMessage, setFeedbackMessage] = useState('')
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
    const [feedbackSuccess, setFeedbackSuccess] = useState(false)
    const [feedbackError, setFeedbackError] = useState('')

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }

        if (isOpen) {
            document.addEventListener('keydown', handleEscape)
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('keydown', handleEscape)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    const handleFeedbackSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFeedbackSubmitting(true)
        setFeedbackError('')
        setFeedbackSuccess(false)

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: feedbackEmail,
                    message: feedbackMessage
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to submit')

            setFeedbackSuccess(true)
            setFeedbackEmail('')
            setFeedbackMessage('')
            setTimeout(() => setFeedbackSuccess(false), 5000)
        } catch (err) {
            setFeedbackError(
                err instanceof Error ? err.message : 'Failed to submit feedback'
            )
        } finally {
            setFeedbackSubmitting(false)
        }
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className='fixed inset-0 bg-black/70 backdrop-blur-md z-[60]'
                onClick={onClose}
            />

            {/* Modal Drawer */}
            <div className='fixed inset-y-0 right-0 w-full md:w-[800px] bg-[#09090b] border-l border-white/10 z-[70] overflow-y-auto shadow-[-20px_0_40px_rgba(0,0,0,0.5)]'>
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className='fixed top-6 right-6 w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all hover:scale-110 z-50'
                >
                    <svg
                        className='w-5 h-5 text-white'
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

                {/* Content Container */}
                <div className='px-8 md:px-16 py-20'>
                    {/* Hero Section */}
                    <div className='mb-20'>
                        <div className='inline-flex items-center gap-2 mb-6 px-3 py-1 rounded text-[10px] font-mono uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20'>
                            About Project
                        </div>
                        <h1 className='text-5xl md:text-6xl font-bold text-white mb-6 tracking-tight'>
                            Can I Charge?
                        </h1>
                        <p className='text-xl text-white/60 leading-relaxed max-w-2xl font-light'>
                            Instant EV infrastructure scores for any US address.
                            Powered by real-time data from NREL and US Census.
                        </p>
                    </div>

                    {/* How We Score Section */}
                    <div className='mb-20'>
                        <h2 className='text-xs font-mono font-semibold text-white/40 uppercase tracking-widest mb-8 pl-1 border-l-2 border-cyan-500'>
                            How We Score EV Infrastructure
                        </h2>
                        <div className='p-8 rounded-3xl bg-gradient-to-br from-cyan-500/5 to-blue-500/5 border border-cyan-500/20 mb-8'>
                            <p className='text-white/70 text-lg leading-relaxed mb-6'>
                                Our scoring algorithm evaluates EV readiness by analyzing multiple data sources to provide comprehensive infrastructure assessments.
                            </p>
                            <div className='grid md:grid-cols-2 gap-6'>
                                {/* Population Density */}
                                <div className='flex items-start gap-4'>
                                    <div className='w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-400 flex-shrink-0'>
                                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className='text-white font-semibold mb-1'>Population Density</h4>
                                        <p className='text-white/50 text-sm'>US Census data determines potential EV demand</p>
                                    </div>
                                </div>

                                {/* Station Density */}
                                <div className='flex items-start gap-4'>
                                    <div className='w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 flex-shrink-0'>
                                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M13 10V3L4 14h7v7l9-11h-7z' />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className='text-white font-semibold mb-1'>Station & Port Density</h4>
                                        <p className='text-white/50 text-sm'>Both station count and total charging ports are weighted</p>
                                    </div>
                                </div>

                                {/* Traffic Patterns */}
                                <div className='flex items-start gap-4'>
                                    <div className='w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 flex-shrink-0'>
                                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className='text-white font-semibold mb-1'>Vehicle Miles Traveled</h4>
                                        <p className='text-white/50 text-sm'>Regional driving patterns indicate charging demand</p>
                                    </div>
                                </div>

                                {/* Charger Types */}
                                <div className='flex items-start gap-4'>
                                    <div className='w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400 flex-shrink-0'>
                                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 011-1h1a2 2 0 100-4H7a1 1 0 01-1-1V7a1 1 0 011-1h3a1 1 0 001-1V4z' />
                                        </svg>
                                    </div>
                                    <div>
                                        <h4 className='text-white font-semibold mb-1'>Connector Compatibility</h4>
                                        <p className='text-white/50 text-sm'>Tesla/NACS, CCS, J1772, and CHAdeMO availability</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Key Features */}
                    <div className='mb-20'>
                        <h2 className='text-xs font-mono font-semibold text-white/40 uppercase tracking-widest mb-8 pl-1 border-l-2 border-blue-500'>
                            Platform Features
                        </h2>
                        <div className='grid gap-6'>
                            {/* Real-time Data */}
                            <div className='p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-blue-500/30 transition-colors group'>
                                <div className='flex items-start gap-5'>
                                    <div className='w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform'>
                                        <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M13 10V3L4 14h7v7l9-11h-7z' />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className='text-lg font-bold text-white mb-2'>84,000+ Charging Stations</h3>
                                        <p className='text-sm text-white/50 leading-relaxed'>Comprehensive NREL database coverage across all 50 states, with daily updates for new installations and network changes.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Multi-level Analysis */}
                            <div className='p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-green-500/30 transition-colors group'>
                                <div className='flex items-start gap-5'>
                                    <div className='w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform'>
                                        <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className='text-lg font-bold text-white mb-2'>Multi-Scale Analysis</h3>
                                        <p className='text-sm text-white/50 leading-relaxed'>State, county, and ZIP code level aggregations provide insights from regional planning to neighborhood-specific EV readiness.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Opportunity Mode */}
                            <div className='p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-yellow-500/30 transition-colors group'>
                                <div className='flex items-start gap-5'>
                                    <div className='w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 group-hover:scale-110 transition-transform'>
                                        <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707' />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className='text-lg font-bold text-white mb-2'>Opportunity Mode</h3>
                                        <p className='text-sm text-white/50 leading-relaxed'>Identifies high-population areas with limited charging infrastructure - prime locations for new EV charging investments.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Support / Coffee */}
                    <div className='mb-20 p-8 rounded-3xl bg-gradient-to-br from-white/5 to-transparent border border-white/10 text-center relative overflow-hidden'>
                        <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 opacity-50'></div>

                        <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mx-auto mb-4'>
                            <svg
                                className='w-9 h-9 text-foreground'
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

                        <h3 className='text-2xl font-bold text-white mb-3'>
                            Keep Can I Charge? Free
                        </h3>
                        <p className='text-white/60 mb-8 max-w-md mx-auto font-light'>
                            Donations are not required, but it would allow me to
                            continue building and adding features that you find
                            useful. Thank you!
                        </p>

                        <Link
                            href='https://buymeacoffee.com/harrisonkidd'
                            target='_blank'
                            className='inline-flex items-center gap-3 px-8 py-4 bg-[#FFDD00] text-black rounded-xl font-bold hover:shadow-[0_0_20px_#FFDD00] transition-all transform hover:-translate-y-1'
                        >
                            <span>☕</span>
                            <span>Buy me a coffee</span>
                        </Link>
                    </div>

                    {/* Feedback Section */}
                    <div className='mb-8'>
                        <h2 className='text-2xl font-bold text-white mb-6'>
                            Share Your Feedback
                        </h2>

                        {feedbackSuccess && (
                            <div className='mb-6 p-4 rounded border border-green-500/30 bg-green-500/10 text-green-400 text-sm flex items-center gap-2'>
                                <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
                                </svg>
                                Thank you for your feedback! I read every message.
                            </div>
                        )}
                        {feedbackError && (
                            <div className='mb-6 p-4 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-sm'>
                                Error: {feedbackError}
                            </div>
                        )}

                        <form
                            onSubmit={handleFeedbackSubmit}
                            className='space-y-4'
                        >
                            <div>
                                <label
                                    htmlFor='email'
                                    className='block text-sm font-medium text-white/70 mb-2'
                                >
                                    Email (optional)
                                </label>
                                <input
                                    id='email'
                                    type='email'
                                    value={feedbackEmail}
                                    onChange={(e) =>
                                        setFeedbackEmail(e.target.value)
                                    }
                                    className='w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all'
                                    placeholder='your@email.com'
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor='feedback'
                                    className='block text-sm font-medium text-white/70 mb-2'
                                >
                                    What can I improve?
                                </label>
                                <textarea
                                    id='feedback'
                                    value={feedbackMessage}
                                    onChange={(e) =>
                                        setFeedbackMessage(e.target.value)
                                    }
                                    rows={4}
                                    maxLength={5000}
                                    required
                                    className='w-full px-4 py-3 rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/20 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all resize-none'
                                    placeholder='Share your thoughts, report issues, or suggest features...'
                                />
                            </div>

                            <button
                                type='submit'
                                disabled={
                                    feedbackSubmitting ||
                                    !feedbackMessage.trim()
                                }
                                className='w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20'
                            >
                                {feedbackSubmitting
                                    ? 'Sending...'
                                    : 'Send Feedback'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>
    )
}
