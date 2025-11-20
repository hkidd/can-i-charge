'use client'

interface ToggleProps {
    checked: boolean
    onChange: (checked: boolean) => void
    colorVar?: string // e.g., 'neon-high', 'neon-mid', 'neon-low'
    className?: string
}

export default function Toggle({
    checked,
    onChange,
    colorVar = 'neon-mid',
    className = ''
}: ToggleProps) {
    return (
        <button
            type='button'
            role='switch'
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`
                w-11 h-6 rounded-full relative cursor-pointer transition-all duration-300 ease-out border focus:outline-none focus:ring-2 focus:ring-white/20
                ${
                    checked
                        ? 'border-transparent bg-white/10'
                        : 'border-white/20 bg-transparent hover:border-white/40'
                }
                ${className}
            `}
        >
            {/* Inner Glow */}
            <div
                className={`
                    absolute inset-0 rounded-full blur-[4px] transition-opacity duration-300
                    ${checked ? 'opacity-40' : 'opacity-0'}
                `}
                style={{ backgroundColor: `var(--${colorVar})` }}
            />

            {/* The Slider Knob */}
            <div
                className='absolute top-1/2 w-4 h-4 rounded-full shadow-md transition-all duration-300 -translate-y-1/2'
                style={{
                    left: checked ? '24px' : '4px',
                    backgroundColor: checked ? `var(--${colorVar})` : 'rgba(255, 255, 255, 0.15)',
                    boxShadow: checked ? `0 0 12px var(--${colorVar})` : '0 2px 4px rgba(0,0,0,0.2)'
                }}
            />
        </button>
    )
}
