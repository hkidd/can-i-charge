'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface GlassCardProps {
    children: ReactNode
    className?: string
    hover?: boolean
    glow?: boolean
    glowColor?: string
}

export default function GlassCard({
    children,
    className = '',
    hover = true,
    glow = false,
    glowColor = 'rgba(16, 185, 129, 0.2)',
}: GlassCardProps) {
    return (
        <motion.div
            className={`
                relative overflow-hidden rounded-2xl
                bg-white/[0.03] backdrop-blur-xl
                border border-white/[0.08]
                ${className}
            `}
            whileHover={hover ? {
                scale: 1.02,
                borderColor: 'rgba(255, 255, 255, 0.15)',
            } : {}}
            transition={{ duration: 0.3 }}
            style={glow ? {
                boxShadow: `0 0 60px ${glowColor}`,
            } : {}}
        >
            {/* Shine effect */}
            <div
                className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-500"
                style={{
                    background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)',
                    backgroundSize: '200% 100%',
                }}
            />
            <div className="relative z-10">
                {children}
            </div>
        </motion.div>
    )
}
