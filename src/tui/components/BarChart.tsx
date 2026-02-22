export interface BarChartProps {
  value: number
  max: number
  width: number
  color: string
}

export function BarChart({ value, max, width, color }: BarChartProps) {
  const filled = max === 0 ? 0 : Math.round((value / max) * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return <text fg={color}>{bar}</text>
}
