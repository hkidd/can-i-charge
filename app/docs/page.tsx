'use client'
import { redirect } from 'next/navigation'

// Temporarily redirect to coming-soon while awaiting Polar approval
// Remove this redirect and 'use client' comment below to restore the page
redirect('/coming-soon')

import { useState } from 'react'
import Header from '@/components/Header'

interface Endpoint {
    method: string
    path: string
    description: string
    params: {
        name: string
        type: string
        required: boolean
        description: string
    }[]
    example: {
        request: string
        response: string
    }
}

const endpoints: Endpoint[] = [
    {
        method: 'GET',
        path: '/api/ev-score',
        description:
            'Get the EV readiness score for any US location. Returns a score from 0-100, letter grade, and detailed breakdown of charging infrastructure.',
        params: [
            {
                name: 'address',
                type: 'string',
                required: false,
                description: 'Street address, city, or location to score'
            },
            {
                name: 'lat',
                type: 'number',
                required: false,
                description: 'Latitude coordinate'
            },
            {
                name: 'lng',
                type: 'number',
                required: false,
                description: 'Longitude coordinate'
            },
            {
                name: 'zip',
                type: 'string',
                required: false,
                description: 'ZIP code to score'
            },
            {
                name: 'state',
                type: 'string',
                required: false,
                description: 'State name or abbreviation'
            }
        ],
        example: {
            request: '/api/ev-score?address=Austin,TX',
            response: `{
  "success": true,
  "score": 78,
  "grade": "B+",
  "percentile": 82,
  "location": "Austin, TX",
  "message": "Good news! Austin, TX has solid EV charging options.",
  "breakdown": {
    "nearby_chargers": 32,
    "fast_charging": 20,
    "network_diversity": 14,
    "charging_density": 12
  },
  "chargers": {
    "within_1_mile": 5,
    "within_5_miles": 47,
    "dcfast_count": 12,
    "total": 89
  }
}`
        }
    },
    {
        method: 'GET',
        path: '/api/top-states',
        description:
            'Get the top EV-ready states ranked by infrastructure score.',
        params: [
            {
                name: 'limit',
                type: 'number',
                required: false,
                description: 'Number of states to return (default: 10)'
            }
        ],
        example: {
            request: '/api/top-states?limit=5',
            response: `[
  { "rank": 1, "state": "California", "score": 85 },
  { "rank": 2, "state": "Washington", "score": 79 },
  { "rank": 3, "state": "Oregon", "score": 76 },
  { "rank": 4, "state": "Colorado", "score": 74 },
  { "rank": 5, "state": "Vermont", "score": 73 }
]`
        }
    }
]

