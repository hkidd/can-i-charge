'use client'

import Map from '@/components/Map'
import RivianBadge from '@/components/RivianBadge'

export default function HomePage() {
    return (
        <>
            <style jsx global>{`
                body > nav {
                    display: none;
                }
            `}</style>

            <div className='mobile-safe-container'>
                <Map />
                <RivianBadge />
            </div>
        </>
    )
}
