import type { Model, BenchmarkResult } from '@ai-speedometer/core/types'
import { useTheme } from '../theme/ThemeContext.tsx'

export const SPINNER_FRAMES = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷']

interface ModelRowProps {
  status: 'pending' | 'running' | 'done' | 'error'
  model: Model
  result?: BenchmarkResult
  error?: string
  spinnerFrame: number
  startedAt?: number
}

function formatElapsed(startedAt: number | undefined): string {
  if (!startedAt) return '0.0s...'
  const s = (Date.now() - startedAt) / 1000
  return `${s.toFixed(1)}s...`
}

export function ModelRow({ status, model, result, error, spinnerFrame, startedAt }: ModelRowProps) {
  const theme = useTheme()

  if (status === 'pending') {
    return (
      <box height={1} width="100%" flexDirection="row">
        <text fg={theme.dim}>  ·  {model.name}  </text>
        <text fg={theme.dim}>({model.providerName})  waiting...</text>
      </box>
    )
  }

  if (status === 'running') {
    const spin = SPINNER_FRAMES[spinnerFrame % 10]
    return (
      <box height={1} width="100%" flexDirection="row">
        <text fg={theme.warning}>  {spin}  </text>
        <text fg={theme.text}>{model.name}  </text>
        <text fg={theme.dim}>({model.providerName})  {formatElapsed(startedAt)}</text>
      </box>
    )
  }

  if (status === 'error') {
    return (
      <box height={1} width="100%" flexDirection="row">
        <text fg={theme.error}>  ✗  {model.name}  ({model.providerName})  {error ?? 'unknown error'}</text>
      </box>
    )
  }

  const tps = result?.tokensPerSecond ?? 0
  const timeSec = (result?.totalTime ?? 0) / 1000
  return (
    <box height={1} width="100%" flexDirection="row">
      <text fg={theme.success}>  ✓  </text>
      <text fg={theme.text}>{model.name}  </text>
      <text fg={theme.dim}>({model.providerName})  </text>
      <text fg={theme.accent}>{tps.toFixed(1)} tok/s  </text>
      <text fg={theme.secondary}>{timeSec.toFixed(2)}s</text>
    </box>
  )
}
