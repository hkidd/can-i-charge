'use client'

import { useState } from 'react'
import { getScoreLabel } from '@/lib/map-utils'

interface ScoreCardProps {
    data: {
        address: string
        score: number
        region: { name: string; type: string; population: number }
        chargers: {
            within_1_mile: number
            within_5_miles: number
            within_10_miles: number
            dcfast_count: number
            level2_count: number
            level1_count: number
            total: number
            nearest: {
                name: string
                distance: number
                type: string
                address: string
            } | null
        }
    }
    onClose: () => void
}

export default function ScoreCard({ data, onClose }: ScoreCardProps) {
    const [showDCFast, setShowDCFast] = useState(false)
    
    const getNeonColorVar = (s: number) => {
        if (s >= 80) return 'var(--neon-high)'
        if (s >= 60) return 'var(--neon-mid)' // Adjusted threshold slightly
        return 'var(--neon-low)'
    }

    const scoreColor = getNeonColorVar(data.score)
    const scoreLabel = getScoreLabel(data.score)

    // SVG Math
    const radius = 65 // Increased radius slightly for breathing room
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (data.score / 100) * circumference

    const handleShare = async () => {
        const shareData = {
            title: 'Can I Charge?',
            text: `${data.address} has an EV Readiness Score of ${data.score}. Check it out:`,
            url: window.location.href
        }

        if (navigator.share) {
            try {
                await navigator.share(shareData)
            } catch (err) {
                console.log('Share cancelled')
            }
        } else {
            // Fallback: Copy to clipboard
            navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`)
            // You could trigger a small "Copied!" toast here
        }
    }

    return (
        <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-slide-up'>
            <div className='hud-panel max-w-md w-full max-h-[90vh] overflow-y-auto rounded-3xl relative border border-white/10 shadow-2xl'>
                {/* Header */}
                <div className='sticky top-0 bg-[#09090b]/95 backdrop-blur-xl border-b border-white/5 p-6 flex items-start justify-between z-10'>
                    <div className='flex-1 pr-4'>
                        <div className='flex items-center gap-2 mb-3'>
                            <span className='px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-white/5 text-white/50 tracking-widest border border-white/5'>
                                Analysis Complete
                            </span>
                        </div>
                        <h2 className='text-lg font-bold leading-snug text-white mb-1.5'>
                            {data.address}
                        </h2>
                        <p className='text-xs font-mono text-white/40 uppercase tracking-wide'>
                            {data.region.name} {/* // */} SERVICE:{' '}
                            <span
                                className='font-semibold'
                                style={{
                                    color:
                                        data.score >= 80
                                            ? '#10b981' // Neon Emerald
                                            : data.score >= 60
                                            ? '#06b6d4' // Cyan
                                            : data.score >= 40
                                            ? '#2563eb' // Royal Blue
                                            : '#4c1d95' // Lighter Violet
                                }}
                            >
                                {data.score >= 80
                                    ? 'EXCELLENT'
                                    : data.score >= 60
                                    ? 'GOOD'
                                    : data.score >= 40
                                    ? 'FAIR'
                                    : data.region.population < 10000
                                    ? 'RURAL'
                                    : 'POOR'}
                            </span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className='group w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all'
                    >
                        <svg
                            className='w-4 h-4 text-white/50 group-hover:text-white'
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
                </div>

                <div className='p-6 space-y-8'>
                    {/* HERO: Score Reactor */}
                    <div className='flex flex-col items-center justify-center py-2'>
                        <div className='relative w-48 h-48 flex items-center justify-center'>
                            {/* Ambient Glow behind the ring */}
                            <div
                                className='absolute inset-0 rounded-full blur-3xl opacity-10'
                                style={{ backgroundColor: scoreColor }}
                            ></div>

                            <svg className='w-full h-full rotate-[-90deg] relative z-10'>
                                <circle
                                    cx='50%'
                                    cy='50%'
                                    r={radius}
                                    fill='none'
                                    stroke='currentColor'
                                    strokeWidth='4'
                                    className='text-white/5'
                                />
                                <circle
                                    cx='50%'
                                    cy='50%'
                                    r={radius}
                                    fill='none'
                                    stroke={scoreColor}
                                    strokeWidth='4'
                                    strokeLinecap='round'
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    className='transition-all duration-1000 ease-out'
                                    style={{
                                        filter: `drop-shadow(0 0 8px ${scoreColor})`
                                    }}
                                />
                            </svg>

                            <div className='absolute inset-0 flex flex-col items-center justify-center'>
                                <span
                                    className='text-6xl font-bold text-white tracking-tighter mb-1'
                                    style={{
                                        textShadow: `0 0 30px ${scoreColor}`
                                    }}
                                >
                                    {data.score}
                                </span>
                                <span className='text-[10px] font-mono text-white/40 uppercase tracking-widest'>
                                    EV Score
                                </span>
                            </div>
                        </div>

                        <div className='text-center -mt-4 relative z-20'>
                            <div className='text-2xl font-bold text-white tracking-wide mb-1'>
                                {scoreLabel}
                            </div>
                            <div className='text-xs text-white/50 font-mono uppercase tracking-wider'>
                                {data.score >= 60
                                    ? 'Optimal Coverage'
                                    : data.score >= 40
                                    ? 'Limited Coverage'
                                    : 'Critical Infrastructure Gap'}
                            </div>
                        </div>

                        <button
                            onClick={handleShare}
                            className='mt-4 w-full py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm font-mono uppercase tracking-widest text-white/60 hover:text-white transition-colors flex items-center justify-center gap-2'
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
                                    d='M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z'
                                />
                            </svg>
                            Share Data
                        </button>
                    </div>

                    {/* Proximity Grid */}
                    <div>
                        <div className='flex items-center justify-between mb-3'>
                            <div className='flex items-center gap-2 opacity-70'>
                                <div className='w-1 h-1 bg-white rounded-full'></div>
                                <h3 className='text-xs font-mono font-semibold text-white/70 uppercase tracking-widest'>
                                    Proximity Scan
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowDCFast(!showDCFast)}
                                className={`text-[9px] font-mono uppercase tracking-wider transition-all border px-2 py-1 rounded ${
                                    showDCFast
                                        ? 'text-[var(--neon-high)] border-[var(--neon-high)]/30 bg-[var(--neon-high)]/10'
                                        : 'text-white/40 hover:text-white/60 border-white/10 bg-white/5 hover:bg-white/10'
                                }`}
                            >
                                {showDCFast ? 'DC Fast Only' : 'All Stations'}
                            </button>
                        </div>

                        <div className='grid grid-cols-3 border border-white/10 rounded-xl bg-white/[0.02]'>
                            <div className='p-4 text-center border-r border-white/10'>
                                <div className='text-2xl font-bold text-white font-mono'>
                                    {showDCFast 
                                        ? Math.round((data.chargers.total > 0 ? (data.chargers.dcfast_count / data.chargers.total) : 0) * data.chargers.within_1_mile) 
                                        : data.chargers.within_1_mile}
                                </div>
                                <div className={`text-[8px] uppercase font-mono mt-0.5 ${
                                    showDCFast ? 'text-[var(--neon-high)]' : 'text-white/30'
                                }`}>
                                    {showDCFast ? 'DC Fast' : 'Stations'}
                                </div>
                                <div className='text-[9px] text-white/40 uppercase mt-1 font-mono'>
                                    1 Mile
                                </div>
                            </div>
                            <div className='p-4 text-center border-r border-white/10'>
                                <div className='text-2xl font-bold text-white font-mono'>
                                    {showDCFast 
                                        ? Math.round((data.chargers.total > 0 ? (data.chargers.dcfast_count / data.chargers.total) : 0) * data.chargers.within_5_miles) 
                                        : data.chargers.within_5_miles}
                                </div>
                                <div className={`text-[8px] uppercase font-mono mt-0.5 ${
                                    showDCFast ? 'text-[var(--neon-high)]' : 'text-white/30'
                                }`}>
                                    {showDCFast ? 'DC Fast' : 'Stations'}
                                </div>
                                <div className='text-[9px] text-white/40 uppercase mt-1 font-mono'>
                                    5 Miles
                                </div>
                            </div>
                            <div className='p-4 text-center'>
                                <div className='text-2xl font-bold text-white font-mono'>
                                    {showDCFast 
                                        ? Math.round((data.chargers.total > 0 ? (data.chargers.dcfast_count / data.chargers.total) : 0) * data.chargers.within_10_miles) 
                                        : data.chargers.within_10_miles}
                                </div>
                                <div className={`text-[8px] uppercase font-mono mt-0.5 ${
                                    showDCFast ? 'text-[var(--neon-high)]' : 'text-white/30'
                                }`}>
                                    {showDCFast ? 'DC Fast' : 'Stations'}
                                </div>
                                <div className='text-[9px] text-white/40 uppercase mt-1 font-mono'>
                                    10 Miles
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Nearest Station */}
                    {data.chargers.nearest && (
                        <div className='pt-4 border-t border-white/10'>
                            <div className='flex items-center gap-2 mb-3 opacity-70'>
                                <div className='w-1.5 h-1.5 bg-neon-mid rounded-full animate-pulse'></div>
                                <h3 className='text-xs font-mono font-semibold text-neon-mid uppercase tracking-widest'>
                                    Nearest Charger
                                </h3>
                            </div>
                            <div className='bg-gradient-to-r from-white/5 to-transparent rounded-xl p-4 border border-white/10'>
                                <div className='flex items-start justify-between mb-2'>
                                    <span className='font-bold text-white text-sm truncate pr-4'>
                                        {data.chargers.nearest.name}
                                    </span>
                                    <span className='text-xs font-mono font-bold text-neon-mid bg-neon-mid/10 px-2 py-1 rounded border border-neon-mid/20'>
                                        {data.chargers.nearest.distance.toFixed(
                                            1
                                        )}{' '}
                                        MI
                                    </span>
                                </div>
                                <div className='text-xs text-white/40 font-mono truncate'>
                                    {data.chargers.nearest.address}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Updated "Cyberpunk" Button */}
                    <button
                        onClick={onClose}
                        className='w-full py-4 rounded-xl font-bold tracking-widest text-sm uppercase transition-all
                        text-neon-mid border border-neon-mid/50 hover:bg-neon-mid/10 hover:border-neon-mid hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                    >
                        Acknowledge
                    </button>
                </div>
            </div>
        </div>
    )
}
