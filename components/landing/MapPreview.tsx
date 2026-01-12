'use client'

import { motion } from 'framer-motion'

// Simplified US state paths for preview (major states only for visual effect)
const STATE_PATHS = [
    // California
    { d: 'M95,180 L85,280 L100,320 L120,300 L115,200 Z', score: 78 },
    // Texas
    { d: 'M220,280 L180,320 L200,380 L280,380 L300,320 L280,280 Z', score: 52 },
    // Florida
    { d: 'M420,340 L440,320 L480,350 L460,400 L420,380 Z', score: 65 },
    // New York
    { d: 'M480,140 L500,120 L520,140 L510,170 L480,160 Z', score: 85 },
    // Washington
    { d: 'M80,60 L120,50 L140,80 L100,100 Z', score: 82 },
    // Colorado
    { d: 'M180,180 L240,180 L240,230 L180,230 Z', score: 58 },
    // Arizona
    { d: 'M120,240 L170,240 L170,300 L120,300 Z', score: 45 },
    // Nevada
    { d: 'M100,140 L130,140 L120,220 L90,220 Z', score: 55 },
    // Oregon
    { d: 'M70,80 L120,80 L110,130 L60,130 Z', score: 72 },
    // Michigan
    { d: 'M380,100 L420,90 L430,140 L390,150 Z', score: 48 },
    // Illinois
    { d: 'M360,160 L380,160 L385,220 L355,220 Z', score: 62 },
    // Pennsylvania
    { d: 'M450,150 L490,145 L495,175 L455,180 Z', score: 58 },
    // Ohio
    { d: 'M410,160 L445,155 L450,195 L415,200 Z', score: 52 },
    // Georgia
    { d: 'M420,260 L460,255 L465,310 L425,315 Z', score: 55 },
    // North Carolina
    { d: 'M440,230 L510,220 L515,250 L445,260 Z', score: 48 },
    // Virginia
    { d: 'M450,200 L500,190 L510,215 L460,225 Z', score: 60 },
    // Massachusetts
    { d: 'M510,125 L540,120 L545,135 L515,140 Z', score: 88 },
    // Minnesota
    { d: 'M300,80 L340,75 L345,130 L305,135 Z', score: 45 },
    // Wisconsin
    { d: 'M340,100 L375,95 L380,145 L345,150 Z', score: 42 },
    // Missouri
    { d: 'M310,200 L360,195 L365,250 L315,255 Z', score: 38 },
    // Tennessee
    { d: 'M360,240 L430,235 L435,265 L365,270 Z', score: 42 },
    // Indiana
    { d: 'M380,170 L410,168 L415,215 L385,218 Z', score: 45 },
    // Utah
    { d: 'M140,160 L175,160 L175,220 L140,220 Z', score: 52 },
    // New Mexico
    { d: 'M160,260 L210,260 L210,330 L160,330 Z', score: 35 },
]

const getScoreColor = (score: number) => {
    if (score >= 75) return '#10b981' // Emerald
    if (score >= 50) return '#06b6d4' // Cyan
    return '#6366f1' // Indigo
}

export default function MapPreview() {
    return (
        <div className="relative w-full h-full bg-[#0a0a0f] rounded-3xl overflow-hidden">
            {/* Map SVG */}
            <svg
                viewBox="0 0 600 420"
                className="w-full h-full"
                preserveAspectRatio="xMidYMid meet"
            >
                {/* Background grid pattern */}
                <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />

                {/* State shapes */}
                {STATE_PATHS.map((state, i) => (
                    <motion.path
                        key={i}
                        d={state.d}
                        fill={getScoreColor(state.score)}
                        fillOpacity={0.4 + (state.score / 200)}
                        stroke={getScoreColor(state.score)}
                        strokeWidth="1"
                        strokeOpacity="0.6"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + i * 0.02, duration: 0.5 }}
                    />
                ))}

                {/* Glow effects for high-score areas */}
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                        <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
            </svg>

            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-[#0a0a0f]/50" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f]/30 via-transparent to-[#0a0a0f]/30" />

            {/* HUD Elements */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                <div className="bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 text-white/50 text-sm font-medium">
                    Search any address...
                </div>
                <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                    <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
            </div>

            {/* Legend */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <div className="bg-white/10 backdrop-blur-sm rounded-full px-6 py-2.5 flex items-center gap-5 text-xs font-medium">
                    <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />
                        <span className="text-white/70">Excellent</span>
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]" />
                        <span className="text-white/70">Good</span>
                    </span>
                    <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_#6366f1]" />
                        <span className="text-white/70">Poor</span>
                    </span>
                </div>
            </div>
        </div>
    )
}
