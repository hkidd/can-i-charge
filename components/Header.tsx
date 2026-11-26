'use client'

import ServiceStatusBanner from './ServiceStatusBanner'
import { Zap } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/landing'

interface HeaderProps {
    currentPage?: 'home' | 'map' | 'widget' | 'docs' | 'pricing' | 'support'
    theme?: 'light' | 'dark'
    navBg?: string
    borderColor?: string
    showAnimations?: boolean
}

export default function Header({
    currentPage = 'home',
    theme = 'dark',
    navBg,
    borderColor,
    showAnimations = true
}: HeaderProps) {
    const isDark = theme === 'dark'
    const bgStyle = navBg || (isDark ? 'rgba(3, 7, 18, 0.9)' : 'rgba(255, 255, 255, 0.9)')
    const border = borderColor || (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')

    const navLinks = [
        { href: '/widget-demo', label: 'Widget', id: 'widget' as const },
        { href: '/docs', label: 'API', id: 'docs' as const },
        { href: '/pricing', label: 'Pricing', id: 'pricing' as const },
    ]

    const Logo = showAnimations ? motion.a : 'a'
    const NavContainer = showAnimations ? motion.div : 'div'

    const logoProps = showAnimations ? {
        initial: { opacity: 0, x: -20 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.6 },
    } : {}

    const navProps = showAnimations ? {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.6 },
    } : {}

    return (
        <nav
            className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 py-3 md:py-4 backdrop-blur-xl"
            style={{
                backgroundColor: bgStyle,
                borderBottom: `1px solid ${border}`,
                transition: 'background-color 0.3s ease, border-color 0.3s ease',
            }}
        >
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Logo
                    href="/"
                    className="flex items-center gap-2 md:gap-2.5 group"
                    {...logoProps}
                >
                    <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-white" fill="currentColor" strokeWidth={0} />
                    </div>
                    <span className={`text-base md:text-lg font-semibold tracking-tight ${
                        isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                        Can I Charge<span className="text-blue-500">?</span>
                    </span>
                </Logo>

                <NavContainer
                    className="flex items-center gap-4 md:gap-6"
                    {...navProps}
                >
                    {navLinks.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className={`text-sm md:text-base transition-colors hidden sm:block ${
                                currentPage === link.id
                                    ? (isDark ? 'text-white' : 'text-gray-900')
                                    : (isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900')
                            }`}
                        >
                            {link.label}
                        </a>
                    ))}
                    {currentPage !== 'map' && (
                        <Button href="/explore" variant="primary" size="sm">
                            Explore Map
                        </Button>
                    )}
                </NavContainer>
            </div>
            <ServiceStatusBanner />
        </nav>
    )
}
