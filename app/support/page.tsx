'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Heart, Zap, Coffee, Car, MessageCircle, Sparkles, ExternalLink, CreditCard, Key } from 'lucide-react'
import Header from '@/components/Header'

export default function SupportPage() {
    const [feedbackEmail, setFeedbackEmail] = useState('')
    const [feedbackMessage, setFeedbackMessage] = useState('')
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
    const [feedbackSuccess, setFeedbackSuccess] = useState(false)
    const [feedbackError, setFeedbackError] = useState('')
    const [hoveredCard, setHoveredCard] = useState<string | null>(null)

    // API Key resend state
    const [apiKeyEmail, setApiKeyEmail] = useState('')
    const [apiKeySubmitting, setApiKeySubmitting] = useState(false)
    const [apiKeySuccess, setApiKeySuccess] = useState(false)
    const [apiKeyError, setApiKeyError] = useState('')

    const handleFeedbackSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setFeedbackSubmitting(true)
        setFeedbackError('')
        setFeedbackSuccess(false)

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: feedbackEmail,
                    message: feedbackMessage
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to submit')

            setFeedbackSuccess(true)
            setFeedbackEmail('')
            setFeedbackMessage('')
            setTimeout(() => setFeedbackSuccess(false), 5000)
        } catch (err) {
            setFeedbackError(
                err instanceof Error ? err.message : 'Failed to submit feedback'
            )
        } finally {
            setFeedbackSubmitting(false)
        }
    }

    const handleApiKeyResend = async (e: React.FormEvent) => {
        e.preventDefault()
        setApiKeySubmitting(true)
        setApiKeyError('')
        setApiKeySuccess(false)

        try {
            const response = await fetch('/api/resend-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: apiKeyEmail })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to send')

            setApiKeySuccess(true)
            setApiKeyEmail('')
            setTimeout(() => setApiKeySuccess(false), 5000)
        } catch (err) {
            setApiKeyError(
                err instanceof Error ? err.message : 'Failed to send API key'
            )
        } finally {
            setApiKeySubmitting(false)
        }
    }

    return (
        <div className="scrollable-page bg-[#030712]">
            <Header currentPage="home" theme="dark" />

            {/* Animated background gradient */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden">
                <motion.div
                    className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 70%)',
                    }}
                    animate={{
                        x: [0, 50, 0],
                        y: [0, 30, 0],
                    }}
                    transition={{
                        duration: 20,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
                <motion.div
                    className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full"
                    style={{
                        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%)',
                    }}
                    animate={{
                        x: [0, -30, 0],
                        y: [0, -50, 0],
                    }}
                    transition={{
                        duration: 15,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                />
            </div>

            <main className="relative pt-28 pb-20 px-6">
                <div className="max-w-4xl mx-auto">
                    {/* Hero */}
                    <motion.div
                        className="text-center mb-20"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <motion.div
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-6"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Sparkles className="w-4 h-4 text-yellow-400" />
                            <span className="text-sm text-white/70">100% independent project</span>
                        </motion.div>

                        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
                            Support the{' '}
                            <span className="text-blue-500">mission</span>
                        </h1>
                        <p className="text-xl text-white/50 max-w-xl mx-auto leading-relaxed">
                            Can I Charge? is built and maintained by one person. Your support keeps it free for everyone.
                        </p>
                    </motion.div>

                    {/* Support Cards */}
                    <div className="grid md:grid-cols-2 gap-6 mb-16">
                        {/* Coffee Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            onMouseEnter={() => setHoveredCard('coffee')}
                            onMouseLeave={() => setHoveredCard(null)}
                        >
                            <Link
                                href="https://buymeacoffee.com/harrisonkidd"
                                target="_blank"
                                className="block group"
                            >
                                <div className="relative p-8 rounded-3xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/20 overflow-hidden transition-all duration-500 hover:border-amber-500/40 hover:shadow-[0_0_60px_-15px_rgba(251,191,36,0.3)]">
                                    {/* Animated background on hover */}
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: hoveredCard === 'coffee' ? 1 : 0 }}
                                        transition={{ duration: 0.3 }}
                                    />

                                    <div className="relative">
                                        <div className="flex items-start justify-between mb-6">
                                            <motion.div
                                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20"
                                                whileHover={{ scale: 1.1, rotate: 5 }}
                                                transition={{ type: 'spring', stiffness: 400 }}
                                            >
                                                <Coffee className="w-8 h-8 text-white" />
                                            </motion.div>
                                            <ExternalLink className="w-5 h-5 text-white/30 group-hover:text-amber-400 transition-colors" />
                                        </div>

                                        <h2 className="text-2xl font-bold text-white mb-2">
                                            Buy me a coffee
                                        </h2>
                                        <p className="text-white/50 mb-6">
                                            Fuel late-night coding sessions and keep the servers running. Every coffee counts!
                                        </p>

                                        <div className="flex items-center gap-2 text-amber-400 font-medium group-hover:gap-3 transition-all">
                                            <span>Support on BMC</span>
                                            <motion.span
                                                animate={{ x: hoveredCard === 'coffee' ? 4 : 0 }}
                                            >
                                                →
                                            </motion.span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>

                        {/* Rivian Card */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            onMouseEnter={() => setHoveredCard('rivian')}
                            onMouseLeave={() => setHoveredCard(null)}
                        >
                            <Link
                                href="https://rivian.com/configurations/list?reprCode=HARRISON19045910"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block group"
                            >
                                <div className="relative p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-500/20 overflow-hidden transition-all duration-500 hover:border-emerald-500/40 hover:shadow-[0_0_60px_-15px_rgba(16,185,129,0.3)]">
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: hoveredCard === 'rivian' ? 1 : 0 }}
                                        transition={{ duration: 0.3 }}
                                    />

                                    <div className="relative">
                                        <div className="flex items-start justify-between mb-6">
                                            <motion.div
                                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20"
                                                whileHover={{ scale: 1.1, rotate: -5 }}
                                                transition={{ type: 'spring', stiffness: 400 }}
                                            >
                                                <Car className="w-8 h-8 text-white" />
                                            </motion.div>
                                            <ExternalLink className="w-5 h-5 text-white/30 group-hover:text-emerald-400 transition-colors" />
                                        </div>

                                        <h2 className="text-2xl font-bold text-white mb-2">
                                            Shop Rivian
                                        </h2>
                                        <p className="text-white/50 mb-6">
                                            Planning to order an R1T or R1S? Use my referral and we both get rewards at delivery!
                                        </p>

                                        <div className="flex items-center gap-2 text-emerald-400 font-medium group-hover:gap-3 transition-all">
                                            <span>Use referral link</span>
                                            <motion.span
                                                animate={{ x: hoveredCard === 'rivian' ? 4 : 0 }}
                                            >
                                                →
                                            </motion.span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    </div>

                    {/* Why Support Section */}
                    <motion.div
                        className="mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                    >
                        <div className="text-center mb-10">
                            <h2 className="text-2xl font-bold text-white mb-2">Where your support goes</h2>
                            <p className="text-white/40">Keeping Can I Charge? running and improving</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { icon: Zap, label: 'Server Costs', color: 'blue' },
                                { icon: Heart, label: 'Development', color: 'pink' },
                                { icon: Sparkles, label: 'New Features', color: 'purple' },
                                { icon: Coffee, label: 'Caffeine', color: 'amber' },
                            ].map((item, i) => (
                                <motion.div
                                    key={item.label}
                                    className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-center"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.6 + i * 0.1 }}
                                    whileHover={{ scale: 1.05, borderColor: 'rgba(255,255,255,0.1)' }}
                                >
                                    <item.icon className={`w-6 h-6 mx-auto mb-2 text-${item.color}-400`} />
                                    <span className="text-sm text-white/60">{item.label}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* Manage Subscription */}
                    <motion.div
                        className="mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.65 }}
                    >
                        <a
                            href="https://polar.sh/canicharge/portal"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-colors group"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                    <CreditCard className="w-5 h-5 text-white/60" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium">Manage subscription</h3>
                                    <p className="text-sm text-white/40">Update billing, view invoices, or cancel</p>
                                </div>
                            </div>
                            <ExternalLink className="w-4 h-4 text-white/30 group-hover:text-white/60 transition-colors" />
                        </a>
                    </motion.div>

                    {/* Lost API Key */}
                    <motion.div
                        className="mb-16"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.68 }}
                    >
                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <Key className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <h3 className="text-white font-medium">Lost your API key?</h3>
                                    <p className="text-sm text-white/40">Enter your email to receive it again</p>
                                </div>
                            </div>

                            {apiKeySuccess && (
                                <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                                    If you have an active subscription, your API key has been sent to your email.
                                </div>
                            )}

                            {apiKeyError && (
                                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    {apiKeyError}
                                </div>
                            )}

                            <form onSubmit={handleApiKeyResend} className="flex gap-3">
                                <input
                                    type="email"
                                    value={apiKeyEmail}
                                    onChange={(e) => setApiKeyEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    required
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-black/30 border border-white/10 text-white placeholder-white/30 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all text-sm"
                                />
                                <button
                                    type="submit"
                                    disabled={apiKeySubmitting || !apiKeyEmail.trim()}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                                >
                                    {apiKeySubmitting ? 'Sending...' : 'Send'}
                                </button>
                            </form>
                        </div>
                    </motion.div>

                    {/* Feedback Section */}
                    <motion.div
                        id="feedback"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                    >
                        <div className="p-8 md:p-10 rounded-3xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                    <MessageCircle className="w-6 h-6 text-blue-400" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Send feedback</h2>
                                    <p className="text-sm text-white/40">Ideas, bugs, or just say hi</p>
                                </div>
                            </div>

                            {feedbackSuccess && (
                                <motion.div
                                    className="mb-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm flex items-center gap-3"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span>Thanks for the feedback! I read every message.</span>
                                </motion.div>
                            )}

                            {feedbackError && (
                                <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                                    {feedbackError}
                                </div>
                            )}

                            <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                                <div>
                                    <input
                                        type="email"
                                        value={feedbackEmail}
                                        onChange={(e) => setFeedbackEmail(e.target.value)}
                                        className="w-full px-5 py-4 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                                        placeholder="Email (optional, for replies)"
                                    />
                                </div>

                                <div>
                                    <textarea
                                        value={feedbackMessage}
                                        onChange={(e) => setFeedbackMessage(e.target.value)}
                                        rows={4}
                                        maxLength={5000}
                                        required
                                        className="w-full px-5 py-4 rounded-xl bg-black/30 border border-white/10 text-white placeholder-white/30 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all resize-none"
                                        placeholder="What's on your mind?"
                                    />
                                </div>

                                <motion.button
                                    type="submit"
                                    disabled={feedbackSubmitting || !feedbackMessage.trim()}
                                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                                    whileHover={{ scale: feedbackMessage.trim() ? 1.01 : 1 }}
                                    whileTap={{ scale: feedbackMessage.trim() ? 0.99 : 1 }}
                                >
                                    {feedbackSubmitting ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <motion.div
                                                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                                animate={{ rotate: 360 }}
                                                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                                            />
                                            Sending...
                                        </span>
                                    ) : (
                                        'Send feedback'
                                    )}
                                </motion.button>
                            </form>
                        </div>
                    </motion.div>

                    {/* Bottom message */}
                    <motion.p
                        className="text-center text-white/30 text-sm mt-12"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 1 }}
                    >
                        Built with <Heart className="w-3 h-3 inline text-red-400 mx-1" /> for the EV community
                    </motion.p>
                </div>
            </main>
        </div>
    )
}
