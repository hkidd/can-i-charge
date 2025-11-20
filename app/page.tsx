'use client'

import Map from '@/components/Map'

export default function HomePage() {
    return (
        <>
            <style jsx global>{`
                body > nav {
                    display: none;
                }
                body {
                    padding-top: 0 !important;
                }
            `}</style>

            <div className='w-screen h-screen fixed top-0 left-0 bg-background'>
                <Map />
            </div>
        </>
    )
}
