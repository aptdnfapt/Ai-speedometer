import type { BenchmarkResult } from '@ai-speedometer/core/types'
import { useTheme } from '../theme/ThemeContext.tsx'

interface ResultsTableProps {
  results: BenchmarkResult[]
  pendingCount: number
}

function lpad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : ' '.repeat(w - s.length) + s
}

function rpad(s: string, w: number): string {
  return s.length >= w ? s.slice(0, w) : s + ' '.repeat(w - s.length)
}

function trunc(s: string, w: number): string {
  return s.length > w ? s.slice(0, w - 1) + '…' : s
}

export function ResultsTable({ results, pendingCount }: ResultsTableProps) {
  const theme = useTheme()
  const sorted = [...results].sort((a, b) => b.tokensPerSecond - a.tokensPerSecond)

  const C = { rank: 4, model: 16, prov: 10, time: 8, ttft: 7, tps: 9, f1000: 8, out: 6, inp: 6, tot: 6 }
  const totalW = C.rank + C.model + C.prov + C.time + C.ttft + C.tps + C.f1000 + C.out + C.inp + C.tot + 10

  const sep = '─'.repeat(totalW)

  const maxTps = Math.max(...results.map(r => r.tokensPerSecond), 0)
  const minTtft = Math.min(...results.map(r => r.timeToFirstToken), Infinity)
  const validF1000s = results.map(r => r.f1000).filter(f => f !== Infinity)
  const minF1000 = validF1000s.length > 0 ? Math.min(...validF1000s) : Infinity

  function row(rank: string, model: string, prov: string, time: string, ttft: string, tps: string, f1000: string, out: string, inp: string, tot: string) {
    return (
      lpad(rank, C.rank) + ' │ ' +
      rpad(model, C.model) + ' │ ' +
      rpad(prov, C.prov) + ' │ ' +
      lpad(time, C.time) + ' │ ' +
      lpad(ttft, C.ttft) + ' │ ' +
      lpad(tps, C.tps) + ' │ ' +
      lpad(f1000, C.f1000) + ' │ ' +
      lpad(out, C.out) + ' │ ' +
      lpad(inp, C.inp) + ' │ ' +
      lpad(tot, C.tot)
    )
  }

  const header = row('#', 'Model', 'Provider', 'Time(s)', 'TTFT(s)', 'Tok/s', 'F1000(h)', 'Out', 'In', 'Total')

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1}>
      <box height={1}>
        <text fg={theme.accent}>{header}</text>
      </box>
      <box height={1}>
        <text fg={theme.border}>{sep}</text>
      </box>
      {sorted.map((r, i) => {
        const rank = `${i + 1}`
        const timeSec = (r.totalTime / 1000).toFixed(1)
        const ttftSec = (r.timeToFirstToken / 1000).toFixed(2)
        const tps = r.tokensPerSecond.toFixed(0)
        const f1000Val = r.f1000 === Infinity ? '∞' : r.f1000.toFixed(2)
        const outTok = r.tokenCount.toString() + (r.usedEstimateForOutput ? '*' : '')
        const inTok = r.promptTokens.toString() + (r.usedEstimateForInput ? '*' : '')
        const totTok = r.totalTokens.toString() + ((r.usedEstimateForOutput || r.usedEstimateForInput) ? '*' : '')
        const hasEst = r.usedEstimateForOutput || r.usedEstimateForInput

        const isBestTps = r.tokensPerSecond === maxTps && maxTps > 0
        const isBestTtft = r.timeToFirstToken === minTtft
        const isBestF1000 = r.f1000 === minF1000 && r.f1000 !== Infinity

        return (
          <box key={`${r.model}-${r.provider}-${i}`} height={1} flexDirection="row">
            <text fg={theme.dim}>{lpad(rank, C.rank)} │ </text>
            <text fg={theme.text}>{rpad(trunc(r.model, C.model), C.model)} │ </text>
            <text fg={theme.dim}>{rpad(trunc(r.provider, C.prov), C.prov)} │ </text>
            <text fg={theme.dim}>{lpad(timeSec, C.time)} │ </text>
            <text fg={isBestTtft ? theme.success : theme.dim}>{lpad(ttftSec, C.ttft)} │ </text>
            <text fg={isBestTps ? theme.success : theme.dim}>{lpad(tps, C.tps)} │ </text>
            <text fg={isBestF1000 ? theme.success : theme.dim}>{lpad(f1000Val, C.f1000)} │ </text>
            <text fg={theme.dim}>{lpad(outTok, C.out)} │ </text>
            <text fg={theme.dim}>{lpad(inTok, C.inp)} │ </text>
            <text fg={theme.dim}>{lpad(totTok, C.tot)}</text>
            {hasEst && <text fg={theme.warning}> [est]</text>}
          </box>
        )
      })}
      <box height={1}>
        <text fg={theme.border}>{sep}</text>
      </box>
      {pendingCount > 0 && (
        <box height={1}>
          <text fg={theme.dim}>  Waiting for {pendingCount} more result{pendingCount !== 1 ? 's' : ''}...</text>
        </box>
      )}
    </box>
  )
}
