'use client'

import { useEffect, useState } from 'react'
import { motion, useSpring, useMotionValue } from 'framer-motion'

interface GradientOrb {
  color: string
  size: number
  offsetX: number
  offsetY: number
  delay: number
}

const ORBS: GradientOrb[] = [
  { color: '#3b82f6', size: 600, offsetX: -0.2, offsetY: -0.1, delay: 0 },    // Electric blue (primary)
  { color: '#06b6d4', size: 500, offsetX: 0.15, offsetY: 0.2, delay: 0.1 },   // Cyan (accent)
  { color: '#10b981', size: 400, offsetX: 0.1, offsetY: -0.15, delay: 0.2 },  // Emerald (secondary)
]

export default function MouseFollowGradient() {
  const [mounted, setMounted] = useState(false)

  // Mouse position motion values
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  // Spring physics for smooth following
  const springConfig = { stiffness: 50, damping: 30, mass: 1 }
  const springX = useSpring(mouseX, springConfig)
  const springY = useSpring(mouseY, springConfig)

  useEffect(() => {
    setMounted(true)

    const handleMouseMove = (e: MouseEvent) => {
      // Normalize mouse position to center of screen (0,0 = center)
      const x = (e.clientX / window.innerWidth - 0.5) * 2
      const y = (e.clientY / window.innerHeight - 0.5) * 2

      mouseX.set(x * 100) // Scale for more noticeable movement
      mouseY.set(y * 100)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  if (!mounted) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {ORBS.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-[120px]"
          style={{
            width: orb.size,
            height: orb.size,
            left: `calc(50% + ${orb.offsetX * 100}%)`,
            top: `calc(50% + ${orb.offsetY * 100}%)`,
            x: springX,
            y: springY,
            backgroundColor: orb.color,
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{
            opacity: [0.08, 0.12, 0.08],
            scale: [1, 1.1, 1],
          }}
          transition={{
            opacity: { duration: 4, repeat: Infinity, delay: orb.delay * 2 },
            scale: { duration: 8, repeat: Infinity, delay: orb.delay * 2 },
          }}
        />
      ))}
    </div>
  )
}
