'use client'

import { ReactNode, useRef, useState, useEffect } from 'react'
import { motion, PanInfo } from 'framer-motion'

interface DraggableCarouselProps {
  children: ReactNode[]
  className?: string
}

export default function DraggableCarousel({ children, className = '' }: DraggableCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(1) // Start with middle item (standard widget)
  const [dragX, setDragX] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)

  const itemWidth = 300 // Width of each widget
  const gap = 24

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth)
    }

    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate position to center the active item
  const getTargetX = (index: number) => {
    const itemTotalWidth = itemWidth + gap
    const centerOffset = (containerWidth - itemWidth) / 2
    return centerOffset - (index * itemTotalWidth)
  }

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 50
    const velocity = info.velocity.x

    let newIndex = activeIndex

    if (velocity < -300 || info.offset.x < -threshold) {
      newIndex = Math.min(activeIndex + 1, children.length - 1)
    } else if (velocity > 300 || info.offset.x > threshold) {
      newIndex = Math.max(activeIndex - 1, 0)
    }

    setActiveIndex(newIndex)
    setDragX(getTargetX(newIndex))
  }

  const goToSlide = (index: number) => {
    setActiveIndex(index)
    setDragX(getTargetX(index))
  }

  // Set initial position once container width is known
  useEffect(() => {
    if (containerWidth > 0) {
      setDragX(getTargetX(1)) // Start centered on middle item
    }
  }, [containerWidth])

  return (
    <div className={`relative ${className}`}>
      {/* Carousel container */}
      <div ref={containerRef} className="overflow-hidden">
        <motion.div
          className="flex gap-6 cursor-grab active:cursor-grabbing py-4"
          drag="x"
          dragConstraints={{
            left: getTargetX(children.length - 1),
            right: getTargetX(0),
          }}
          dragElastic={0.1}
          onDragEnd={handleDragEnd}
          animate={{ x: dragX }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          whileDrag={{ cursor: 'grabbing' }}
        >
          {children.map((child, i) => (
            <motion.div
              key={i}
              className="flex-shrink-0"
              style={{ width: itemWidth }}
              animate={{
                scale: i === activeIndex ? 1 : 0.9,
                opacity: i === activeIndex ? 1 : 0.5,
              }}
              transition={{ duration: 0.3 }}
            >
              {child}
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-3 mt-6">
        {children.map((_, i) => (
          <button
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? 'bg-blue-500 scale-125'
                : 'bg-white/20 hover:bg-white/40'
            }`}
            onClick={() => goToSlide(i)}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Drag hint */}
      <motion.div
        className="text-center mt-4 text-white/30 text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.span
          animate={{ x: [-4, 4, -4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          ← Drag to explore →
        </motion.span>
      </motion.div>
    </div>
  )
}
