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

            <div className='w-screen fixed inset-0 bg-background' style={{
                paddingTop: 'env(safe-area-inset-top)',
                paddingBottom: 'env(safe-area-inset-bottom)',
                paddingLeft: 'env(safe-area-inset-left)',
                paddingRight: 'env(safe-area-inset-right)'
            }}>
                <Map />
                <RivianBadge />
            </div>
        </>
    )
}
