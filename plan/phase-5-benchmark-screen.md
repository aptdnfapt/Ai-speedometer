# Phase 5 — Benchmark Screen (Live Leaderboard)

Goal: the live benchmark screen — all models spin simultaneously, each snaps into place with real data as it finishes, table populates + re-ranks live.

---

## TODO

### Shared components

- [ ] Create `src/tui/components/BarChart.tsx`:
  - props: `{ value: number; max: number; width: number; color: string }`
  - filled cells: `Math.round((value / max) * width)` using `█`
  - empty cells: `░`
  - renders as single `<text>` line
  - if `max === 0` → all empty bars
  - exported type: `BarChartProps`

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
  - **pending row:**
    ```
    ○  model-name  (provider)  --
    ```
  - **running row:**
    ```
    ⠹  model-name  (provider)  1.2s...
    ```
    spinner char: `SPINNER_FRAMES[spinnerFrame % 10]` where `SPINNER_FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏']`
    elapsed time shown: `Date.now() - startedAt` formatted as `Xs...`
    spinner char color: yellow
  - **done row:**
    ```
    ●  1  model-name  (provider)  ✓
         TPS  █████████████████░░░░░░  87.3 tok/s
         TIME ████████████░░░░░░░░░░░  2.14s
    ```
    rank number in yellow/white/dim depending on 1st/2nd/3rd+
    `✓` in green
    two `<BarChart>` lines below, indented
  - **error row:**
    ```
    ✗  model-name  (provider)  ERROR: message
    ```
    red color

- [ ] Create `src/tui/components/ResultsTable.tsx`:
  - props: `{ results: BenchmarkResult[]; pendingCount: number }`
  - renders a header row + one row per result
  - columns: `#`, `Model`, `Provider`, `Time(s)`, `TTFT(s)`, `Tok/s`, `Out`, `In`, `Total`
  - each column fixed width (pad/truncate) using `.padEnd()` / `.padStart()`
  - header row: cyan foreground, `─` separator line below
  - data rows sorted by `tokensPerSecond` descending (same sort as leaderboard)
  - pending rows: show `--` for all numeric columns
  - if `pendingCount > 0`: show dim footer row `Waiting for {pendingCount} more...`
  - `[est]` suffix on token counts where `usedEstimateForOutput` or `usedEstimateForInput` is true
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
  - `{running.length} running · {done.length} done · {errors.length} errors`
  - when all done: `All done! [Enter] to return` in green

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
