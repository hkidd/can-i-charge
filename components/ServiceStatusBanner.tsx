'use client'

import { useEffect, useRef, useState } from 'react'

interface ServiceHealth {
    status?: string
    maintenance?: { active?: boolean; message?: string }
    checks?: { refresh?: { last_published_at?: string | null } }
}

export default function ServiceStatusBanner() {
    const [health, setHealth] = useState<ServiceHealth | null>(null)
    const [unavailable, setUnavailable] = useState(false)
    const banner = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const controller = new AbortController()
        let stopped = false
        async function check() {
            try {
                const response = await fetch('/api/health', {
                    cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)])
                })
                const body = await response.json() as ServiceHealth
                if (!stopped) { setHealth(body); setUnavailable(body.status === 'unhealthy') }
            } catch {
                if (!stopped) setUnavailable(true)
            }
        }
        const failed = () => setUnavailable(true)
        const recovered = () => setUnavailable(false)
        window.addEventListener('cic:data-unavailable', failed)
        window.addEventListener('cic:data-available', recovered)
        void check()
        const interval = setInterval(() => { if (!document.hidden) void check() }, 60000)
        return () => {
            stopped = true; controller.abort(); clearInterval(interval)
            window.removeEventListener('cic:data-unavailable', failed)
            window.removeEventListener('cic:data-available', recovered)
        }
    }, [])

    const active = health?.maintenance?.active
    const message = unavailable ? 'Charging data is temporarily unavailable. Please try again shortly.'
        : active ? 'Charging data is being updated. Some results may be temporarily unavailable.'
        : health?.status === 'degraded' ? 'Charging data updates are temporarily delayed. The map shows the last available data.' : null
    const published = health?.checks?.refresh?.last_published_at
    const date = published ? new Date(published) : null
    const lastUpdated = date && Number.isFinite(date.getTime()) ? date.toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }) : null

    useEffect(() => {
        const element = banner.current
        if (!element) return
        const resize = () => document.documentElement.style.setProperty('--service-banner-height', `${element.getBoundingClientRect().height}px`)
        resize()
        const observer = new ResizeObserver(resize)
        observer.observe(element)
        return () => { observer.disconnect(); document.documentElement.style.removeProperty('--service-banner-height') }
    }, [message])

    return <div ref={banner}>
        {message && <div role='status' aria-live='polite' className='max-w-7xl mx-auto pt-3'>
            <div className='rounded-lg border border-amber-400/30 bg-amber-950/95 px-3 py-2 text-xs sm:text-sm text-amber-100'>
                <span>{message}</span>
                {lastUpdated && <span className='block sm:inline sm:ml-2 text-amber-200/80'>Last successful update: {lastUpdated}.</span>}
            </div>
        </div>}
    </div>
}
