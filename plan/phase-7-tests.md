# Phase 7 — Tests

Goal: comprehensive test suite using `bun test` + `@opentui/react/test-utils`. Snapshot tests + interaction tests for all components and key screens.

---

## TODO

### Test infrastructure

- [ ] Verify `@opentui/react/test-utils` subpath export works: `import { testRender } from '@opentui/react/test-utils'`
- [ ] Confirm `bun test` picks up `*.test.tsx` files automatically
- [ ] Create `src/tests/setup.ts` if needed — shared test utilities:
  - `mockBenchmarkResult(overrides?)` factory
  - `mockModel(overrides?)` factory
  - `mockProvider(overrides?)` factory
  - `mockModelBenchState(status, overrides?)` factory

---

### Component tests

- [ ] `src/tests/components/Header.test.tsx`:
  - `renders AI-SPEEDOMETER text` → `expect(frame).toContain('AI-SPEEDOMETER')`
  - snapshot: `Header matches snapshot`

- [ ] `src/tests/components/Footer.test.tsx`:
  - `renders all hint strings` → each hint string appears in frame
  - `renders separator between hints`
  - snapshot: `Footer with 3 hints matches snapshot`

- [ ] `src/tests/components/MenuList.test.tsx`:
  - `renders all items` → each label appears in frame
  - `highlights selected item with bg-highlight row and › arrow`
  - `non-selected items render in comment color #565f89`
  - `snapshot: MenuList 3 items selected=0`
  - `snapshot: MenuList 3 items selected=2`

- [ ] `src/tests/components/BarChart.test.tsx`:
  - `renders full bar when value equals max` → all `█` chars, no `░`
  - `renders empty bar when value is 0` → all `░` chars
  - `renders half bar at 50%` → correct ratio of `█` to `░`
  - `handles max=0 gracefully` → all `░`, no crash
  - snapshot: `BarChart 50% width=20`

- [ ] `src/tests/components/ModelRow.test.tsx`:
  - `shows spinner char when status=running` → one of `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` present, fg #ff9e64
  - `shows · when status=pending` → `·` present in #565f89, no spinner
  - `shows ● and ✓ when status=done` → both chars present, ✓ in #9ece6a
  - `shows rank number when done` → `1` visible in frame for rank=1
  - `shows ✗ when status=error` → error row renders
  - `shows TPS bar when done` → `█` chars present in frame
  - `shows TIME bar when done` → second bar row renders
  - snapshot: `ModelRow pending`
  - snapshot: `ModelRow running frame=3`
  - snapshot: `ModelRow done rank=1`
  - snapshot: `ModelRow error`

- [ ] `src/tests/components/ResultsTable.test.tsx`:
  - `renders header row with column names`
  - `renders done result with numeric data`
  - `renders -- for missing data columns` (pending model)
  - `shows [est] when usedEstimateForOutput=true`
  - `shows pending count message when pendingCount > 0`
  - `sorts results by tokensPerSecond descending`
  - snapshot: `ResultsTable 1 done 2 pending`

---

### Screen tests

- [ ] `src/tests/screens/MainMenuScreen.test.tsx`:
  - `renders 3 menu items` → ⚡ Run Benchmark, ⚙ Manage Models, ✕ Exit all present
  - `first item has bg-highlight row (bg=#292e42)`
  - `first item shows › arrow`
  - snapshot: `MainMenuScreen initial state`

- [ ] `src/tests/screens/ModelSelectScreen.test.tsx`:
  - `renders search input`
  - `renders model list when providers loaded`
  - `shows empty state when no providers`
  - `shows loading state`
  - snapshot: `ModelSelectScreen with 3 models`

- [ ] `src/tests/screens/BenchmarkScreen.test.tsx`:
  - `all models show spinner on initial render` → spinner chars present for each model
  - `done model shows ● and bars` — mock `benchmarkSingleModelRest` to resolve immediately with fixture data
  - `error model shows ✗` — mock to reject
  - `ResultsTable renders after model completes`
  - `shows allDone message when all models finish`

  For mocking: use `jest.mock` equivalent — Bun supports `mock()` from `bun:test`:
  ```ts
  import { mock } from 'bun:test'
  mock.module('../../benchmark', () => ({
    benchmarkSingleModelRest: () => Promise.resolve(mockBenchmarkResult())
  }))
  ```

- [ ] `src/tests/screens/AddVerifiedScreen.test.tsx`:
  - `renders search input on browse step`
  - `shows confirm step after provider selected`
  - `shows API key input on confirm step`

- [ ] `src/tests/screens/AddCustomScreen.test.tsx`:
  - `renders type selection on first step`
  - `shows progress indicator`
  - `advances through steps`

---

### Benchmark logic tests (non-TUI)

- [ ] `src/tests/benchmark.test.ts`:
  - `returns success result with correct shape` — mock `fetch` globally
  - `returns error result on network failure` — mock `fetch` to throw
  - `handles openai-compatible provider type`
  - `handles anthropic provider type` — checks `x-api-key` header, `/messages` endpoint
  - `handles google provider type` — checks `x-goog-api-key` header
  - `calculates tokensPerSecond correctly`
  - `calculates timeToFirstToken correctly`
  - `sets usedEstimateForOutput=true when no usage metadata`

  Mock pattern:
  ```ts
  import { mock } from 'bun:test'
  const mockFetch = mock(() => Promise.resolve({
    ok: true,
    body: { getReader: () => ... }
  }))
  global.fetch = mockFetch
  ```

---

### Running tests

```bash
# All tests
bun test

# Single file
bun test src/tests/components/ModelRow.test.tsx

# Watch mode
bun test --watch

# Update snapshots
bun test --update-snapshots

# Verbose
bun test --verbose
```

---

## Files created this phase

```
src/tests/
  setup.ts
  components/
    Header.test.tsx
    Footer.test.tsx
    MenuList.test.tsx
    BarChart.test.tsx
    ModelRow.test.tsx
    ResultsTable.test.tsx
  screens/
    MainMenuScreen.test.tsx
    ModelSelectScreen.test.tsx
    BenchmarkScreen.test.tsx
    AddVerifiedScreen.test.tsx
    AddCustomScreen.test.tsx
  benchmark.test.ts
```

---

## Notes

- Always call `testSetup.renderer.destroy()` in `afterEach` — resource leak otherwise
- `testRender` dimensions: use `{ width: 120, height: 40 }` for screens, `{ width: 40, height: 10 }` for small components
- Snapshot tests are brittle if dimensions change — use fixed dimensions per test
- `BenchmarkScreen.test.tsx` is the hardest — mocking the benchmark module is critical
- `bun:test` `mock.module()` works for static imports — use it to mock `../../benchmark`
- After mocking async resolves in BenchmarkScreen tests, call `await testSetup.renderOnce()` multiple times if needed for state to settle
- Do NOT snapshot the spinner frame mid-animation — test with `spinnerFrame=0` prop or mock `Date.now()`
