'use client'

import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import Header from '@/components/Header'

export default function ComingSoonPage() {
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
                            Our API and embeddable widget are in development.
                            You can explore current charging readiness on the free map.
                        </p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="mt-12"
                    >
                        <p className="text-white/60 text-sm mb-4">In the meantime, explore the free map</p>
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
