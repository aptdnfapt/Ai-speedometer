import type { Model, BenchmarkResult } from '../../types.ts'

export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

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
  if (status === 'pending') {
    return (
      <box height={1} width="100%" flexDirection="row">
        <text fg="#565f89">  ·  {model.name}  </text>
        <text fg="#565f89">({model.providerName})  waiting...</text>
      </box>
    )
  }

  if (status === 'running') {
    const spin = SPINNER_FRAMES[spinnerFrame % 10]
    return (
      <box height={1} width="100%" flexDirection="row">
        <text fg="#ff9e64">  {spin}  </text>
        <text fg="#c0caf5">{model.name}  </text>
        <text fg="#565f89">({model.providerName})  {formatElapsed(startedAt)}</text>
      </box>
    )
  }

  if (status === 'error') {
    return (
      <box height={1} width="100%" flexDirection="row">
        <text fg="#f7768e">  ✗  {model.name}  ({model.providerName})  {error ?? 'unknown error'}</text>
      </box>
    )
  }

  // done — single clean summary line
  const tps = result?.tokensPerSecond ?? 0
  const timeSec = (result?.totalTime ?? 0) / 1000
  return (
    <box height={1} width="100%" flexDirection="row">
      <text fg="#9ece6a">  ✓  </text>
      <text fg="#c0caf5">{model.name}  </text>
      <text fg="#565f89">({model.providerName})  </text>
      <text fg="#7dcfff">{tps.toFixed(1)} tok/s  </text>
      <text fg="#bb9af7">{timeSec.toFixed(2)}s</text>
    </box>
  )
}
