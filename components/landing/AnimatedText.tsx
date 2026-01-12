'use client'

import { useRef } from 'react'
import { motion, useInView, Variant } from 'framer-motion'

interface AnimatedTextProps {
    text: string
    className?: string
    delay?: number
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'span'
    animation?: 'fade' | 'slide' | 'words' | 'chars'
    highlightWords?: string[]
    highlightClassName?: string
}

export default function AnimatedText({
    text,
    className = '',
    delay = 0,
    as: Component = 'p',
    animation = 'fade',
    highlightWords = [],
    highlightClassName = 'text-blue-500',
}: AnimatedTextProps) {
    const ref = useRef(null)
    const isInView = useInView(ref, { once: true, margin: '-50px' })

    if (animation === 'words') {
        const words = text.split(' ')
        const highlightSet = new Set(highlightWords.map(w => w.toLowerCase()))
        return (
            <Component ref={ref} className={className}>
                {words.map((word, i) => {
                    const isHighlighted = highlightSet.has(word.toLowerCase().replace(/[?!.,]/g, ''))
                    return (
                        <motion.span
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={isInView ? { opacity: 1, y: 0 } : {}}
                            transition={{
                                duration: 0.5,
                                delay: delay + i * 0.1,
                                ease: [0.21, 0.47, 0.32, 0.98],
                            }}
                            style={{ display: 'inline-block', marginRight: '0.25em' }}
                            className={isHighlighted ? highlightClassName : undefined}
                        >
                            {word}
                        </motion.span>
                    )
                })}
            </Component>
        )
    }

    if (animation === 'chars') {
        const chars = text.split('')
        return (
            <Component ref={ref} className={className}>
                {chars.map((char, i) => (
                    <motion.span
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={isInView ? { opacity: 1, y: 0 } : {}}
                        transition={{
                            duration: 0.3,
                            delay: delay + i * 0.02,
                            ease: [0.21, 0.47, 0.32, 0.98],
                        }}
                        style={{ display: 'inline-block' }}
                    >
                        {char === ' ' ? '\u00A0' : char}
                    </motion.span>
                ))}
            </Component>
        )
    }

    const variants: Record<string, Variant> = {
        hidden: {
            opacity: 0,
            y: animation === 'slide' ? 30 : 0,
        },
        visible: {
            opacity: 1,
            y: 0,
        },
    }

    return (
        <motion.div
            ref={ref}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={variants}
            transition={{
                duration: 0.8,
                delay,
                ease: [0.21, 0.47, 0.32, 0.98],
            }}
        >
            <Component className={className}>{text}</Component>
        </motion.div>
    )
}
