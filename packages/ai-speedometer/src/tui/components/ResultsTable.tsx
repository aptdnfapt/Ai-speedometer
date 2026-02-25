import type { BenchmarkResult } from '@ai-speedometer/core/types'

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
  const sorted = [...results].sort((a, b) => b.tokensPerSecond - a.tokensPerSecond)

  // column widths matching old CLI
  const C = { rank: 4, model: 18, prov: 12, time: 10, ttft: 8, tps: 11, out: 8, inp: 8, tot: 8 }
  const totalW = C.rank + C.model + C.prov + C.time + C.ttft + C.tps + C.out + C.inp + C.tot + 9

  const sep = '─'.repeat(totalW)

  function row(rank: string, model: string, prov: string, time: string, ttft: string, tps: string, out: string, inp: string, tot: string) {
    return (
      lpad(rank, C.rank) + ' │ ' +
      rpad(model, C.model) + ' │ ' +
      rpad(prov, C.prov) + ' │ ' +
      lpad(time, C.time) + ' │ ' +
      lpad(ttft, C.ttft) + ' │ ' +
      lpad(tps, C.tps) + ' │ ' +
      lpad(out, C.out) + ' │ ' +
      lpad(inp, C.inp) + ' │ ' +
      lpad(tot, C.tot)
    )
  }

  const header = row('#', 'Model', 'Provider', 'Time(s)', 'TTFT(s)', 'Tokens/Sec', 'Out', 'In', 'Total')

  return (
    <box flexDirection="column" paddingLeft={1} paddingRight={1}>
      <box height={1}>
        <text fg="#7dcfff">{header}</text>
      </box>
      <box height={1}>
        <text fg="#292e42">{sep}</text>
      </box>
      {sorted.map((r, i) => {
        const rank = `${i + 1}`
        const timeSec = (r.totalTime / 1000).toFixed(2)
        const ttftSec = (r.timeToFirstToken / 1000).toFixed(2)
        const tps = r.tokensPerSecond.toFixed(1)
        const outTok = r.tokenCount.toString() + (r.usedEstimateForOutput ? '[e]' : '')
        const inTok = r.promptTokens.toString() + (r.usedEstimateForInput ? '[e]' : '')
        const totTok = r.totalTokens.toString() + ((r.usedEstimateForOutput || r.usedEstimateForInput) ? '[e]' : '')
        const hasEst = r.usedEstimateForOutput || r.usedEstimateForInput

        const line = row(
          rank,
          trunc(r.model, C.model),
          trunc(r.provider, C.prov),
          timeSec,
          ttftSec,
          tps,
          outTok,
          inTok,
          totTok,
        )

        return (
          <box key={`${r.model}-${r.provider}-${i}`} height={1} flexDirection="row">
            <text fg="#c0caf5">{line}</text>
            {hasEst && <text fg="#ff9e64"> [est]</text>}
          </box>
        )
      })}
      <box height={1}>
        <text fg="#292e42">{sep}</text>
      </box>
      {pendingCount > 0 && (
        <box height={1}>
          <text fg="#565f89">  Waiting for {pendingCount} more result{pendingCount !== 1 ? 's' : ''}...</text>
        </box>
      )}
    </box>
  )
}
