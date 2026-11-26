'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Car, Zap, Building2, MapPin, Gauge } from 'lucide-react'
import {
    AnimatedSection,
    AnimatedCounter,
    AnimatedText,
    Button,
    USMapDots,
    AnimatedBarChart
} from '@/components/landing'
import EVScoreWidget, { ScoreData } from '@/components/EVScoreWidget'
import Header from '@/components/Header'
import AddressSearch from '@/components/AddressSearch'

// Demo data for widget examples (Austin, TX - 78701)
const DEMO_SCORE_DATA: ScoreData = {
    score: 78,
    grade: 'B+',
    percentile: null,
    message: 'Great EV infrastructure',
    location: 'Austin, TX 78701',
    breakdown: {
        nearby_chargers: 63,
        fast_charging: 15,
        network_diversity: 0,
        charging_density: 0
    },
    chargers: {
        within_5_miles: 47,
        dcfast_count: 12,
        dcfast_within_5_miles: 12,
        nearest: {
            name: 'Tesla Supercharger',
            distance: 0.3
        }
    },
    nearest_charger_miles: 0.3
}

// Section theme configurations - Electric Blue palette with bold color blocking
const SECTION_THEMES = {
    hero: { bg: '#030712', text: 'white', navBg: 'rgba(3, 7, 18, 0.9)' },
    stats: { bg: '#ffffff', text: 'dark', navBg: 'rgba(255, 255, 255, 0.9)' },
    useCases: { bg: '#059669', text: 'white', navBg: 'rgba(5, 150, 105, 0.9)' }, // Emerald
    factors: { bg: '#1e293b', text: 'white', navBg: 'rgba(30, 41, 59, 0.9)' }, // Dark slate
    rankings: { bg: '#1e40af', text: 'white', navBg: 'rgba(30, 64, 175, 0.9)' }, // Bold blue
    widget: { bg: '#0f172a', text: 'white', navBg: 'rgba(15, 23, 42, 0.9)' }, // Darker slate
    cta: { bg: '#fafafa', text: 'dark', navBg: 'rgba(250, 250, 250, 0.9)' } // Subtle off-white
}

