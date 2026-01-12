'use client'

import { useRef, useEffect, useState } from 'react'
import { useInView } from 'framer-motion'

interface AnimatedCounterProps {
    target: number
    suffix?: string
    prefix?: string
    duration?: number
    className?: string
}

export default function AnimatedCounter({
    target,
    suffix = '',
    prefix = '',
    duration = 2,
    className = '',
}: AnimatedCounterProps) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true })
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!isInView) return

        let startTime: number
        let animationFrame: number

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp
            const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)
            const easeOut = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(easeOut * target))

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate)
            }
        }

        animationFrame = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(animationFrame)
    }, [isInView, target, duration])

    return (
        <span ref={ref} className={className}>
            {prefix}{count.toLocaleString()}{suffix}
        </span>
    )
}
