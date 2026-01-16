'use client'

import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from 'recharts'

interface RadialProgressProps {
  current: number
  target: number
  label: string
  color?: string
}

export function RadialProgress({ current, target, label, color = '#10B981' }: RadialProgressProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const isComplete = current >= target

  const data = [
    {
      name: label,
      value: percentage,
      fill: isComplete ? '#10B981' : current > target * 0.75 ? '#F59E0B' : '#EF4444',
    },
  ]

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <ResponsiveContainer width={200} height={200}>
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background
              dataKey="value"
              cornerRadius={10}
              fill={data[0].fill}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-slate-900">{current}</div>
          <div className="text-sm text-slate-500">of {target}</div>
          <div className="text-xs text-slate-400 mt-1">{Math.round(percentage)}%</div>
        </div>
      </div>
      <div className="mt-2 text-sm font-medium text-slate-700">{label}</div>
    </div>
  )
}
