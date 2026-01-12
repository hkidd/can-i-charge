'use client'

import { ReactNode, useRef, useState } from 'react'
import { motion } from 'framer-motion'

interface TiltCardProps {
  children: ReactNode
  className?: string
  glowColor?: string
}

export default function TiltCard({ children, className = '', glowColor = 'rgba(16,185,129,0.15)' }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return

    const rect = cardRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const mouseX = e.clientX - centerX
    const mouseY = e.clientY - centerY

    // Calculate rotation (max 15 degrees)
    const rotateXValue = (mouseY / (rect.height / 2)) * -10
    const rotateYValue = (mouseX / (rect.width / 2)) * 10

    setRotateX(rotateXValue)
    setRotateY(rotateYValue)
  }

  const handleMouseLeave = () => {
    setRotateX(0)
    setRotateY(0)
    setIsHovered(false)
  }

  return (
    <motion.div
      ref={cardRef}
      className={`relative ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        transformStyle: 'preserve-3d',
        perspective: '1000px',
      }}
      animate={{
        rotateX,
        rotateY,
        scale: isHovered ? 1.02 : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
    >
      {/* Glow effect */}
      <motion.div
        className="absolute -inset-1 rounded-2xl blur-xl"
        style={{ background: glowColor }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Card content */}
      <div
        className="relative rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] overflow-hidden"
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Shine effect on hover */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(
              ${105 + rotateY}deg,
              transparent 40%,
              rgba(255,255,255,0.03) 45%,
              rgba(255,255,255,0.06) 50%,
              rgba(255,255,255,0.03) 55%,
              transparent 60%
            )`,
          }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />

        <div style={{ transform: 'translateZ(20px)' }}>
          {children}
        </div>
      </div>
    </motion.div>
  )
}
