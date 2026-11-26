'use client'
import { redirect } from 'next/navigation'

// Temporarily redirect to coming-soon while awaiting Polar approval
// Remove this redirect and 'use client' comment below to restore the page
redirect('/coming-soon')

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
    Code,
    Palette,
    Zap,
    Building2,
    Copy,
    Check,
    Sparkles,
    MapPin,
    Hash,
    Navigation,
    Map
} from 'lucide-react'
import Header from '@/components/Header'
import EVScoreWidget, { ScoreData } from '@/components/EVScoreWidget'

const DEMO_DATA: ScoreData = {
    score: 78,
    grade: 'B+',
    percentile: 82,
    message: 'Great EV infrastructure',
    location: 'Austin, TX 78701',
    breakdown: {
        nearby_chargers: 32,
        fast_charging: 15,
        network_diversity: 21,
        charging_density: 10
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

const WIDGET_SIZES = ['compact', 'standard', 'detailed'] as const

export default function WidgetDemoPage() {
    const [activeSize, setActiveSize] =
        useState<(typeof WIDGET_SIZES)[number]>('standard')
    const [activeTheme, setActiveTheme] = useState<'light' | 'dark' | 'glass'>(
        'glass'
    )
    const [copiedCode, setCopiedCode] = useState(false)

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopiedCode(true)
        setTimeout(() => setCopiedCode(false), 2000)
    }

    const embedCode = `<script
  src="https://canicharge.com/widget.js"
  data-key="YOUR_API_KEY"
  data-address="Austin, TX"
  data-size="${activeSize}"
  data-theme="${activeTheme}"
></script>`

    return (
        <div className='scrollable-page bg-[#030712]'>
            <Header currentPage='widget' theme='dark' />

            <main className='relative pt-28 pb-20 px-6'>
                <div className='max-w-6xl mx-auto'>
                    {/* Hero */}
                    <motion.div
                        className='text-center mb-20'
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <motion.div
                            className='inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6'
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Code className='w-4 h-4 text-blue-400' />
                            <span className='text-sm text-blue-300'>
                                One line of code
                            </span>
                        </motion.div>

                        <h1 className='text-5xl md:text-6xl font-bold text-white mb-6'>
                            Embed EV scores{' '}
                            <span className='text-blue-500'>anywhere</span>
                        </h1>
                        <p className='text-xl text-white/50 max-w-2xl mx-auto leading-relaxed'>
                            Add real-time EV infrastructure scores to your real
                            estate listings, travel apps, or any website.
                        </p>
                    </motion.div>

                    {/* Interactive Demo */}
                    <motion.section
                        className='mb-20'
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        <div className='grid lg:grid-cols-2 gap-8 items-start'>
                            {/* Controls */}
                            <div className='space-y-6'>
                                <div>
                                    <label className='block text-sm font-medium text-white/60 mb-3'>
                                        Size
                                    </label>
                                    <div className='flex gap-2'>
                                        {WIDGET_SIZES.map((size) => (
                                            <button
                                                key={size}
                                                onClick={() =>
                                                    setActiveSize(size)
                                                }
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                                    activeSize === size
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                {size.charAt(0).toUpperCase() +
                                                    size.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className='block text-sm font-medium text-white/60 mb-3'>
                                        Theme
                                    </label>
                                    <div className='flex gap-2'>
                                        {(
                                            ['light', 'dark', 'glass'] as const
                                        ).map((theme) => (
                                            <button
                                                key={theme}
                                                onClick={() =>
                                                    setActiveTheme(theme)
                                                }
                                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                                    activeTheme === theme
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                                                }`}
                                            >
                                                {theme.charAt(0).toUpperCase() +
                                                    theme.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Code Preview */}
                                <div>
                                    <div className='flex items-center justify-between mb-3'>
                                        <label className='text-sm font-medium text-white/60'>
                                            Embed Code
                                        </label>
                                        <button
                                            onClick={() =>
                                                copyToClipboard(embedCode)
                                            }
                                            className='flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors'
                                        >
                                            {copiedCode ? (
                                                <>
                                                    <Check className='w-3.5 h-3.5 text-emerald-400' />
                                                    <span className='text-emerald-400'>
                                                        Copied!
                                                    </span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className='w-3.5 h-3.5' />
                                                    <span>Copy</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <pre className='p-4 rounded-xl bg-black/50 border border-white/10 text-sm overflow-x-auto'>
                                        <code className='text-white/70'>
                                            <span className='text-cyan-400'>
                                                {'<script'}
                                            </span>
                                            {'\n  '}
                                            <span className='text-emerald-400'>
                                                src
                                            </span>
                                            <span className='text-white'>
                                                =
                                            </span>
                                            <span className='text-amber-400'>
                                                &quot;https://canicharge.com/widget.js&quot;
                                            </span>
                                            {'\n  '}
                                            <span className='text-emerald-400'>
                                                data-key
                                            </span>
                                            <span className='text-white'>
                                                =
                                            </span>
                                            <span className='text-blue-400'>
                                                &quot;YOUR_API_KEY&quot;
                                            </span>
                                            {'\n  '}
                                            <span className='text-emerald-400'>
                                                data-address
                                            </span>
                                            <span className='text-white'>
                                                =
                                            </span>
                                            <span className='text-amber-400'>
                                                &quot;Austin, TX&quot;
                                            </span>
                                            {'\n  '}
                                            <span className='text-emerald-400'>
                                                data-size
                                            </span>
                                            <span className='text-white'>
                                                =
                                            </span>
                                            <span className='text-amber-400'>
                                                &quot;{activeSize}&quot;
                                            </span>
                                            {'\n  '}
                                            <span className='text-emerald-400'>
                                                data-theme
                                            </span>
                                            <span className='text-white'>
                                                =
                                            </span>
                                            <span className='text-amber-400'>
                                                &quot;{activeTheme}&quot;
                                            </span>
                                            {'\n'}
                                            <span className='text-cyan-400'>
                                                {'></script>'}
                                            </span>
                                        </code>
                                    </pre>
                                </div>
                            </div>

                            {/* Widget Preview */}
                            <div className='flex items-center justify-center'>
                                <motion.div
                                    key={`${activeSize}-${activeTheme}`}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                    className={`p-8 rounded-2xl ${
                                        activeTheme === 'light'
                                            ? 'bg-gray-100'
                                            : activeTheme === 'dark'
                                            ? 'bg-gray-900'
                                            : 'bg-white/5'
                                    }`}
                                >
                                    <EVScoreWidget
                                        demoData={DEMO_DATA}
                                        size={activeSize}
                                        theme={activeTheme}
                                        showBreakdown={
                                            activeSize === 'detailed'
                                        }
                                        showBranding={activeSize !== 'compact'}
                                    />
                                </motion.div>
                            </div>
                        </div>
                    </motion.section>

                    {/* Use Cases */}
                    <motion.section
                        className='mb-20'
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className='text-center mb-12'>
                            <h2 className='text-3xl font-bold text-white mb-4'>
                                Built for your industry
                            </h2>
                            <p className='text-white/50'>
                                See how teams are using EV scores
                            </p>
                        </div>

                        <div className='grid md:grid-cols-3 gap-6'>
                            {[
                                {
                                    icon: Building2,
                                    title: 'Real Estate',
                                    description:
                                        'Add EV readiness to property listings. Help buyers understand charging access before they move.',
                                    gradient:
                                        'from-blue-500/20 via-blue-500/5 to-transparent',
                                    borderColor:
                                        'border-blue-500/20 hover:border-blue-500/40',
                                    glowColor:
                                        'hover:shadow-[0_0_40px_-12px_rgba(59,130,246,0.4)]',
                                    iconBg: 'bg-gradient-to-br from-blue-400 to-blue-600',
                                    iconColor: 'text-white'
                                },
                                {
                                    icon: Zap,
                                    title: 'Fleet Management',
                                    description:
                                        'Evaluate locations for EV fleet deployment. Identify areas with strong infrastructure.',
                                    gradient:
                                        'from-emerald-500/20 via-emerald-500/5 to-transparent',
                                    borderColor:
                                        'border-emerald-500/20 hover:border-emerald-500/40',
                                    glowColor:
                                        'hover:shadow-[0_0_40px_-12px_rgba(16,185,129,0.4)]',
                                    iconBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
                                    iconColor: 'text-white'
                                },
                                {
                                    icon: Palette,
                                    title: 'Travel & Tourism',
                                    description:
                                        'Show EV charging availability for destinations. Help travelers plan electric road trips.',
                                    gradient:
                                        'from-purple-500/20 via-purple-500/5 to-transparent',
                                    borderColor:
                                        'border-purple-500/20 hover:border-purple-500/40',
                                    glowColor:
                                        'hover:shadow-[0_0_40px_-12px_rgba(168,85,247,0.4)]',
                                    iconBg: 'bg-gradient-to-br from-purple-400 to-purple-600',
                                    iconColor: 'text-white'
                                }
                            ].map((item, i) => (
                                <motion.div
                                    key={item.title}
                                    className={`group relative p-6 rounded-2xl bg-gradient-to-br ${item.gradient} border ${item.borderColor} ${item.glowColor} transition-all duration-500 overflow-hidden`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.5 + i * 0.1 }}
                                    whileHover={{ y: -4, scale: 1.02 }}
                                >
                                    <motion.div
                                        className={`w-14 h-14 rounded-2xl ${item.iconBg} flex items-center justify-center mb-5 shadow-lg`}
                                        whileHover={{ scale: 1.1, rotate: 5 }}
                                        transition={{
                                            type: 'spring',
                                            stiffness: 400
                                        }}
                                    >
                                        <item.icon
                                            className={`w-7 h-7 ${item.iconColor}`}
                                        />
                                    </motion.div>
                                    <h3 className='text-xl font-bold text-white mb-3'>
                                        {item.title}
                                    </h3>
                                    <p className='text-white/60 text-sm leading-relaxed'>
                                        {item.description}
                                    </p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.section>

                    {/* API Section */}
                    <motion.section
                        className='mb-20'
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <div className='p-8 rounded-3xl bg-gradient-to-br from-blue-500/5 to-transparent border border-blue-500/20'>
                            <div className='flex items-start gap-4 mb-6'>
                                <div className='w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center'>
                                    <Sparkles className='w-6 h-6 text-blue-400' />
                                </div>
                                <div>
                                    <h2 className='text-xl font-bold text-white mb-1'>
                                        Need more control?
                                    </h2>
                                    <p className='text-white/50'>
                                        Use our REST API for custom integrations
                                    </p>
                                </div>
                            </div>

                            <div className='grid md:grid-cols-2 gap-4'>
                                {[
                                    {
                                        icon: MapPin,
                                        label: 'By Address',
                                        code: 'GET /api/ev-score?address=Austin,TX'
                                    },
                                    {
                                        icon: Hash,
                                        label: 'By ZIP Code',
                                        code: 'GET /api/ev-score?zip=78701'
                                    },
                                    {
                                        icon: Navigation,
                                        label: 'By Coordinates',
                                        code: 'GET /api/ev-score?lat=30.27&lng=-97.74'
                                    },
                                    {
                                        icon: Map,
                                        label: 'By County',
                                        code: 'GET /api/ev-score?county=Travis&state=TX'
                                    }
                                ].map((endpoint, i) => (
                                    <motion.div
                                        key={endpoint.label}
                                        className='group p-4 rounded-xl bg-black/40 border border-white/10 hover:border-blue-500/30 hover:bg-black/50 transition-all duration-300'
                                        whileHover={{ scale: 1.02 }}
                                        initial={{
                                            opacity: 0,
                                            x: i % 2 === 0 ? -10 : 10
                                        }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.7 + i * 0.1 }}
                                    >
                                        <div className='flex items-center gap-3 mb-3'>
                                            <div className='w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors'>
                                                <endpoint.icon className='w-4 h-4 text-blue-400' />
                                            </div>
                                            <p className='text-sm font-medium text-white/70 group-hover:text-white transition-colors'>
                                                {endpoint.label}
                                            </p>
                                        </div>
                                        <code className='text-sm text-emerald-400 font-mono'>
                                            {endpoint.code}
                                        </code>
                                    </motion.div>
                                ))}
                            </div>

                            <div className='mt-6 flex gap-4'>
                                <a
                                    href='/docs'
                                    className='inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors'
                                >
                                    View API Docs
                                </a>
                            </div>
                        </div>
                    </motion.section>

                    {/* CTA */}
                    <motion.section
                        className='text-center'
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        <div className='relative p-12 rounded-3xl bg-gradient-to-br from-blue-500/10 via-white/[0.02] to-transparent border border-blue-500/20 overflow-hidden'>
                            <div className='absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.1),transparent_50%)]' />
                            <div className='relative'>
                                <h2 className='text-3xl font-bold text-white mb-4'>
                                    Ready to get started?
                                </h2>
                                <p className='text-white/60 mb-8 max-w-md mx-auto'>
                                    One subscription. Full API and widget
                                    access. Start integrating EV scores today.
                                </p>
                                <div className='flex flex-col sm:flex-row gap-4 justify-center'>
                                    <a
                                        href='/pricing'
                                        className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all hover:shadow-lg hover:shadow-blue-500/25'
                                    >
                                        View Pricing
                                    </a>
                                    <a
                                        href='/support'
                                        className='inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 hover:border-white/20 transition-all'
                                    >
                                        Contact Us
                                    </a>
                                </div>
                            </div>
                        </div>
                    </motion.section>
                </div>
            </main>
        </div>
    )
}
