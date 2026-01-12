'use client'

import { motion } from 'framer-motion'

interface StateRanking {
  rank: number
  state: string
  score: number
}

interface AnimatedBarChartProps {
  data: StateRanking[]
}

function getBarGradient(rank: number): string {
  if (rank === 1) return 'linear-gradient(90deg, #fbbf24, #f59e0b)' // Gold
  if (rank === 2) return 'linear-gradient(90deg, #d1d5db, #9ca3af)' // Silver
  if (rank === 3) return 'linear-gradient(90deg, #fb923c, #ea580c)' // Bronze
  return '#a5b4fc' // Muted indigo for 4th and below
}

function getRankBadgeStyle(rank: number): string {
  if (rank === 1) return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  if (rank === 2) return 'bg-gray-400/20 text-gray-300 border-gray-400/30'
  if (rank === 3) return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
  return 'bg-white/5 text-white/40 border-white/10'
}

export default function AnimatedBarChart({ data }: AnimatedBarChartProps) {
  const maxScore = 100 // Max possible score

  return (
    <div className="space-y-4">
      {data.map((item, i) => (
        <motion.div
          key={item.state}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          viewport={{ once: true }}
          className="group"
        >
          <div className="flex items-center gap-4">
            {/* Rank Badge */}
            <motion.div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border ${getRankBadgeStyle(item.rank)}`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              {item.rank}
            </motion.div>

            {/* State Name and Bar */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-white">{item.state}</span>
                <span className="text-lg font-bold text-white">{item.score}</span>
              </div>

              {/* Animated Bar */}
              <div className="relative h-3 bg-white/[0.08] rounded-full overflow-hidden">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: getBarGradient(item.rank) }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${(item.score / maxScore) * 100}%` }}
                  transition={{
                    delay: i * 0.08 + 0.1,
                    duration: 0.8,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                  viewport={{ once: true }}
                />
                {/* Shimmer effect on hover */}
                <motion.div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
                    backgroundSize: '200% 100%',
                  }}
                  animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}
