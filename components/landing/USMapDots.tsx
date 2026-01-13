'use client'

import { motion } from 'framer-motion'

// Simplified US map coordinates as dots (normalized 0-100 scale)
const US_DOTS = [
    // West Coast
    { x: 8, y: 25 },
    { x: 10, y: 30 },
    { x: 9, y: 35 },
    { x: 8, y: 40 },
    { x: 10, y: 45 },
    { x: 12, y: 50 },
    { x: 14, y: 55 },
    { x: 16, y: 60 },
    { x: 12, y: 35 },
    { x: 14, y: 40 },
    // Pacific Northwest
    { x: 12, y: 18 },
    { x: 15, y: 20 },
    { x: 18, y: 22 },
    { x: 14, y: 15 },
    // Mountain West
    { x: 20, y: 30 },
    { x: 22, y: 35 },
    { x: 25, y: 40 },
    { x: 28, y: 45 },
    { x: 18, y: 28 },
    { x: 24, y: 32 },
    { x: 26, y: 38 },
    { x: 30, y: 42 },
    { x: 22, y: 25 },
    { x: 20, y: 45 },
    // Southwest
    { x: 18, y: 55 },
    { x: 22, y: 58 },
    { x: 26, y: 55 },
    { x: 30, y: 52 },
    { x: 24, y: 62 },
    { x: 28, y: 60 },
    { x: 32, y: 58 },
    // Texas
    { x: 35, y: 55 },
    { x: 38, y: 58 },
    { x: 40, y: 62 },
    { x: 42, y: 65 },
    { x: 36, y: 62 },
    { x: 38, y: 68 },
    { x: 34, y: 60 },
    { x: 40, y: 55 },
    { x: 44, y: 60 },
    // Midwest
    { x: 35, y: 35 },
    { x: 38, y: 38 },
    { x: 42, y: 35 },
    { x: 45, y: 38 },
    { x: 48, y: 35 },
    { x: 40, y: 42 },
    { x: 44, y: 45 },
    { x: 48, y: 42 },
    { x: 52, y: 40 },
    { x: 50, y: 45 },
    { x: 36, y: 28 },
    { x: 40, y: 30 },
    { x: 44, y: 28 },
    { x: 48, y: 30 },
    { x: 52, y: 32 },
    // Great Lakes
    { x: 55, y: 28 },
    { x: 58, y: 25 },
    { x: 62, y: 28 },
    { x: 56, y: 32 },
    { x: 60, y: 30 },
    { x: 64, y: 32 },
    { x: 58, y: 35 },
    // South
    { x: 50, y: 50 },
    { x: 54, y: 52 },
    { x: 58, y: 55 },
    { x: 52, y: 58 },
    { x: 56, y: 60 },
    { x: 60, y: 58 },
    { x: 64, y: 55 },
    { x: 48, y: 55 },
    { x: 62, y: 52 },
    // Southeast
    { x: 68, y: 50 },
    { x: 72, y: 52 },
    { x: 70, y: 58 },
    { x: 74, y: 55 },
    { x: 76, y: 60 },
    { x: 72, y: 62 },
    { x: 68, y: 58 },
    { x: 78, y: 58 },
    // Florida
    { x: 74, y: 65 },
    { x: 76, y: 68 },
    { x: 78, y: 72 },
    { x: 76, y: 75 },
    { x: 74, y: 70 },
    // Mid-Atlantic
    { x: 72, y: 40 },
    { x: 75, y: 42 },
    { x: 78, y: 45 },
    { x: 74, y: 48 },
    { x: 70, y: 45 },
    { x: 76, y: 38 },
    { x: 80, y: 42 },
    // Northeast
    { x: 78, y: 32 },
    { x: 82, y: 30 },
    { x: 80, y: 35 },
    { x: 84, y: 32 },
    { x: 82, y: 28 },
    { x: 86, y: 30 },
    { x: 84, y: 25 },
    { x: 88, y: 28 },
    { x: 85, y: 35 },
    // New England
    { x: 88, y: 22 },
    { x: 90, y: 25 },
    { x: 86, y: 20 },
    { x: 92, y: 22 },
    { x: 90, y: 18 }
]

// Highlighted cities (charging hubs)
const HIGHLIGHT_DOTS = [
    { x: 10, y: 42, label: 'LA' },
    { x: 12, y: 22, label: 'Seattle' },
    { x: 40, y: 60, label: 'Austin' },
    { x: 58, y: 30, label: 'Chicago' },
    { x: 82, y: 32, label: 'NYC' },
    { x: 76, y: 72, label: 'Miami' },
    { x: 22, y: 35, label: 'Denver' }
]

export default function USMapDots() {
    return (
        <div className='absolute inset-0 overflow-hidden pointer-events-none'>
            {/* Radial gradient overlay for text readability */}
            <div
                className='absolute inset-0 z-10'
                style={{
                    background:
                        'radial-gradient(ellipse 50% 40% at 50% 40%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 60%, transparent 100%)'
                }}
            />
            <svg
                viewBox='0 0 100 90'
                className='absolute top-[55%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] sm:w-[110%] md:w-[100%] lg:w-[95%] xl:w-[90%] max-w-[1200px] h-auto opacity-[0.6]'
                preserveAspectRatio='xMidYMid meet'
            >
                {/* Regular dots */}
                {US_DOTS.map((dot, i) => (
                    <motion.circle
                        key={i}
                        cx={dot.x}
                        cy={dot.y}
                        r='0.8'
                        fill='currentColor'
                        className='text-emerald-400'
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                            delay: i * 0.01,
                            duration: 0.5,
                            ease: 'easeOut'
                        }}
                    />
                ))}

                {/* Highlighted charging hub dots */}
                {HIGHLIGHT_DOTS.map((dot, i) => (
                    <motion.g key={`highlight-${i}`}>
                        {/* Pulse ring */}
                        <motion.circle
                            cx={dot.x}
                            cy={dot.y}
                            r='2'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='0.3'
                            className='text-emerald-400'
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{
                                opacity: [0.5, 0],
                                scale: [1, 2]
                            }}
                            transition={{
                                delay: 1 + i * 0.2,
                                duration: 2,
                                repeat: Infinity,
                                repeatDelay: 3
                            }}
                        />
                        {/* Center dot */}
                        <motion.circle
                            cx={dot.x}
                            cy={dot.y}
                            r='1.2'
                            fill='currentColor'
                            className='text-emerald-400'
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                        />
                    </motion.g>
                ))}

                {/* Connecting lines between some hubs */}
                <motion.path
                    d='M 10,42 Q 16,38 22,35 M 22,35 Q 31,32 40,60 M 40,60 Q 50,45 58,30 M 58,30 Q 70,31 82,32'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='0.2'
                    className='text-cyan-400'
                    strokeDasharray='2 2'
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.3 }}
                    transition={{ delay: 1.5, duration: 2, ease: 'easeInOut' }}
                />
            </svg>
        </div>
    )
}
