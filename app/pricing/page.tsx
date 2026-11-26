'use client'
import { redirect } from 'next/navigation'

// Temporarily redirect to coming-soon while awaiting Polar approval
// Remove this redirect and 'use client' comment below to restore the page
redirect('/coming-soon')

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, X, Zap, Map, Building2 } from 'lucide-react'
import Header from '@/components/Header'

const FEATURES = [
    { name: 'Interactive US Map', free: true, pro: true },
    { name: 'Search any location', free: true, pro: true },
    { name: 'View EV scores & grades', free: true, pro: true },
    { name: 'State & county rankings', free: true, pro: true },
    { name: 'API Access', free: false, pro: true },
    { name: 'Embeddable Widget', free: false, pro: true },
    { name: '1,000 requests / day', free: false, pro: true },
    { name: 'Commercial use', free: false, pro: true },
    { name: 'Priority support', free: false, pro: true }
]

export default function PricingPage() {
    const [isAnnual, setIsAnnual] = useState(false)
    const monthlyPrice = 29
    const annualPrice = 24 // per month, billed annually

    const handleCheckout = async () => {
        // TODO: Replace with your Lemon Squeezy checkout URL
        // window.location.href = 'https://your-store.lemonsqueezy.com/checkout/buy/xxx'
        alert('Lemon Squeezy checkout will be configured here')
    }

    return (
        <div className='scrollable-page bg-[#030712]'>
            <Header currentPage='pricing' theme='dark' />

            <main className='relative pt-28 pb-20 px-6'>
                <div className='max-w-5xl mx-auto'>
                    {/* Hero */}
                    <motion.div
                        className='text-center mb-16'
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <h1 className='text-5xl md:text-6xl font-bold text-white mb-6'>
                            Choose your{' '}
                            <span className='text-blue-500'>plan</span>
                        </h1>
                        <p className='text-xl text-white/50 max-w-2xl mx-auto'>
                            Explore for free, or unlock the full API and widget
                            for your business.
                        </p>
                    </motion.div>

                    {/* Billing Toggle */}
                    <motion.div
                        className='flex items-center justify-center gap-4 mb-12'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        <span
                            className={`text-sm ${
                                !isAnnual ? 'text-white' : 'text-white/40'
                            }`}
                        >
                            Monthly
                        </span>
                        <button
                            onClick={() => setIsAnnual(!isAnnual)}
                            className={`relative w-14 h-7 rounded-full transition-colors ${
                                isAnnual ? 'bg-blue-600' : 'bg-white/20'
                            }`}
                        >
                            <motion.div
                                className='absolute top-1 w-5 h-5 bg-white rounded-full shadow-md'
                                animate={{ left: isAnnual ? '32px' : '4px' }}
                                transition={{
                                    type: 'spring',
                                    stiffness: 500,
                                    damping: 30
                                }}
                            />
                        </button>
                        <span
                            className={`text-sm ${
                                isAnnual ? 'text-white' : 'text-white/40'
                            }`}
                        >
                            Annual
                            <span className='ml-2 text-emerald-400 text-xs font-medium'>
                                Save 17%
                            </span>
                        </span>
                    </motion.div>

                    {/* Pricing Cards */}
                    <div className='grid md:grid-cols-2 gap-8 max-w-4xl mx-auto'>
                        {/* Free Tier */}
                        <motion.div
                            className='relative p-8 rounded-3xl bg-white/[0.02] border border-white/10'
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 }}
                        >
                            <div className='mb-8'>
                                <div className='w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center mb-4'>
                                    <Map className='w-6 h-6 text-white/60' />
                                </div>
                                <h2 className='text-2xl font-bold text-white mb-2'>
                                    Free
                                </h2>
                                <p className='text-white/50 text-sm'>
                                    Explore EV infrastructure across the US
                                </p>
                            </div>

                            <div className='mb-8'>
                                <div className='flex items-baseline gap-1'>
                                    <span className='text-5xl font-bold text-white'>
                                        $0
                                    </span>
                                    <span className='text-white/40'>
                                        /month
                                    </span>
                                </div>
                            </div>

                            <a
                                href='/explore'
                                className='block w-full py-3 px-6 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-center transition-colors mb-8'
                            >
                                Open Map
                            </a>

                            <div className='space-y-4'>
                                {FEATURES.map((feature) => (
                                    <div
                                        key={feature.name}
                                        className='flex items-center gap-3'
                                    >
                                        {feature.free ? (
                                            <div className='w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center'>
                                                <Check className='w-3 h-3 text-emerald-400' />
                                            </div>
                                        ) : (
                                            <div className='w-5 h-5 rounded-full bg-white/5 flex items-center justify-center'>
                                                <X className='w-3 h-3 text-white/20' />
                                            </div>
                                        )}
                                        <span
                                            className={
                                                feature.free
                                                    ? 'text-white/70'
                                                    : 'text-white/30'
                                            }
                                        >
                                            {feature.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Pro Tier */}
                        <motion.div
                            className='relative p-8 rounded-3xl bg-gradient-to-br from-blue-500/20 via-blue-500/5 to-transparent border border-blue-500/30 shadow-[0_0_60px_-15px_rgba(59,130,246,0.3)]'
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 }}
                        >
                            {/* Popular Badge */}
                            <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
                                <div className='px-4 py-1 rounded-full bg-blue-500 text-white text-xs font-semibold'>
                                    Most Popular
                                </div>
                            </div>

                            <div className='mb-8'>
                                <div className='w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/25'>
                                    <Zap className='w-6 h-6 text-white' />
                                </div>
                                <h2 className='text-2xl font-bold text-white mb-2'>
                                    Pro
                                </h2>
                                <p className='text-white/50 text-sm'>
                                    Full API & widget access for your business
                                </p>
                            </div>

                            <div className='mb-8'>
                                <div className='flex items-baseline gap-1'>
                                    <span className='text-5xl font-bold text-white'>
                                        ${isAnnual ? annualPrice : monthlyPrice}
                                    </span>
                                    <span className='text-white/40'>
                                        /month
                                    </span>
                                </div>
                                {isAnnual && (
                                    <p className='text-sm text-white/40 mt-1'>
                                        ${annualPrice * 12} billed annually
                                    </p>
                                )}
                            </div>

                            <button
                                onClick={handleCheckout}
                                className='block w-full py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-center transition-all hover:shadow-lg hover:shadow-blue-500/25 mb-8'
                            >
                                Get Started
                            </button>

                            <div className='space-y-4'>
                                {FEATURES.map((feature) => (
                                    <div
                                        key={feature.name}
                                        className='flex items-center gap-3'
                                    >
                                        <div className='w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center'>
                                            <Check className='w-3 h-3 text-emerald-400' />
                                        </div>
                                        <span className='text-white/70'>
                                            {feature.name}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>

                    {/* Enterprise CTA */}
                    <motion.div
                        className='mt-16 text-center'
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.6 }}
                    >
                        <div className='inline-flex items-center gap-4 p-6 rounded-2xl bg-white/[0.02] border border-white/10'>
                            <Building2 className='w-8 h-8 text-white/40' />
                            <div className='text-left'>
                                <h3 className='text-white font-semibold'>
                                    Need higher limits?
                                </h3>
                                <p className='text-white/40 text-sm'>
                                    Contact us for enterprise pricing and custom
                                    integrations.
                                </p>
                            </div>
                            <a
                                href='/support'
                                className='px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium transition-colors'
                            >
                                Contact Us
                            </a>
                        </div>
                    </motion.div>

                    {/* FAQ */}
                    <motion.section
                        className='mt-20'
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        <h2 className='text-2xl font-bold text-white text-center mb-10'>
                            Common questions
                        </h2>
                        <div className='grid md:grid-cols-2 gap-6 max-w-4xl mx-auto'>
                            {[
                                {
                                    q: 'What counts as a request?',
                                    a: 'Each API call or widget load counts as one request. The interactive map on our site is free and unlimited.'
                                },
                                {
                                    q: 'Can I cancel anytime?',
                                    a: 'Yes, cancel anytime from your dashboard. Your access continues until the end of your billing period.'
                                },
                                {
                                    q: 'Do you offer refunds?',
                                    a: "If you're not satisfied within the first 7 days, contact us for a full refund."
                                },
                                {
                                    q: 'What happens if I exceed my limit?',
                                    a: "We'll send you a warning at 80% usage. If you exceed 1,000 requests, additional requests will be rate-limited until the next day."
                                }
                            ].map((faq, i) => (
                                <div
                                    key={i}
                                    className='p-6 rounded-2xl bg-white/[0.02] border border-white/5'
                                >
                                    <h3 className='text-white font-semibold mb-2'>
                                        {faq.q}
                                    </h3>
                                    <p className='text-white/50 text-sm leading-relaxed'>
                                        {faq.a}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </motion.section>
                </div>
            </main>
        </div>
    )
}
