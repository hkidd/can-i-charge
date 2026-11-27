'use client'

import { useSyncExternalStore } from 'react'

const query = '(prefers-reduced-motion: reduce)'
function subscribe(onChange: () => void) {
    const media = window.matchMedia(query)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
}
const getSnapshot = () => window.matchMedia(query).matches
// Keep server markup and the first hydration render identical, with motion off.
const getServerSnapshot = () => true

export function useReducedMotionPreference() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
