export interface BarChartProps {
  value: number
  max: number
  width: number
  color: string
  inverted?: boolean
}

export function BarChart({ value, max, width, color, inverted = false }: BarChartProps) {
  const normalizedValue = inverted && max > 0 ? Math.max(0, max - value) : value
  const filled = max === 0 ? 0 : Math.round((normalizedValue / max) * width)
  const empty = width - filled
  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  return <text fg={color}>{bar}</text>
}
