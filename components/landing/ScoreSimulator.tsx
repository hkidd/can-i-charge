'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Target, Zap, Network, Timer } from 'lucide-react'

const FACTORS = [
  {
    id: 'nearby',
    icon: Target,
    label: 'Nearby Chargers',
    description: 'Stations within 5 miles',
    max: 40,
    color: '#34d399',
    gradient: 'linear-gradient(to right, #10b981, #34d399)',
  },
  {
    id: 'fast',
    icon: Zap,
    label: 'Fast Charging',
    description: 'DC fast charger availability',
    max: 25,
    color: '#22d3ee',
    gradient: 'linear-gradient(to right, #06b6d4, #22d3ee)',
  },
  {
    id: 'diversity',
    icon: Network,
    label: 'Network Diversity',
    description: 'Mix of charging networks',
    max: 20,
    color: '#a78bfa',
    gradient: 'linear-gradient(to right, #8b5cf6, #a78bfa)',
  },
  {
    id: 'density',
    icon: Timer,
    label: 'Charging Density',
    description: 'Distance to nearest charger',
    max: 15,
    color: '#fbbf24',
    gradient: 'linear-gradient(to right, #f59e0b, #fbbf24)',
  },
]

function getGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 85) return 'A'
  if (score >= 80) return 'A-'
  if (score >= 75) return 'B+'
  if (score >= 70) return 'B'
  if (score >= 65) return 'B-'
  if (score >= 60) return 'C+'
  if (score >= 55) return 'C'
  if (score >= 50) return 'C-'
  if (score >= 45) return 'D+'
  if (score >= 40) return 'D'
  if (score >= 35) return 'D-'
  return 'F'
}

function getGradeColor(grade: string): string {
  if (grade.startsWith('A')) return '#10b981'
  if (grade.startsWith('B')) return '#22d3ee'
  if (grade.startsWith('C')) return '#fbbf24'
  if (grade.startsWith('D')) return '#f97316'
  return '#ef4444'
}

export default function ScoreSimulator() {
  const [values, setValues] = useState({
    nearby: 25,
    fast: 15,
    diversity: 12,
    density: 10,
  })

  const totalScore = values.nearby + values.fast + values.diversity + values.density
  const grade = getGrade(totalScore)
  const gradeColor = getGradeColor(grade)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      {/* Sliders */}
      <div className="space-y-8 bg-white/[0.02] rounded-2xl p-8 border border-white/[0.06]">
        {FACTORS.map((factor) => {
          const value = values[factor.id as keyof typeof values]
          const percentage = (value / factor.max) * 100

          return (
            <div key={factor.id} className="group">
              <div className="flex items-center gap-3 mb-3">
                <factor.icon className="w-5 h-5" style={{ color: factor.color }} strokeWidth={1.5} />
                <span className="font-medium text-white">{factor.label}</span>
                <span className="ml-auto text-sm text-white/60 font-medium">{value}/{factor.max} pts</span>
              </div>

              {/* Custom slider */}
              <div className="relative h-8 flex items-center">
                {/* Track background */}
                <div className="absolute left-0 right-0 h-3 bg-white/[0.1] rounded-full">
                  {/* Filled track */}
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ background: factor.gradient }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  />
                </div>
                {/* Invisible range input for interaction */}
                <input
                  type="range"
                  min="0"
                  max={factor.max}
                  value={value}
                  onChange={(e) => setValues({ ...values, [factor.id]: parseInt(e.target.value) })}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                {/* Thumb indicator */}
                <motion.div
                  className="absolute w-6 h-6 rounded-full bg-white shadow-lg pointer-events-none z-10"
                  style={{
                    border: `2px solid ${factor.color}`,
                    left: `calc(${percentage}% - 12px)`,
                  }}
                  animate={{ left: `calc(${percentage}% - 12px)` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                />
              </div>

              <p className="text-xs text-white/40 mt-2">{factor.description}</p>
            </div>
          )
        })}
      </div>

      {/* Live Score Display - matching widget style */}
      <div className="flex justify-center">
        <motion.div
          className="relative"
          animate={{ scale: [1, 1.01, 1] }}
          transition={{ duration: 0.3 }}
          key={totalScore}
        >
          {/* Score card - widget style */}
          <div
            className="relative rounded-2xl p-6"
            style={{
              width: '340px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {/* Header */}
            <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-5">
              EV Readiness Score
            </div>

            {/* Score display - horizontal layout like widget */}
            <div className="flex items-center gap-5 mb-5">
              <motion.div
                className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-3xl font-bold text-white"
                style={{
                  background: `linear-gradient(135deg, ${gradeColor}, ${gradeColor}dd)`,
                  boxShadow: `0 4px 20px ${gradeColor}40`,
                }}
                key={grade}
              >
                {grade}
              </motion.div>
              <div>
                <motion.div
                  className="text-5xl font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #ecfdf5, #ecfdf5aa)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                  key={totalScore}
                  initial={{ scale: 1.1, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  {totalScore}
                </motion.div>
                <div className="text-sm text-white/50 mt-1">out of 100</div>
              </div>
            </div>

            {/* Breakdown section */}
            <div className="border-t border-white/[0.08] pt-5">
              <div className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-3">
                Score Breakdown
              </div>
              <div className="space-y-3">
                {FACTORS.map((factor) => {
                  const value = values[factor.id as keyof typeof values]
                  const percentage = (value / factor.max) * 100

                  return (
                    <div key={factor.id}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-white/70">{factor.label}</span>
                        <span className="font-medium text-white">{value}/{factor.max}</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${factor.color}, ${factor.color}cc)` }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
