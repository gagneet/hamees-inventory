'use client'

interface GaugeChartProps {
  value: number
  max: number
  label: string
  unit: string
  goodThreshold?: number
  warningThreshold?: number
}

export function GaugeChart({
  value,
  max,
  label,
  unit,
  goodThreshold = 0.6,
  warningThreshold = 0.8,
}: GaugeChartProps) {
  const percentage = Math.min((value / max) * 100, 100)
  const angle = (percentage / 100) * 180 - 90

  // Determine color based on thresholds
  let color = '#10B981' // Green (good)
  if (value > max * warningThreshold) {
    color = '#EF4444' // Red (bad)
  } else if (value > max * goodThreshold) {
    color = '#F59E0B' // Amber (warning)
  }

  return (
    <div className="flex flex-col items-center p-4">
      <div className="relative w-48 h-24">
        {/* Background arc */}
        <svg className="w-full h-full" viewBox="0 0 200 100">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="60%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#EF4444" />
            </linearGradient>
          </defs>

          {/* Background track */}
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="12"
            strokeLinecap="round"
          />

          {/* Progress arc */}
          <path
            d="M 20 90 A 80 80 0 0 1 180 90"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${(percentage / 100) * 251.2} 251.2`}
          />

          {/* Needle */}
          <line
            x1="100"
            y1="90"
            x2="100"
            y2="20"
            stroke={color}
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${angle} 100 90)`}
            style={{ transition: 'transform 0.5s ease-out' }}
          />

          {/* Center circle */}
          <circle cx="100" cy="90" r="6" fill={color} />
        </svg>

        {/* Value display */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <div className="text-3xl font-bold" style={{ color }}>
            {value}
          </div>
          <div className="text-xs text-slate-500">{unit}</div>
        </div>
      </div>

      <div className="mt-4 text-sm font-medium text-slate-700 text-center">{label}</div>

      {/* Min/Max labels */}
      <div className="flex justify-between w-48 mt-1 px-2">
        <span className="text-xs text-slate-400">0</span>
        <span className="text-xs text-slate-400">{max} {unit}</span>
      </div>
    </div>
  )
}
