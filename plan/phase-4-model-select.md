# Phase 4 — Model Select Screen

Goal: the model selection screen fully working — search, pagination, TAB multi-select, recent models, confirm to start benchmark.

---

## TODO

### ModelSelectScreen

- [ ] Implement `src/tui/screens/ModelSelectScreen.tsx` fully:

  **Layout (column) — Tokyo Night styled:**
  ```
  ╭─ Select Models ────────────────────────────────╮   borderColor=#292e42, bg=#16161e
  │ Search: query_                                  │   fg=#7dcfff for "Search:" label
  ├─────────────────────────────────────────────────┤
  │  ── recent ──                                   │   separator fg=#565f89
  │  gpt-4o      openai       bg=#292e42 fg=#7dcfff │   active+selected row
  │  claude      anthropic    fg=#9ece6a             │   selected (not active)
  │  ── ────── ──                                   │
  │  glm-4.5     zai          fg=#565f89             │   unselected dim
  │ ...                                             │
  ├─────────────────────────────────────────────────┤
  │ Selected: 2 models    Page 1/3                  │   fg=#bb9af7 / fg=#7dcfff
  ╰─────────────────────────────────────────────────╯
  ```

  **State:**
  ```ts
  const [searchQuery, setSearchQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set()) // model unique keys
  const [allModels, setAllModels] = useState<ModelItem[]>([])
  const [recentIds, setRecentIds] = useState<string[]>([])
  ```

  **Model unique key:** `${model.providerId}::${model.id}` — used for selected Set

  **Data loading:**
  - `useEffect` on mount → load `state.config.providers`, flatten all models into `allModels[]`
  - also load `getRecentModels()` from `ai-config.js` → store as `recentIds`

  **Filtering logic (same as original cli.js):**
  - empty search → recent models at top, then rest
  - with search → fuzzy match on `name + providerName + providerId` across all models
  - debounce 50ms on search input change

  **Pagination:**
  - `PAGE_SIZE = Math.max(3, terminalHeight - 14)` using `useTerminalDimensions()`
  - Page Up / Page Down keys to switch pages
  - cursor stays within page bounds, wraps circularly within page

  **Keyboard handling (`useKeyboard`):**
  - `↑` / `↓` → move cursor (circular within page)
  - `PageUp` / `PageDown` → change page
  - `Tab` → toggle selection on current model
  - `Enter` → if nothing selected: select current model; dispatch `BENCH_START` + navigate to `'benchmark'`
  - `Enter` → if some selected: dispatch `BENCH_START` with selected; navigate to `'benchmark'`
  - `A` (no search active) → select all visible models
  - `N` (no search active) → deselect all
  - `R` (no search active, has recents) → select all recent models → dispatch `BENCH_START` + navigate
  - `Backspace` → remove last char from search
  - printable char → append to search query
  - `Esc` / `q` → navigate to `'model-menu'` (or `'main-menu'` if came from there)

  **Rendering a model row (Tokyo Night):**
  - current + selected → `bg=#292e42` + `fg=#7dcfff` + `›` arrow right
  - current + not selected → `bg=#292e42` + `fg=#c0caf5` + `›` arrow right
  - not current + selected → transparent bg + `fg=#9ece6a`
  - not current + not selected → transparent bg + `fg=#565f89`
  - NO `●/○` circles — use background highlight + arrow to indicate active row

  **Recent section separators:**
  - show `── recent ──` before first recent model, fg `#565f89`
  - show `────────────` after last recent model (before non-recents), fg `#292e42`
  - only when search is empty and recents exist

  **Status bar (below list):**
  - `Selected: N models` in `#bb9af7`
  - `Page X/Y` in `#7dcfff` (only if > 1 page)
  - `↓ more below` dim hint `#565f89` if not last page

  **Search input:**
  - rendered as: `Search: ` label + `<text fg="bright">{searchQuery}_</text>` (cursor blink via `_`)
  - NOT using `<input>` component — manual char-by-char via keyboard handler to match existing UX

- [ ] Footer hints for this screen:
  `['[↑↓] navigate', '[Tab] select', '[Enter] run', '[A] all', '[N] none', '[R] recent', '[q] back']`

### Verification

- [ ] `bun src/index.ts` → Run Benchmark → model list appears
- [ ] Typing filters models in real-time
- [ ] TAB selects/deselects model, circle changes color
- [ ] Enter with one model selected → transitions to BenchmarkScreen stub
- [ ] A selects all, N deselects all
- [ ] Backspace removes search chars
- [ ] Page Up/Down changes pages
- [ ] `q` → back to main menu
- [ ] `bun tsc --noEmit` → zero errors

---

## Files modified this phase

```
src/tui/
  App.tsx                         ← update getHints() for model-select
  screens/
    ModelSelectScreen.tsx         ← full impl
```

---

## Notes

- Do NOT use `<input>` component for search — manual keyboard handling gives full control matching original behavior
- `selected` is a `Set<string>` with composite keys — avoids confusion when same model ID exists across providers
- When dispatching `BENCH_START`: convert selected Set back to `Model[]` array by filtering `allModels`
- `useTerminalDimensions()` for responsive page size — recalculate on resize
- `cleanupRecentModelsFromConfig()` should be called on mount (same as original cli.js)