export default function DocsPage() {
    const [activeEndpoint, setActiveEndpoint] = useState(0)

    return (
        <div className='scrollable-page bg-[#030712]'>
            <Header currentPage='docs' theme='dark' />

            <main className='pt-24 pb-16 px-6'>
                <div className='max-w-6xl mx-auto'>
                    {/* Hero */}
                    <div className='text-center mb-16'>
                        <h1 className='text-4xl md:text-5xl font-bold text-white mb-4'>
                            API Documentation
                        </h1>
                        <p className='text-xl text-white/60 max-w-2xl mx-auto'>
                            Access EV charging infrastructure data
                            programmatically. Build apps, widgets, and
                            integrations with our RESTful API.
                        </p>
                    </div>

                    {/* Rate Limits */}
                    <section className='mb-12 p-6 rounded-2xl bg-blue-500/10 border border-blue-500/20'>
                        <h2 className='text-lg font-semibold text-white mb-2'>
                            Rate Limits
                        </h2>
                        <p className='text-white/60'>
                            The API is rate-limited to{' '}
                            <span className='text-blue-400 font-mono'>
                                30 requests per minute
                            </span>{' '}
                            per IP address. For higher limits or commercial use,
                            please{' '}
                            <a
                                href='/support'
                                className='text-blue-400 hover:underline'
                            >
                                contact us
                            </a>
                            .
                        </p>
                    </section>

                    {/* Endpoint Navigation */}
                    <div className='flex flex-wrap gap-2 mb-8'>
                        {endpoints.map((endpoint, index) => (
                            <button
                                key={endpoint.path}
                                onClick={() => setActiveEndpoint(index)}
                                className={`px-4 py-2 rounded-lg font-mono text-sm transition-all ${
                                    activeEndpoint === index
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                }`}
                            >
                                <span
                                    className={`mr-2 ${
                                        endpoint.method === 'GET'
                                            ? 'text-green-400'
                                            : 'text-yellow-400'
                                    }`}
                                >
                                    {endpoint.method}
                                </span>
                                {endpoint.path}
                            </button>
                        ))}
                    </div>

                    {/* Active Endpoint Details */}
                    {endpoints.map((endpoint, index) => (
                        <div
                            key={endpoint.path}
                            className={
                                activeEndpoint === index ? 'block' : 'hidden'
                            }
                        >
                            <div className='rounded-2xl border border-white/10 overflow-hidden'>
                                {/* Header */}
                                <div className='p-6 bg-white/[0.02] border-b border-white/10'>
                                    <div className='flex items-center gap-3 mb-3'>
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-bold ${
                                                endpoint.method === 'GET'
                                                    ? 'bg-green-500/20 text-green-400'
                                                    : 'bg-yellow-500/20 text-yellow-400'
                                            }`}
                                        >
                                            {endpoint.method}
                                        </span>
                                        <code className='text-lg text-white font-mono'>
                                            {endpoint.path}
                                        </code>
                                    </div>
                                    <p className='text-white/60'>
                                        {endpoint.description}
                                    </p>
                                </div>

                                {/* Parameters */}
                                <div className='p-6 border-b border-white/10'>
                                    <h3 className='text-sm font-semibold text-white/40 uppercase tracking-wider mb-4'>
                                        Parameters
                                    </h3>
                                    <div className='space-y-3'>
                                        {endpoint.params.map((param) => (
                                            <div
                                                key={param.name}
                                                className='flex items-start gap-4'
                                            >
                                                <div className='flex items-center gap-2 min-w-[140px]'>
                                                    <code className='text-blue-400 font-mono'>
                                                        {param.name}
                                                    </code>
                                                    {param.required && (
                                                        <span className='px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400'>
                                                            required
                                                        </span>
                                                    )}
                                                </div>
                                                <div>
                                                    <span className='text-white/40 text-sm font-mono'>
                                                        {param.type}
                                                    </span>
                                                    <span className='text-white/40 mx-2'>
                                                        —
                                                    </span>
                                                    <span className='text-white/60 text-sm'>
                                                        {param.description}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Example */}
                                <div className='p-6'>
                                    <h3 className='text-sm font-semibold text-white/40 uppercase tracking-wider mb-4'>
                                        Example
                                    </h3>

                                    <div className='mb-4'>
                                        <p className='text-xs text-white/40 mb-2'>
                                            Request
                                        </p>
                                        <pre className='p-4 rounded-lg bg-black/40 border border-white/5 overflow-x-auto'>
                                            <code className='text-sm text-green-400 font-mono'>
                                                {endpoint.example.request}
                                            </code>
                                        </pre>
                                    </div>

                                    <div>
                                        <p className='text-xs text-white/40 mb-2'>
                                            Response
                                        </p>
                                        <pre className='p-4 rounded-lg bg-black/40 border border-white/5 overflow-x-auto'>
                                            <code className='text-sm text-white/80 font-mono whitespace-pre'>
                                                {endpoint.example.response}
                                            </code>
                                        </pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Widget Embed */}
                    <section className='mt-16'>
                        <h2 className='text-2xl font-bold text-white mb-6'>
                            Embed Widget
                        </h2>
                        <p className='text-white/60 mb-6'>
                            Want to add EV scores to your website without
                            building custom integrations? Check out our{' '}
                            <a
                                href='/widget-demo'
                                className='text-blue-400 hover:underline'
                            >
                                embeddable widget
                            </a>
                            .
                        </p>
                    </section>
                </div>
            </main>
        </div>
    )
}
