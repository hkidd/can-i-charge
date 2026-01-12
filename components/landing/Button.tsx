'use client'

import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface ButtonProps {
    children: ReactNode
    href?: string
    onClick?: () => void
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    className?: string
    icon?: ReactNode
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
}

export default function Button({
    children,
    href,
    onClick,
    variant = 'primary',
    size = 'md',
    className = '',
    icon,
    type = 'button',
    disabled = false,
}: ButtonProps) {
    const baseStyles = `
        relative inline-flex items-center justify-center gap-2
        font-medium rounded-full
        transition-all duration-300
        cursor-pointer select-none
    `

    const variants = {
        primary: `
            bg-blue-500
            text-white
            hover:bg-blue-400
            hover:shadow-[0_0_30px_rgba(59,130,246,0.4)]
        `,
        secondary: `
            bg-white/[0.05] backdrop-blur-sm
            border border-white/[0.1]
            text-white
            hover:bg-white/[0.1] hover:border-white/[0.2]
        `,
        ghost: `
            text-white/70
            hover:text-white hover:bg-white/[0.05]
        `,
    }

    const sizes = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
    }

    const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : ''
    const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${disabledStyles} ${className}`

    const content = (
        <>
            {children}
            {icon && <span className="ml-1">{icon}</span>}
        </>
    )

    const motionProps = disabled ? {} : {
        whileHover: { scale: 1.03 },
        whileTap: { scale: 0.98 },
        transition: { duration: 0.2 },
    }

    if (href) {
        return (
            <motion.a href={href} className={classes} {...motionProps}>
                {content}
            </motion.a>
        )
    }

    return (
        <motion.button type={type} onClick={onClick} disabled={disabled} className={classes} {...motionProps}>
            {content}
        </motion.button>
    )
}
