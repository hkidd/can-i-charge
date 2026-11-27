'use client'

import { useEffect, type ReactNode } from 'react'
import Lenis from 'lenis'

interface SmoothScrollProps {
    children: ReactNode
}

export default function SmoothScroll({ children }: SmoothScrollProps) {
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
        })

        let animationFrame: number
        function animate(time: number) {
            lenis.raf(time)
            animationFrame = requestAnimationFrame(animate)
        }

        animationFrame = requestAnimationFrame(animate)

        return () => {
            cancelAnimationFrame(animationFrame)
            lenis.destroy()
        }
    }, [])

    return <>{children}</>
}
