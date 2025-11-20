import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'Can I Charge? - EV Charging Infrastructure Scores',
    description:
        'Discover EV charging infrastructure availability for any US address. Get instant scores and insights for electric vehicle charging stations.',
    keywords: [
        'EV charging',
        'electric vehicle', 
        'charging stations',
        'EV infrastructure',
        'electric car charging',
        'Tesla charging',
        'DC fast charging',
        'Level 2 charging'
    ],
    metadataBase: new URL(process.env.NEXT_PUBLIC_URL || 'https://can-i-charge.vercel.app'),
    openGraph: {
        title: 'Can I Charge? - EV Charging Infrastructure Scores',
        description: 'Discover EV charging infrastructure availability for any US address. Get instant scores and insights.',
        url: '/',
        siteName: 'Can I Charge?',
        images: [
            {
                url: '/og-image.png',
                width: 1200,
                height: 630,
                alt: 'Can I Charge? - EV Charging Infrastructure Map'
            }
        ],
        locale: 'en_US',
        type: 'website'
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Can I Charge? - EV Charging Infrastructure Scores',
        description: 'Discover EV charging infrastructure availability for any US address.',
        images: ['/og-image.png']
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1
        }
    }
}

export default function RootLayout({
    children
}: {
    children: React.ReactNode
}) {
    return (
        <html lang='en'>
            <body>{children}</body>
        </html>
    )
}
