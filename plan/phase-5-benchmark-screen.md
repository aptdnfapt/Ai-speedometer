# Phase 5 — Benchmark Screen (Live Leaderboard)

Goal: the live benchmark screen — all models spin simultaneously, each snaps into place with real data as it finishes, table populates + re-ranks live.

---

## TODO

### Shared components

- [ ] Create `src/tui/components/BarChart.tsx`:
  - props: `{ value: number; max: number; width: number; color: string }`
  - filled cells: `Math.round((value / max) * width)` using `█` in passed `color`
  - empty cells: `░` in `#292e42`
  - renders as single `<text>` line
  - if `max === 0` → all empty bars
  - exported type: `BarChartProps`
  - TPS bar color: `#7dcfff`, TIME bar color: `#bb9af7`

- [ ] Create `src/tui/components/ModelRow.tsx`:
  - props:
    ```ts
    {
      rank: number           // 1-based, only shown when done
      status: 'pending' | 'running' | 'done' | 'error'
      model: Model
      result?: BenchmarkResult
      spinnerFrame: number   // 0-9, cycles globally
      maxTps: number         // for bar scaling
      maxTime: number        // for bar scaling
    }
    ```
  - **pending row:** fg `#565f89`
    ```
    ·  model-name  (provider)  --
    ```
  - **running row:** spinner fg `#ff9e64`, model name fg `#c0caf5`, elapsed fg `#565f89`
    ```
    ⠹  model-name  (provider)  1.2s...
    ```
    spinner char: `SPINNER_FRAMES[spinnerFrame % 10]` where `SPINNER_FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']`
    elapsed time shown: `Date.now() - startedAt` formatted as `Xs...`
  - **done row:** rank 1 fg `#7dcfff`, rank 2 fg `#bb9af7`, rank 3+ fg `#565f89`; `✓` fg `#9ece6a`
    ```
    ●  1  model-name  (provider)  ✓
         TPS  █████████████████░░░░░░  87.3 tok/s    bar color #7dcfff
         TIME ████████████░░░░░░░░░░░  2.14s          bar color #bb9af7
    ```
    two `<BarChart>` lines below, indented
  - **error row:** fg `#f7768e`
    ```
    ✗  model-name  (provider)  ERROR: message
    ```

- [ ] Create `src/tui/components/ResultsTable.tsx`:
  - props: `{ results: BenchmarkResult[]; pendingCount: number }`
  - renders a header row + one row per result
  - columns: `#`, `Model`, `Provider`, `Time(s)`, `TTFT(s)`, `Tok/s`, `Out`, `In`, `Total`
  - each column fixed width (pad/truncate) using `.padEnd()` / `.padStart()`
  - header row: fg `#7dcfff`, `─` separator line fg `#292e42` below
  - data rows sorted by `tokensPerSecond` descending
  - pending rows: `--` in `#565f89`
  - if `pendingCount > 0`: dim footer `Waiting for {pendingCount} more...` in `#565f89`
  - `[est]` suffix in `#ff9e64` on estimated token counts
  - renders inside `<scrollbox>` if rows overflow

### BenchmarkScreen