export default function LandingPage() {
    const [showWidget, setShowWidget] = useState(false)
    const [widgetAddress, setWidgetAddress] = useState('')
    const [topStates, setTopStates] = useState<
        { rank: number; state: string; score: number }[]
    >([])
    const [currentSection, setCurrentSection] =
        useState<keyof typeof SECTION_THEMES>('hero')

    // Track which section is in view using Intersection Observer
    useEffect(() => {
        const sectionElements = document.querySelectorAll(
            'section[data-section]'
        )

        // Create observer that triggers when section crosses the top of viewport
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    // When a section enters from below (scrolling down) or is intersecting
                    if (entry.isIntersecting) {
                        const sectionId = entry.target.getAttribute(
                            'data-section'
                        ) as keyof typeof SECTION_THEMES
                        if (sectionId) {
                            setCurrentSection(sectionId)
                        }
                    }
                })
            },
            {
                // Trigger when element crosses 10% from top of viewport
                rootMargin: '-10% 0px -85% 0px',
                threshold: 0
            }
        )

        sectionElements.forEach((section) => observer.observe(section))

        return () => observer.disconnect()
    }, [])

    // Update theme-color meta tag for Safari browser chrome
    useEffect(() => {
        // Solid colors for theme-color (Safari doesn't support rgba)
        const solidColors: Record<keyof typeof SECTION_THEMES, string> = {
            hero: '#030712',
            stats: '#ffffff',
            useCases: '#059669',
            factors: '#1e293b',
            rankings: '#1e40af',
            widget: '#0f172a',
            cta: '#fafafa'
        }

        const color = solidColors[currentSection]

        // Safari sometimes needs the meta tag to be fully replaced, not just updated
        const existingMeta = document.querySelector('meta[name="theme-color"]')
        if (existingMeta) {
            existingMeta.remove()
        }

        const newMeta = document.createElement('meta')
        newMeta.name = 'theme-color'
        newMeta.content = color
        document.head.appendChild(newMeta)
    }, [currentSection])

    // Fetch top states on mount
    useEffect(() => {
        async function fetchTopStates() {
            try {
                const res = await fetch('/api/top-states')
                if (res.ok) {
                    const data = await res.json()
                    setTopStates(data.slice(0, 8)) // Top 8 states
                }
            } catch (error) {
                console.error('Failed to fetch top states:', error)
            }
        }
        fetchTopStates()
    }, [])

    const handleScoreResult = (data: { location?: string }) => {
        if (data?.location) {
            setWidgetAddress(data.location)
            setShowWidget(true)
        }
    }

    return (
        <>
            <style jsx global>{`
                html,
                body {
                    overflow-x: hidden !important;
                    overflow-y: auto !important;
                    scroll-behavior: smooth;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>

            <div className='text-foreground'>
                {/* Navigation - Dynamic color based on section */}
                <Header
                    currentPage='home'
                    theme={
                        SECTION_THEMES[currentSection].text === 'dark'
                            ? 'light'
                            : 'dark'
                    }
                    navBg={SECTION_THEMES[currentSection].navBg}
                    borderColor={
                        SECTION_THEMES[currentSection].text === 'dark'
                            ? 'rgba(0,0,0,0.05)'
                            : 'rgba(255,255,255,0.05)'
                    }
                />

                {/* Hero Section - Dark */}
                <section
                    data-section='hero'
                    className='relative min-h-screen flex items-center justify-center px-6 pt-20 bg-[#030712]'
                >
                    {/* US Map visualization in background */}
                    <USMapDots />

                    <div className='relative z-10 max-w-4xl mx-auto text-center'>
                        <AnimatedText
                            text='Is your area EV ready?'
                            as='h1'
                            animation='words'
                            className='text-5xl md:text-7xl font-bold tracking-tight mb-6'
                            highlightWords={['EV', 'ready']}
                        />

                        <AnimatedSection delay={0.4}>
                            <p className='text-xl md:text-2xl text-white/60 mb-12 max-w-2xl mx-auto'>
                                The EV Readiness Score for any US location. Know
                                the charging infrastructure before you go, move,
                                or build.
                            </p>
                        </AnimatedSection>

                        <AnimatedSection delay={0.6}>
                            <AddressSearch
                                variant='hero'
                                showButton={true}
                                buttonText='Get Score'
                                showAnimatedPlaceholder={true}
                                showScoreCard={false}
                                onScoreResult={handleScoreResult}
                                className='mb-8'
                            />
                        </AnimatedSection>

                        {showWidget && (
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.5 }}
                                className='flex justify-center'
                            >
                                <EVScoreWidget
                                    address={widgetAddress}
                                    size='detailed'
                                    theme='glass'
                                    showBreakdown={true}
                                    showBranding={false}
                                />
                            </motion.div>
                        )}
                    </div>
                </section>

                {/* Stats Section - Clean White */}
                <section
                    data-section='stats'
                    className='py-24 md:py-32 px-6 bg-white'
                >
                    <div className='max-w-6xl mx-auto w-full'>
                        <AnimatedSection className='text-center mb-16'>
                            <h2 className='text-4xl md:text-6xl font-bold mb-4 text-gray-900'>
                                <span className='text-blue-600'>
                                    Real data.
                                </span>{' '}
                                Real coverage.
                            </h2>
                            <p className='text-xl text-gray-500'>
                                Aggregated from the National Renewable Energy
                                Laboratory
                            </p>
                        </AnimatedSection>

                        <div className='grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-16 lg:gap-24'>
                            {[
                                {
                                    value: 84000,
                                    suffix: '+',
                                    label: 'Charging Stations',
                                    color: '#2563eb'
                                },
                                {
                                    value: 33000,
                                    suffix: '+',
                                    label: 'ZIP Codes Scored',
                                    color: '#0891b2'
                                },
                                {
                                    value: 3100,
                                    suffix: '+',
                                    label: 'Counties Analyzed',
                                    color: '#059669'
                                }
                            ].map((stat, i) => (
                                <AnimatedSection key={i} delay={i * 0.15}>
                                    <div className='text-center px-4'>
                                        <div
                                            className='text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold mb-4'
                                            style={{ color: stat.color }}
                                        >
                                            <AnimatedCounter
                                                target={stat.value}
                                                suffix={stat.suffix}
                                            />
                                        </div>
                                        <div className='text-gray-500 text-lg font-medium'>
                                            {stat.label}
                                        </div>
                                    </div>
                                </AnimatedSection>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Use Cases Section - Emerald */}
                <section
                    data-section='useCases'
                    className='py-24 md:py-32 px-6 bg-[#059669]'
                >
                    <div className='max-w-5xl mx-auto w-full'>
                        <AnimatedSection className='text-center mb-16'>
                            <h2 className='text-4xl md:text-6xl font-bold mb-4 text-white'>
                                Built for the EV ecosystem
                            </h2>
                            <p className='text-xl text-emerald-100'>
                                From daily drivers to infrastructure planners
                            </p>
                        </AnimatedSection>

                        <div className='grid grid-cols-1 md:grid-cols-3 gap-12'>
                            {[
                                {
                                    icon: Car,
                                    title: 'EV Owners',
                                    description:
                                        'Know the charging landscape before you move, travel, or buy.'
                                },
                                {
                                    icon: Zap,
                                    title: 'Operators',
                                    description:
                                        'Identify underserved areas with high demand for deployment.'
                                },
                                {
                                    icon: Building2,
                                    title: 'Real Estate',
                                    description:
                                        'Add EV Readiness scores to show future-ready value.'
                                }
                            ].map((item, i) => (
                                <AnimatedSection key={i} delay={i * 0.15}>
                                    <motion.div
                                        className='text-center group'
                                        whileHover={{ y: -8 }}
                                        transition={{
                                            type: 'spring',
                                            stiffness: 300
                                        }}
                                    >
                                        <div className='w-20 h-20 mx-auto mb-6 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors'>
                                            <item.icon
                                                className='w-10 h-10 text-white'
                                                strokeWidth={1.5}
                                            />
                                        </div>
                                        <h3 className='text-2xl font-bold text-white mb-3'>
                                            {item.title}
                                        </h3>
                                        <p className='text-blue-100 leading-relaxed'>
                                            {item.description}
                                        </p>
                                    </motion.div>
                                </AnimatedSection>
                            ))}
                        </div>
                    </div>
                </section>

                {/* How It Works Section - Dark Slate */}
                <section
                    data-section='factors'
                    className='py-24 md:py-32 px-6 bg-[#1e293b]'
                >
                    <div className='max-w-6xl mx-auto w-full'>
                        <AnimatedSection className='text-center mb-16'>
                            <h2 className='text-4xl md:text-6xl font-bold mb-4 text-white'>
                                Supply. Demand. Readiness.
                            </h2>
                            <p className='text-xl text-slate-400 max-w-2xl mx-auto'>
                                Reported public ports compared with fleet-based
                                charging targets
                            </p>
                        </AnimatedSection>

                        <div className='grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12'>
                            {[
                                {
                                    icon: MapPin,
                                    title: 'Demand',
                                    subtitle: 'Registered or estimated EV fleet',
                                    color: '#10b981'
                                },
                                {
                                    icon: Zap,
                                    title: 'Level 2',
                                    subtitle: 'Destination charging target',
                                    color: '#06b6d4'
                                },
                                {
                                    icon: Building2,
                                    title: 'Fast Charging',
                                    subtitle: 'BEV fast-charging target',
                                    color: '#3b82f6'
                                },
                                {
                                    icon: Gauge,
                                    title: '2030 Scenario',
                                    subtitle: 'Projected provision gap',
                                    color: '#8b5cf6'
                                }
                            ].map((factor, i) => (
                                <AnimatedSection key={i} delay={i * 0.1}>
                                    <motion.div
                                        className='text-center'
                                        whileHover={{ y: -4 }}
                                        transition={{
                                            type: 'spring',
                                            stiffness: 300
                                        }}
                                    >
                                        <div
                                            className='w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center mx-auto mb-5'
                                            style={{
                                                backgroundColor: `${factor.color}20`
                                            }}
                                        >
                                            <factor.icon
                                                className='w-8 h-8 md:w-10 md:h-10'
                                                style={{ color: factor.color }}
                                                strokeWidth={1.5}
                                            />
                                        </div>
                                        <h3 className='text-xl md:text-2xl font-bold text-white mb-1'>
                                            {factor.title}
                                        </h3>
                                        <p className='text-slate-400 text-sm'>
                                            {factor.subtitle}
                                        </p>
                                    </motion.div>
                                </AnimatedSection>
                            ))}
                        </div>
                    </div>
                </section>

                {/* State Rankings Section - Bold Blue */}
                <section
                    data-section='rankings'
                    className='py-24 md:py-32 px-6 bg-[#1e40af]'
                >
                    <div className='max-w-6xl mx-auto w-full'>
                        <div className='grid grid-cols-1 lg:grid-cols-2 gap-16 items-center'>
                            <AnimatedSection direction='left'>
                                <p className='text-blue-200 text-sm font-medium uppercase tracking-wider mb-4'>
                                    State benchmarks
                                </p>
                                <h2 className='text-4xl md:text-5xl font-bold mb-6 text-white'>
                                    Current state provision
                                </h2>
                                <p className='text-xl text-blue-100 mb-8'>
                                    Absolute targets based on state EV registrations.
                                    A score of 100 means both modeled charging
                                    provision targets are met.
                                </p>
                                <Button href='/explore' variant='secondary'>Explore Full Map</Button>
                                <a href='/methodology' className='block mt-5 text-blue-100 underline'>How this score works</a>
                            </AnimatedSection>

                            <AnimatedSection direction='right'>
                                <div className='bg-white/10 backdrop-blur-sm rounded-2xl p-6'>
                                    <AnimatedBarChart
                                        data={
                                            topStates.length > 0
                                                ? topStates
                                                : [
                                                      {
                                                          rank: 1,
                                                          state: 'Loading...',
                                                          score: 0
                                                      }
                                                  ]
                                        }
                                    />
                                </div>
                            </AnimatedSection>
                        </div>
                    </div>
                </section>

                {/* Widget Showcase Section - Dark Slate */}
                <section
                    data-section='widget'
                    className='py-24 md:py-32 px-6 bg-[#0f172a]'
                >
                    <div className='max-w-6xl mx-auto w-full'>
                        <div className='grid grid-cols-1 lg:grid-cols-2 gap-16 items-center'>
                            <AnimatedSection direction='left'>
                                <p className='text-gray-400 text-sm font-medium uppercase tracking-wider mb-4'>
                                    Embed Widget
                                </p>
                                <h2 className='text-4xl md:text-5xl font-bold mb-6 text-white'>
                                    Add to any website
                                </h2>
                                <p className='text-xl text-gray-400 mb-8'>
                                    One line of code. Three flexible sizes.
                                    Instant EV Readiness scores on your site.
                                </p>
                                <div className='bg-gray-800 rounded-xl p-6 font-mono text-sm'>
                                    <div className='text-gray-500 mb-2'>
                                        {'<!-- Add to your site -->'}
                                    </div>
                                    <div className='space-y-1'>
                                        <div>
                                            <span className='text-cyan-400'>
                                                {'<script '}
                                            </span>
                                            <span className='text-emerald-400'>
                                                src
                                            </span>
                                            <span className='text-white'>
                                                =
                                            </span>
                                            <span className='text-amber-400'>
                                                {
                                                    '"https://canicharge.com/widget.js"'
                                                }
                                            </span>
                                        </div>
                                        <div className='pl-8'>
                                            <span className='text-emerald-400'>
                                                data-key
                                            </span>
                                            <span className='text-white'>
                                                =
                                            </span>
                                            <span className='text-blue-400'>
                                                {'"YOUR_API_KEY"'}
                                            </span>
                                        </div>
                                        <div className='pl-8'>
                                            <span className='text-emerald-400'>
                                                data-zip
                                            </span>
                                            <span className='text-white'>
                                                =
                                            </span>
                                            <span className='text-amber-400'>
                                                {'"78701"'}
                                            </span>
                                            <span className='text-cyan-400'>
                                                {'>'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className='text-cyan-400'>
                                                {'</script>'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <div className='mt-8 flex gap-4'>
                                    <Button
                                        href='/widget-demo'
                                        variant='primary'
                                    >
                                        View Examples
                                    </Button>
                                    <Button href='/docs' variant='secondary'>
                                        API Docs
                                    </Button>
                                </div>
                            </AnimatedSection>
                            {/* Widget Preview */}
                            <AnimatedSection direction='right'>
                                <div className='flex justify-center lg:justify-start'>
                                    <motion.div
                                        animate={{ y: [0, -8, 0] }}
                                        transition={{
                                            duration: 4,
                                            repeat: Infinity,
                                            ease: 'easeInOut'
                                        }}
                                    >
                                        <EVScoreWidget
                                            demoData={DEMO_SCORE_DATA}
                                            size='standard'
                                            theme='glass'
                                            showBreakdown={false}
                                            showBranding={true}
                                        />
                                    </motion.div>
                                </div>
                            </AnimatedSection>
                        </div>
                    </div>
                </section>
                {/* CTA Section - Simple off-white */}
                <section data-section='cta' className='py-32 px-6 bg-[#fafafa]'>
                    <div className='max-w-4xl mx-auto text-center'>
                        <AnimatedSection>
                            <h2 className='text-4xl md:text-6xl font-bold mb-6 text-gray-900'>
                                Ready to explore?
                            </h2>
                            <p className='text-xl text-gray-500 mb-10 max-w-xl mx-auto'>
                                Discover EV charging infrastructure across the
                                United States.
                            </p>
                            <Button href='/explore' variant='primary' size='lg'>
                                Open the Map
                            </Button>
                        </AnimatedSection>
                    </div>
                </section>
                {/* Footer - Clean Gray */}
                <footer className='bg-gray-100 border-t border-gray-200'>
                    <div className='max-w-6xl mx-auto px-6 py-16'>
                        {/* Footer Grid */}
                        <div className='grid grid-cols-2 md:grid-cols-4 gap-8 mb-12'>
                            {/* Brand */}
                            <div className='col-span-2 md:col-span-1'>
                                <div className='flex items-center gap-2.5 mb-4'>
                                    <div className='w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center'>
                                        <Zap
                                            className='w-4 h-4 text-white'
                                            fill='currentColor'
                                            strokeWidth={0}
                                        />
                                    </div>
                                    <span className='text-lg font-semibold text-gray-900'>
                                        Can I Charge
                                        <span className='text-blue-500'>?</span>
                                    </span>
                                </div>
                                <p className='text-gray-500 text-sm leading-relaxed'>
                                    The EV Readiness Score for any US location.
                                </p>
                            </div>
                            {/* Product */}
                            <div>
                                <div className='text-sm font-semibold text-gray-900 mb-4'>
                                    Product
                                </div>
                                <ul className='space-y-3 text-sm'>
                                    <li>
                                        <a
                                            href='/explore'
                                            className='text-gray-500 hover:text-gray-900 transition-colors'
                                        >
                                            Interactive Map
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='/widget-demo'
                                            className='text-gray-500 hover:text-gray-900 transition-colors'
                                        >
                                            Embed Widget
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='/docs'
                                            className='text-gray-500 hover:text-gray-900 transition-colors'
                                        >
                                            API Access
                                        </a>
                                    </li>
                                </ul>
                            </div>
                            {/* Resources */}
                            <div>
                                <div className='text-sm font-semibold text-gray-900 mb-4'>
                                    Resources
                                </div>
                                <ul className='space-y-3 text-sm'>
                                    <li>
                                        <a
                                            href='/docs'
                                            className='text-gray-500 hover:text-gray-900 transition-colors'
                                        >
                                            API Documentation
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='/support'
                                            className='text-gray-500 hover:text-gray-900 transition-colors'
                                        >
                                            Support
                                        </a>
                                    </li>
                                    <li>
                                        <a
                                            href='https://polar.sh/canicharge/portal'
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-gray-500 hover:text-gray-900 transition-colors'
                                        >
                                            Manage Subscription
                                        </a>
                                    </li>
                                </ul>
                            </div>
                            {/* Connect */}
                            <div>
                                <div className='text-sm font-semibold text-gray-900 mb-4'>
                                    Connect
                                </div>
                                <ul className='space-y-3 text-sm'>
                                    <li>
                                        <a
                                            href='/support#feedback'
                                            className='text-gray-500 hover:text-gray-900 transition-colors'
                                        >
                                            Feedback
                                        </a>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {/* Bottom Bar */}
                        <div className='border-t border-gray-200 pt-8 flex flex-col md:flex-row items-center justify-between gap-4'>
                            <div className='text-gray-400 text-sm'>
                                © {new Date().getFullYear()} Can I Charge?
                            </div>
                            <div className='text-sm text-gray-400'>
                                Data from{' '}
                                <a
                                    href='https://afdc.energy.gov'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    className='text-gray-600 hover:text-gray-900 transition-colors'
                                >
                                    NREL AFDC
                                </a>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    )
}
