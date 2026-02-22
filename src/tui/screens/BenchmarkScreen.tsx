import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { useKeyboard } from '@opentui/react'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'
import type { ModelBenchState, BenchmarkResult } from '../../types.ts'
import { BarChart } from '../components/BarChart.tsx'
import { ResultsTable } from '../components/ResultsTable.tsx'

const BAR_W = 25

function rankBadge(rank: number): string {
  if (rank === 1) return '1st'
  if (rank === 2) return '2nd'
  if (rank === 3) return '3rd'
  return `${rank}th`
}

function Divider() {
  return <box height={1} backgroundColor="#292e42" />
}

export function BenchmarkScreen() {
  const { state, dispatch } = useAppContext()
  const navigate = useNavigate()

  const [modelStates, setModelStates] = useState<ModelBenchState[]>([])
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [allDone, setAllDone] = useState(false)
  const spinnerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(false)

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
      const { benchmarkSingleModelRest } = await import('../../benchmark.ts')

      const promises = models.map(async (model) => {
        try {
          const result: BenchmarkResult = await benchmarkSingleModelRest(model)
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
        const { addToRecentModels } = await import('../../ai-config.ts')
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

  // build all scrollable rows as a flat list
  const allRows = useMemo(() => {
    const rows: ReactNode[] = []

    // progress section (while running)
    if (!allDone) {
      const total = modelStates.length || 1
      const filled = Math.round(((done.length + errors.length) / total) * BAR_W)
      const empty  = BAR_W - filled
      rows.push(
        <box key="progress-bar" height={1} flexDirection="row" paddingLeft={2}>
          <text fg="#565f89">Benchmarking  </text>
          <text fg="#7dcfff">{done.length + errors.length}/{modelStates.length}  </text>
          <text fg="#7dcfff">{'█'.repeat(filled)}</text>
          <text fg="#292e42">{'░'.repeat(empty)}</text>
          <text fg="#ff9e64">  {running.length} running...</text>
        </box>
      )
      for (const s of modelStates.filter(s => s.status === 'done' || s.status === 'error')) {
        if (s.status === 'done') {
          rows.push(
            <box key={`prog-${s.model.id}-${s.model.providerId}`} height={1} flexDirection="row" paddingLeft={2}>
              <text fg="#9ece6a">  ✓  </text>
              <text fg="#c0caf5">{s.model.name}  </text>
              <text fg="#7dcfff">{(s.result?.tokensPerSecond ?? 0).toFixed(1)} tok/s  </text>
              <text fg="#bb9af7">{((s.result?.timeToFirstToken ?? 0) / 1000).toFixed(2)}s TTFT</text>
            </box>
          )
        } else {
          rows.push(
            <box key={`prog-${s.model.id}-${s.model.providerId}`} height={1} flexDirection="row" paddingLeft={2}>
              <text fg="#f7768e">  ✗  </text>
              <text fg="#c0caf5">{s.model.name}  </text>
              <text fg="#f7768e">{s.error ?? 'error'}</text>
            </box>
          )
        }
      }
      rows.push(<box key="prog-spacer" height={1} />)
    }

    // TPS ranking
    if (tpsRanked.length > 0) {
      rows.push(<box key="div-tps" height={1} backgroundColor="#292e42" />)
      rows.push(
        <box key="hdr-tps" height={1} flexDirection="row" paddingLeft={1}>
          <text fg="#7aa2f7"> TOKENS/SEC RANKING  (higher is better) </text>
        </box>
      )
      for (const [i, s] of tpsRanked.entries()) {
        const rank = i + 1
        const rankFg = rank === 1 ? '#7dcfff' : rank === 2 ? '#bb9af7' : '#565f89'
        const tps = s.result?.tokensPerSecond ?? 0
        const timeSec = (s.result?.totalTime ?? 0) / 1000
        const badge = rankBadge(rank).padStart(3)
        const modelCol = s.model.name.padEnd(18).slice(0, 18)
        const provCol  = s.model.providerName.padEnd(12).slice(0, 12)
        rows.push(
          <box key={`tps-${s.model.id}-${s.model.providerId}`} height={1} flexDirection="row" paddingLeft={2}>
            <text fg={rankFg}>{badge}  </text>
            <text fg="#565f89"> │ </text>
            <text fg="#7dcfff">{tps.toFixed(1).padStart(8)} tok/s  </text>
            <text fg="#565f89"> │ </text>
            <text fg="#bb9af7">{timeSec.toFixed(2).padStart(6)}s  </text>
            <text fg="#565f89"> │ </text>
            <text fg="#c0caf5">{modelCol}  </text>
            <text fg="#565f89">{provCol}  │  </text>
            <BarChart value={tps} max={maxTps} width={BAR_W} color="#7dcfff" />
          </box>
        )
      }
    }

    // TTFT ranking
    if (ttftRanked.length > 0) {
      rows.push(<box key="div-ttft" height={1} backgroundColor="#292e42" />)
      rows.push(
        <box key="hdr-ttft" height={1} flexDirection="row" paddingLeft={1}>
          <text fg="#7aa2f7"> TIME TO FIRST TOKEN RANKING  (lower is better) </text>
        </box>
      )
      for (const [i, s] of ttftRanked.entries()) {
        const rank = i + 1
        const rankFg = rank === 1 ? '#7dcfff' : rank === 2 ? '#bb9af7' : '#565f89'
        const ttft = (s.result?.timeToFirstToken ?? 0) / 1000
        const tps  = s.result?.tokensPerSecond ?? 0
        const badge = rankBadge(rank).padStart(3)
        const modelCol = s.model.name.padEnd(18).slice(0, 18)
        const provCol  = s.model.providerName.padEnd(12).slice(0, 12)
        rows.push(
          <box key={`ttft-${s.model.id}-${s.model.providerId}`} height={1} flexDirection="row" paddingLeft={2}>
            <text fg={rankFg}>{badge}  </text>
            <text fg="#565f89"> │ </text>
            <text fg="#bb9af7">{ttft.toFixed(2).padStart(7)}s  </text>
            <text fg="#565f89"> │ </text>
            <text fg="#7dcfff">{tps.toFixed(1).padStart(8)} tok/s  </text>
            <text fg="#565f89"> │ </text>
            <text fg="#c0caf5">{modelCol}  </text>
            <text fg="#565f89">{provCol}  │  </text>
            <BarChart value={ttft} max={maxTtftForBar} width={BAR_W} color="#bb9af7" />
          </box>
        )
      }
    }

    // results table rows (inline, so they scroll too)
    rows.push(<box key="div-results" height={1} backgroundColor="#292e42" />)
    rows.push(
      <box key="hdr-results" height={1} flexDirection="row" paddingLeft={1}>
        <text fg="#7aa2f7"> RESULTS </text>
      </box>
    )
    if (doneResults.length > 0) {
      rows.push(<box key="results-table" flexDirection="column"><ResultsTable results={doneResults} pendingCount={pendingCount} /></box>)
    } else {
      rows.push(
        <box key="results-empty" paddingLeft={2} paddingBottom={1}>
          <text fg="#565f89">No results yet...</text>
        </box>
      )
    }

    return rows
  }, [modelStates, allDone, tpsRanked, ttftRanked, doneResults, pendingCount, maxTps, maxTtftForBar])

  useKeyboard((key) => {
    if (!allDone) return
    if (key.name === 'q' || key.name === 'return' || key.name === 'enter') {
      dispatch({ type: 'BENCH_RESET' })
      navigate('main-menu')
    }
  })

  const statusLine = allDone
    ? <text fg="#9ece6a">All done!  [Enter]/[q] return  [↑↓/PgUp/PgDn/wheel] scroll</text>
    : (
      <box flexDirection="row">
        {running.length > 0 && <text fg="#ff9e64">{running.length} running  </text>}
        {done.length > 0    && <text fg="#9ece6a">{done.length} done  </text>}
        {errors.length > 0  && <text fg="#f7768e">{errors.length} errors  </text>}
        <text fg="#565f89">[↑↓/wheel] scroll</text>
      </box>
    )

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <box alignItems="center" justifyContent="center" marginBottom={1}>
        <ascii-font text="AI-SPEEDOMETER" font="tiny" color="#7aa2f7" />
      </box>
      <box
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor="#292e42"
        backgroundColor="#16161e"
        flexGrow={1}
      >
        <box height={1} paddingLeft={2} paddingRight={2} flexDirection="row">
          <text fg="#7dcfff">LIVE BENCHMARK  </text>
          {statusLine}
        </box>
        <Divider />

        <scrollbox
          focused
          flexGrow={1}
          stickyScroll
          stickyStart="bottom"
          style={{ scrollbarOptions: { showArrows: true, trackOptions: { foregroundColor: '#7aa2f7', backgroundColor: '#292e42' } } }}
        >
          {allRows}
        </scrollbox>
      </box>
    </box>
  )
}
