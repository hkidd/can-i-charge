'use client'

import { motion } from 'framer-motion'
import { CheckCircle, Zap, BookOpen, MessageCircle } from 'lucide-react'
import Header from '@/components/Header'

export default function CheckoutSuccessPage() {
    return (
        <div className="scrollable-page bg-[#030712]">
            <Header currentPage="pricing" theme="dark" />

            <main className="relative pt-28 pb-20 px-6">
                <div className="max-w-2xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, type: 'spring' }}
                        className="mb-8"
                    >
                        <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-emerald-400" />
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                            You&apos;re all set!
                        </h1>
                        <p className="text-xl text-white/50 mb-12">
                            Welcome to Can I Charge Pro. Your API key is on its way to your email.
                        </p>
                    </motion.div>

                    <motion.div
                        className="grid gap-4 text-left"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                    >
                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10">
                            <h3 className="text-white font-semibold mb-4">Next steps</h3>
                            <div className="space-y-4">
                                <a
                                    href="/docs"
                                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                        <BookOpen className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">Read the API docs</div>
                                        <div className="text-white/40 text-sm">Learn how to integrate EV scores</div>
                                    </div>
                                </a>

                                <a
                                    href="/widget-demo"
                                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                                        <Zap className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">Try the widget</div>
                                        <div className="text-white/40 text-sm">Embed scores with one line of code</div>
                                    </div>
                                </a>

                                <a
                                    href="/support"
                                    className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 transition-colors group"
                                >
                                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                                        <MessageCircle className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <div className="text-white font-medium">Get help</div>
                                        <div className="text-white/40 text-sm">Questions? We&apos;re here to help</div>
                                    </div>
                                </a>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    )
}
