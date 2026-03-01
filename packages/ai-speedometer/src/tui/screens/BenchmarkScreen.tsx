import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { useAppKeyboard as useKeyboard } from '../hooks/useAppKeyboard.ts'
import { engine, Timeline } from '@opentui/core'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'
import { useTheme } from '../theme/ThemeContext.tsx'
import type { ModelBenchState, BenchmarkResult } from '@ai-speedometer/core/types'
import { BarChart } from '../components/BarChart.tsx'
import { ResultsTable } from '../components/ResultsTable.tsx'

const BAR_W = 25

function rankBadge(rank: number): string {
  if (rank === 1) return '1st'
  if (rank === 2) return '2nd'
  if (rank === 3) return '3rd'
  return `${rank}th`
}

export function BenchmarkScreen() {
  const { state, dispatch } = useAppContext()
  const navigate = useNavigate()
  const theme = useTheme()

  const [modelStates, setModelStates] = useState<ModelBenchState[]>([])
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [shimmerPos, setShimmerPos] = useState(0)
  const [allDone, setAllDone] = useState(false)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    const tl = new Timeline({ loop: true, duration: 1400 })
    const target = { pos: 0 }
    tl.add(target, { pos: 1, duration: 1400, ease: 'inOutSine', onUpdate: (anim) => {
      setShimmerPos((anim.targets[0] as { pos: number }).pos)
    } }, 0)
    tl.play()
    engine.register(tl)
    return () => { tl.pause(); engine.unregister(tl) }
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const models = state.benchResults.map(r => r.model)
    if (models.length === 0) return

    setModelStates(models.map(m => ({ model: m, status: 'pending' as const })))

    spinnerRef.current = setInterval(() => setSpinnerFrame(f => f + 1), 80)

    setModelStates(prev =>
      prev.map(s => ({ ...s, status: 'running' as const, startedAt: Date.now() }))
    )

    async function runAll() {
      const { benchmarkSingleModelRest } = await import('@ai-speedometer/core/benchmark')

      const logEnabled = state.logMode && !!state.runId
      const { createBenchLogger } = logEnabled ? await import('@ai-speedometer/core/logger') : { createBenchLogger: null }

      const promises = models.map(async (model) => {
        const logger = logEnabled && createBenchLogger ? await createBenchLogger(state.runId!) : undefined
        try {
          const result: BenchmarkResult = await benchmarkSingleModelRest(model, logger)
          if (!result.success) {
            const errMsg = result.error ?? 'Request failed'
            setModelStates(prev =>
              prev.map(s =>
                s.model.id === model.id && s.model.providerId === model.providerId
                  ? { ...s, status: 'error' as const, error: errMsg }
                  : s
              )
            )
            dispatch({ type: 'BENCH_MODEL_ERROR', modelId: model.id, error: errMsg })
          } else {
            setModelStates(prev =>
              prev.map(s =>
                s.model.id === model.id && s.model.providerId === model.providerId
                  ? { ...s, status: 'done' as const, result }
                  : s
              )
            )
            dispatch({ type: 'BENCH_MODEL_DONE', modelId: model.id, result })
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          setModelStates(prev =>
            prev.map(s =>
              s.model.id === model.id && s.model.providerId === model.providerId
                ? { ...s, status: 'error' as const, error: errMsg }
                : s
            )
          )
          dispatch({ type: 'BENCH_MODEL_ERROR', modelId: model.id, error: errMsg })
        }
      })

      await Promise.allSettled(promises)

      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
      setAllDone(true)

      try {
        const { addToRecentModels } = await import('@ai-speedometer/core/ai-config')
        await addToRecentModels(models.map(m => ({ modelId: m.id, modelName: m.name, providerName: m.providerName })))
      } catch { /* silent */ }
    }

    runAll()

    return () => {
      if (spinnerRef.current) { clearInterval(spinnerRef.current); spinnerRef.current = null }
    }
  }, [])

  const done = modelStates.filter(m => m.status === 'done')
  const running = modelStates.filter(m => m.status === 'running')
  const pending = modelStates.filter(m => m.status === 'pending')
  const errors = modelStates.filter(m => m.status === 'error')

  const maxTps  = Math.max(...done.map(m => m.result?.tokensPerSecond ?? 0), 1)
  const maxTtft = Math.max(...done.map(m => (m.result?.timeToFirstToken ?? 0) / 1000), 1)

  const tpsRanked = done.slice().sort((a, b) => (b.result?.tokensPerSecond ?? 0) - (a.result?.tokensPerSecond ?? 0))
  const ttftRanked = done.slice().sort((a, b) => (a.result?.timeToFirstToken ?? 0) - (b.result?.timeToFirstToken ?? 0))
  const maxTtftForBar = Math.max(...done.map(m => (m.result?.timeToFirstToken ?? 0) / 1000), 1)

  const doneResults: BenchmarkResult[] = tpsRanked.map(m => m.result!)
  const pendingCount = running.length + pending.length

  const allRows = useMemo(() => {
    const rows: ReactNode[] = []

    if (!allDone) {
      const total = modelStates.length || 1
      const filled = Math.round(((done.length + errors.length) / total) * BAR_W)

      const shimmerCenter = shimmerPos * (BAR_W - 1)
      const shimmerHalf = 1.5
      const barChars = Array.from({ length: BAR_W }, (_, i) => {
        const isFilled = i < filled
        const dist = Math.abs(i - shimmerCenter)
        const inWindow = dist <= shimmerHalf
        const intensity = inWindow ? 1 - dist / shimmerHalf : 0
        if (isFilled) {
          if (intensity > 0.6) return { ch: '█', fg: '#c8eeff' }
          if (intensity > 0)   return { ch: '▓', fg: '#a0d8f0' }
          return { ch: '█', fg: theme.accent }
        } else {
          if (intensity > 0.6) return { ch: '░', fg: theme.border }
          if (intensity > 0)   return { ch: '░', fg: theme.surface }
          return { ch: '░', fg: theme.background }
        }
      })

      rows.push(
        <box key="progress-bar" height={1} flexDirection="row" paddingLeft={2}>
          <text fg={theme.dim}>Benchmarking  </text>
          <text fg={theme.accent}>{done.length + errors.length}/{modelStates.length}  </text>
          {barChars.map((b, i) => (
            <text key={i} fg={b.fg}>{b.ch}</text>
          ))}
          <text fg={theme.warning}>  {running.length} running...</text>
        </box>
      )
      for (const s of modelStates.filter(s => s.status === 'done' || s.status === 'error')) {
        if (s.status === 'done') {
          rows.push(
            <box key={`prog-${s.model.id}-${s.model.providerId}`} height={1} flexDirection="row" paddingLeft={2}>
              <text fg={theme.success}>  ✓  </text>
              <text fg={theme.text}>{s.model.name}  </text>
              <text fg={theme.accent}>{(s.result?.tokensPerSecond ?? 0).toFixed(1)} tok/s  </text>
              <text fg={theme.secondary}>{((s.result?.timeToFirstToken ?? 0) / 1000).toFixed(2)}s TTFT</text>
            </box>
          )
        } else {
          rows.push(
            <box key={`prog-${s.model.id}-${s.model.providerId}`} height={1} flexDirection="row" paddingLeft={2}>
              <text fg={theme.error}>  ✗  </text>
              <text fg={theme.text}>{s.model.name}  </text>
              <text fg={theme.error}>{s.error ?? 'error'}</text>
            </box>
          )
        }
      }
      rows.push(<box key="prog-spacer" height={1} />)
    }

    if (tpsRanked.length > 0) {
      rows.push(<box key="div-tps" height={1} backgroundColor={theme.border} />)
      rows.push(
        <box key="hdr-tps" height={1} flexDirection="row" paddingLeft={1}>
          <text fg={theme.primary}> TOKENS/SEC RANKING  (higher is better) </text>
        </box>
      )
      for (const [i, s] of tpsRanked.entries()) {
        const rank = i + 1
        const rankFg = rank === 1 ? theme.accent : rank === 2 ? theme.secondary : theme.dim
        const tps = s.result?.tokensPerSecond ?? 0
        const timeSec = (s.result?.totalTime ?? 0) / 1000
        const badge = rankBadge(rank).padStart(3)
        const modelCol = s.model.name.padEnd(18).slice(0, 18)
        const provCol  = s.model.providerName.padEnd(12).slice(0, 12)
        rows.push(
          <box key={`tps-${s.model.id}-${s.model.providerId}`} height={1} flexDirection="row" paddingLeft={2}>
            <text fg={rankFg}>{badge}  </text>
            <text fg={theme.dim}> │ </text>
            <text fg={theme.accent}>{tps.toFixed(1).padStart(8)} tok/s  </text>
            <text fg={theme.dim}> │ </text>
            <text fg={theme.secondary}>{timeSec.toFixed(2).padStart(6)}s  </text>
            <text fg={theme.dim}> │ </text>
            <text fg={theme.text}>{modelCol}  </text>
            <text fg={theme.dim}>{provCol}  │  </text>
            <BarChart value={tps} max={maxTps} width={BAR_W} color={theme.accent} />
          </box>
        )
      }
    }

    if (ttftRanked.length > 0) {
      rows.push(<box key="div-ttft" height={1} backgroundColor={theme.border} />)
      rows.push(
        <box key="hdr-ttft" height={1} flexDirection="row" paddingLeft={1}>
          <text fg={theme.primary}> TIME TO FIRST TOKEN RANKING  (lower is better) </text>
        </box>
      )
      for (const [i, s] of ttftRanked.entries()) {
        const rank = i + 1
        const rankFg = rank === 1 ? theme.accent : rank === 2 ? theme.secondary : theme.dim
        const ttft = (s.result?.timeToFirstToken ?? 0) / 1000
        const tps  = s.result?.tokensPerSecond ?? 0
        const badge = rankBadge(rank).padStart(3)
        const modelCol = s.model.name.padEnd(18).slice(0, 18)
        const provCol  = s.model.providerName.padEnd(12).slice(0, 12)
        rows.push(
          <box key={`ttft-${s.model.id}-${s.model.providerId}`} height={1} flexDirection="row" paddingLeft={2}>
            <text fg={rankFg}>{badge}  </text>
            <text fg={theme.dim}> │ </text>
            <text fg={theme.secondary}>{ttft.toFixed(2).padStart(7)}s  </text>
            <text fg={theme.dim}> │ </text>
            <text fg={theme.accent}>{tps.toFixed(1).padStart(8)} tok/s  </text>
            <text fg={theme.dim}> │ </text>
            <text fg={theme.text}>{modelCol}  </text>
            <text fg={theme.dim}>{provCol}  │  </text>
            <BarChart value={ttft} max={maxTtftForBar} width={BAR_W} color={theme.secondary} />
          </box>
        )
      }
    }

    if (allDone && errors.length > 0) {
      rows.push(<box key="div-errors" height={1} backgroundColor={theme.border} />)
      rows.push(
        <box key="hdr-errors" height={1} flexDirection="row" paddingLeft={1}>
          <text fg={theme.error}> FAILED ({errors.length}) </text>
        </box>
      )
      for (const s of errors) {
        rows.push(
          <box key={`err-${s.model.id}-${s.model.providerId}`} flexDirection="column" paddingLeft={2} paddingTop={1} paddingBottom={1}>
            <box height={1} flexDirection="row">
              <text fg={theme.error}>✗  </text>
              <text fg={theme.text}>{s.model.name}  </text>
              <text fg={theme.dim}>({s.model.providerName})</text>
            </box>
            <box height={1} paddingLeft={3}>
              <text fg={theme.error}>{s.error ?? 'Unknown error'}</text>
            </box>
          </box>
        )
      }
    }

    rows.push(<box key="div-results" height={1} backgroundColor={theme.border} />)
    rows.push(
      <box key="hdr-results" height={1} flexDirection="row" paddingLeft={1}>
        <text fg={theme.primary}> RESULTS </text>
      </box>
    )
    if (doneResults.length > 0) {
      rows.push(<box key="results-table" flexDirection="column"><ResultsTable results={doneResults} pendingCount={pendingCount} /></box>)
    } else {
      rows.push(
        <box key="results-empty" paddingLeft={2} paddingBottom={1}>
          <text fg={theme.dim}>No results yet...</text>
        </box>
      )
    }

    return rows
  }, [modelStates, allDone, shimmerPos, tpsRanked, ttftRanked, doneResults, pendingCount, maxTps, maxTtftForBar, theme])

  useKeyboard((key) => {
    if (!allDone) return
    if (key.name === 'q' || key.name === 'return' || key.name === 'enter') {
      dispatch({ type: 'BENCH_RESET' })
      navigate('main-menu')
    }
  })

  const statusLine = allDone
    ? (
      <box flexDirection="row">
        <text fg={theme.success}>All done!  [Enter]/[Q] return  [↑↓/PgUp/PgDn/wheel] scroll</text>
        {state.logMode && state.logPath && (
          <text fg={theme.dim}>  log: {state.logPath}</text>
        )}
      </box>
    )
    : (
      <box flexDirection="row">
        {running.length > 0 && <text fg={theme.warning}>{running.length} running  </text>}
        {done.length > 0    && <text fg={theme.success}>{done.length} done  </text>}
        {errors.length > 0  && <text fg={theme.error}>{errors.length} errors  </text>}
        <text fg={theme.dim}>[↑↓/wheel] scroll</text>
      </box>
    )

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <box alignItems="center" justifyContent="center" marginBottom={1}>
        <ascii-font text="AI-SPEEDOMETER" font="tiny" color={theme.primary} />
      </box>
      <box
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor={theme.border}
        backgroundColor={theme.background}
        flexGrow={1}
      >
        <box height={1} paddingLeft={2} paddingRight={2} flexDirection="row">
          <text fg={theme.accent}>LIVE BENCHMARK  </text>
          {statusLine}
        </box>
        <box height={1} backgroundColor={theme.border} />

        <scrollbox
          focused
          flexGrow={1}
          stickyScroll
          stickyStart="bottom"
          style={{ scrollbarOptions: { showArrows: true, trackOptions: { foregroundColor: theme.primary, backgroundColor: theme.border } } }}
        >
          {allRows}
        </scrollbox>
      </box>
    </box>
  )
}