- [ ] Implement `src/tui/screens/BenchmarkScreen.tsx`:

  **Local state:**
  ```ts
  const [modelStates, setModelStates] = useState<ModelBenchState[]>([])
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const [allDone, setAllDone] = useState(false)
  ```

  **On mount (`useEffect`):**
  1. initialize `modelStates` from `state.selectedModels` — all `status: 'pending'`
  2. start spinner `setInterval(80ms)` → increments `spinnerFrame`; store cleanup ref
  3. for each model: set status to `'running'`, capture `startedAt = Date.now()`
  4. fire `benchmarkSingleModelRest(model)` for all models simultaneously
  5. each `.then(result)`:
     - update that model's entry in `modelStates`: `status: 'done'`, attach `result`
     - dispatch `BENCH_MODEL_DONE` to global context too
  6. each `.catch(err)`:
     - update `status: 'error'`, attach `error` string
  7. `Promise.allSettled(...)` → when all resolve: `setAllDone(true)`, clear spinner interval
  8. also call `addToRecentModels()` for successful ones after all done

  **Derived values on every render:**
  ```ts
  const done = modelStates.filter(m => m.status === 'done')
  const running = modelStates.filter(m => m.status === 'running')
  const pending = modelStates.filter(m => m.status === 'pending')
  const errors = modelStates.filter(m => m.status === 'error')

  // Sort done by TPS desc, then running, then pending/errors
  const sorted = [...done].sort((a,b) => b.result!.tokensPerSecond - a.result!.tokensPerSecond)
    .concat(running)
    .concat(pending)
    .concat(errors)

  const maxTps = Math.max(...done.map(m => m.result!.tokensPerSecond), 1)
  const maxTime = Math.max(...done.map(m => m.result!.totalTime), 1)
  ```

  **Layout:**
  ```
  ┌─ LIVE BENCHMARK ─────────────────────────────────────┐
  │  3 running... / 1 done / 0 errors                    │
  ├──────────────────────────────────────────────────────┤
  │  <scrollbox> — ModelRow per model in sorted order    │
  │    ⠹  gpt-4o    (openai)     1.2s...                 │
  │    ⠸  glm-4.5   (zai)        0.8s...                 │
  │    ●  1  claude  (ant)  ✓                            │
  │       TPS  █████████████░░░░  87.3 tok/s              │
  │       TIME ████████░░░░░░░░░  2.14s                  │
  ├──────────────────────────────────────────────────────┤
  │  RESULTS TABLE (populates live)                      │
  │  #   Model    Provider  Time  TTFT  Tok/s Out In Tot │
  │  1   claude   ant       2.14  0.31  87.3  432 89 521 │
  └──────────────────────────────────────────────────────┘
  ```

  **Keyboard:**
  - `q` while running → ignored (or show "benchmark in progress" message)
  - `q` / `Enter` when `allDone` → navigate to `'main-menu'` + dispatch `BENCH_RESET`

  **Status line above leaderboard:**
  - `{running.length} running` fg `#ff9e64` · `{done.length} done` fg `#9ece6a` · `{errors.length} errors` fg `#f7768e`
  - when all done: `All done! [Enter] to return` fg `#9ece6a`

- [ ] Footer hints:
  - while running: `['Benchmark in progress...']`
  - when done: `['[Enter] back to menu', '[q] back to menu']`

### Verification

- [ ] Navigate to Run Benchmark → select 2+ models → Enter → BenchmarkScreen appears
- [ ] All model rows show spinner immediately (⠹ cycling every 80ms)
- [ ] When a model finishes: row snaps to ● + rank + TPS bar + TIME bar
- [ ] Rows re-sort as each completes (fastest TPS rises to top)
- [ ] ResultsTable populates row by row as models finish
- [ ] `[est]` shown correctly on estimated token rows
- [ ] After all done: spinner stops, "All done!" message, `q` or Enter returns to menu
- [ ] `bun tsc --noEmit` → zero errors

---

## Files created/modified this phase

```
src/tui/
  App.tsx                         ← update getHints() for benchmark
  components/
    BarChart.tsx                  ← new
    ModelRow.tsx                  ← new
    ResultsTable.tsx              ← new
  screens/
    BenchmarkScreen.tsx           ← full impl
```

---

## Notes

- `spinnerFrame` is a single integer in BenchmarkScreen state — all `ModelRow` components get same `spinnerFrame` prop → they all tick in sync (same frame = same character = synchronized animation)
- `setModelStates` updates must use functional form: `setModelStates(prev => prev.map(...))` to avoid stale closure bugs
- `useEffect` cleanup MUST clear the spinner interval — critical for correct behavior on unmount
- `ResultsTable` is inside a `<scrollbox>` — use `focused` prop only when leaderboard list is not focused; since there's no separate focus here both scroll together via parent
- `addToRecentModels()` called once after `Promise.allSettled` resolves — not per model
- Elapsed time format: `< 1s` → `0.Xs...`, else `Xs...` (1 decimal)
