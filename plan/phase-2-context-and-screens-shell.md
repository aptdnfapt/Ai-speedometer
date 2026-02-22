# Phase 2 — App Context + Screen Shell

Goal: full screen router wired up, all screens exist as stubs, navigation between them works, Header + Footer render on every screen.

---

## TODO

### Context

- [ ] Create `src/tui/context/AppContext.tsx`:
  - define `Screen` union type: `'main-menu' | 'model-menu' | 'model-select' | 'benchmark' | 'add-verified' | 'add-custom' | 'add-models' | 'list-providers'`
  - define `AppState`:
    ```ts
    {
      screen: Screen
      config: { providers: Provider[] } | null
      selectedModels: Model[]
      benchResults: ModelBenchState[]
      isLoadingConfig: boolean
    }
    ```
  - define `AppAction` union:
    - `{ type: 'NAVIGATE'; screen: Screen }`
    - `{ type: 'SET_CONFIG'; config: { providers: Provider[] } }`
    - `{ type: 'SET_SELECTED_MODELS'; models: Model[] }`
    - `{ type: 'BENCH_START'; models: Model[] }` — sets all to pending
    - `{ type: 'BENCH_MODEL_RUNNING'; modelId: string }`
    - `{ type: 'BENCH_MODEL_DONE'; modelId: string; result: BenchmarkResult }`
    - `{ type: 'BENCH_MODEL_ERROR'; modelId: string; error: string }`
    - `{ type: 'BENCH_RESET' }`
  - `appReducer(state, action)` — handles all actions
  - `AppContext` = `createContext<{ state: AppState; dispatch: Dispatch<AppAction> }>`
  - `AppProvider` component wraps children, loads config on mount via `useEffect`
  - `useAppContext()` hook — throws if used outside provider
  - `useNavigate()` convenience hook — returns `(screen: Screen) => void`

### Layout components

- [ ] Create `src/tui/components/Header.tsx`:
  - renders `<ascii-font text="AI-SPEEDOMETER" font="tiny" color="#00FFFF" />`
  - + version badge from `package.json` via `import pkg from '../../package.json'`
  - fixed height, full width

- [ ] Create `src/tui/components/Footer.tsx`:
  - accepts `hints: string[]` prop — e.g. `['[↑↓] nav', '[Enter] select', '[q] quit']`
  - renders them spaced in a single row
  - dim foreground color, separator `·` between hints
  - fixed 1-row height at bottom

### App shell

- [ ] Update `src/tui/App.tsx`:
  - wrap everything in `<AppProvider>`
  - render `<Header />` at top
  - render active screen based on `state.screen` in middle (flexGrow={1})
  - render `<Footer hints={...} />` at bottom
  - Footer hints derived from active screen via a `getHints(screen)` helper
  - full-height layout: `<box flexDirection="column" height="100%" width="100%">`
  - global `useKeyboard` for `Ctrl+C` → `renderer.destroy()`

### Screen stubs (all screens — just box + text label for now)

- [ ] `src/tui/screens/MainMenuScreen.tsx` — stub
- [ ] `src/tui/screens/ModelMenuScreen.tsx` — stub
- [ ] `src/tui/screens/ModelSelectScreen.tsx` — stub
- [ ] `src/tui/screens/BenchmarkScreen.tsx` — stub
- [ ] `src/tui/screens/AddVerifiedScreen.tsx` — stub
- [ ] `src/tui/screens/AddCustomScreen.tsx` — stub
- [ ] `src/tui/screens/AddModelsScreen.tsx` — stub
- [ ] `src/tui/screens/ListProvidersScreen.tsx` — stub

Each stub looks like:
```tsx
export function XScreen() {
  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text>XScreen — coming in Phase 3</text>
    </box>
  )
}
```

### Verification

- [ ] `bun src/index.ts` → shows Header + "main-menu stub" + Footer
- [ ] No TypeScript errors: `bun tsc --noEmit`

---

## Files created this phase

```
src/tui/
  App.tsx                         ← full shell, screen router
  context/
    AppContext.tsx                 ← state, reducer, hooks
  components/
    Header.tsx
    Footer.tsx
  screens/
    MainMenuScreen.tsx             ← stub
    ModelMenuScreen.tsx            ← stub
    ModelSelectScreen.tsx          ← stub
    BenchmarkScreen.tsx            ← stub
    AddVerifiedScreen.tsx          ← stub
    AddCustomScreen.tsx            ← stub
    AddModelsScreen.tsx            ← stub
    ListProvidersScreen.tsx        ← stub
```

---

## Notes

- `AppProvider` loads config on mount — calls `getAllAvailableProviders(false)` from `opencode-integration.js`
- Config loading shows `isLoadingConfig: true` → screens can show a loading state
- `getHints(screen)` lives in `App.tsx` — simple switch statement returning `string[]`
- All screen components get `state` + `dispatch` from `useAppContext()` — no prop drilling
