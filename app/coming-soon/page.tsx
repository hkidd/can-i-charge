'use client'

import { motion } from 'framer-motion'
import { Zap, Bell } from 'lucide-react'
import { useState } from 'react'
import Header from '@/components/Header'

export default function ComingSoonPage() {
    const [email, setEmail] = useState('')
    const [submitted, setSubmitted] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!email.trim()) return

        setSubmitting(true)
        // For now, just simulate submission
        // Later this could save to a waitlist table
        await new Promise(resolve => setTimeout(resolve, 500))
        setSubmitted(true)
        setSubmitting(false)
    }

    return (
        <div className="scrollable-page bg-[#030712]">
            <Header currentPage="home" theme="dark" />

            <main className="relative min-h-screen flex items-center justify-center px-6">
                {/* Background gradient */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
                        style={{
                            background: 'radial-gradient(circle, rgba(37, 99, 235, 0.08) 0%, transparent 60%)',
                        }}
                    />
                </div>

                <div className="relative z-10 max-w-lg mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="mb-8"
                    >
                        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                            <Zap className="w-10 h-10 text-white" />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                            Coming Soon
                        </h1>
                        <p className="text-xl text-white/50 mb-8">
                            We're putting the finishing touches on our API and embeddable widget.
                            Leave your email to be notified when it's ready.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        {submitted ? (
                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                <Bell className="w-5 h-5 mx-auto mb-2" />
                                <p>You're on the list! We'll notify you when we launch.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    required
                                    className="flex-1 px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 outline-none transition-all"
                                />
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all disabled:opacity-50"
                                >
                                    {submitting ? 'Joining...' : 'Notify Me'}
                                </button>
                            </form>
                        )}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="mt-12"
                    >
                        <p className="text-white/30 text-sm mb-4">In the meantime, explore the free map</p>
                        <a
                            href="/explore"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg border border-white/10 transition-colors"
                        >
                            Open Map
                        </a>
                    </motion.div>
                </div>
            </main>
        </div>
    )
}
