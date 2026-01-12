'use client'

import Map from '@/components/Map'
import RivianBadge from '@/components/RivianBadge'
import Header from '@/components/Header'

export default function ExplorePage() {
    return (
        <div className='mobile-safe-container'>
            <Header currentPage="map" theme="dark" />
            <Map />
            <RivianBadge />
        </div>
    )
}
