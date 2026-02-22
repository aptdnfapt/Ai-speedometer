# AI-Speedometer TUI — Implementation Plan

Full rewrite of the interactive CLI from `cli.js` (Node.js + raw ANSI) to a proper OpenTUI React TUI running on Bun with TypeScript.

---

## Phase Overview

| Phase | Name | Goal |
|-------|------|------|
| [1](./phase-1-foundation.md) | Foundation & Project Setup | tsconfig, entry point, benchmark.ts, headless.ts, TUI stub |
| [2](./phase-2-context-and-screens-shell.md) | App Context + Screen Shell | AppContext, screen router, Header, Footer, all screen stubs |
| [3](./phase-3-menus-and-navigation.md) | Menus & Navigation | MainMenu, ModelMenu, ListProviders, MenuList component |
| [4](./phase-4-model-select.md) | Model Select Screen | Search, pagination, TAB multi-select, recent models |
| [5](./phase-5-benchmark-screen.md) | Benchmark Screen | Live spinner rows → snap to bars, live-populating table |
| [6](./phase-6-provider-management.md) | Provider Management | Add Verified, Add Custom, Add Models screens |
| [7](./phase-7-tests.md) | Tests | bun test suite — components + screens + benchmark logic |
| [8](./phase-8-build-and-polish.md) | Build & Polish | Production build, cleanup, docs update |

---

## Tokyo Night Theme (all phases)

All colors across every screen, component, and element must use the Tokyo Night palette:

| Token        | Hex       | Usage                                      |
|--------------|-----------|--------------------------------------------|
| bg           | `#1a1b26` | root shell background                      |
| bg-dark      | `#16161e` | header, footer, panels, card backgrounds   |
| bg-highlight | `#292e42` | active/selected row background             |
| blue         | `#7aa2f7` | logo, primary accent, headers              |
| cyan         | `#7dcfff` | Run Benchmark, search cursor, column heads |
| purple       | `#bb9af7` | Manage Models, step indicators (done)      |
| red          | `#f7768e` | Exit, errors, ✗ rows                       |
| green        | `#9ece6a` | ✓ done, success messages                   |
| orange       | `#ff9e64` | spinner (running state), warnings          |
| comment      | `#565f89` | dim text, version badge, footer hints      |
| fg           | `#c0caf5` | normal foreground text                     |
| border       | `#292e42` | all box borders                            |

Rules:
- NO hardcoded colors outside this palette
- `●/○` style indicators replaced with background-highlight rows + `›` arrow
- No raw ANSI green/yellow/magenta — use hex values above
- Cards use `borderStyle="rounded"` with `borderColor="#292e42"`

---

## Key decisions

- **Runtime:** Bun (not Node) — runs TypeScript natively, test runner built in
- **TUI framework:** `@opentui/react` (already installed)
- **Language:** TypeScript + TSX — strict mode, no `any`
- **Tests:** `bun test` + `@opentui/react/test-utils` — snapshot + interaction
- **Headless mode:** preserved 100% backward compatible in `src/headless.ts`
- **AI SDK removed:** `runStreamingBenchmark` and AI SDK benchmark path deleted entirely
- **Exit:** always `renderer.destroy()` — never `process.exit()` from TUI code

---

## Benchmark screen behaviour (approved)

All models start spinning simultaneously. Each snaps into final state as it completes. Rows re-rank live by TPS. Results table populates progressively. Both leaderboard + table visible simultaneously on one screen.

```
  ⠹ gpt-4o       running...
  ⠸ glm-4.5      running...
  ● 1  claude  ✓  TPS █████████░ 87.3  TIME ████░ 2.14s

  #  Model    Time   TTFT   Tok/s  Out   In   Total
  1  claude   2.14   0.31   87.3   432   89   521
```

---

## File structure (end state)

```
src/
  index.ts
  types.ts
  benchmark.ts
  constants.ts
  headless.ts
  tui/
    index.tsx
    App.tsx
    context/
      AppContext.tsx
    screens/
      MainMenuScreen.tsx
      ModelMenuScreen.tsx
      ModelSelectScreen.tsx
      BenchmarkScreen.tsx
      AddVerifiedScreen.tsx
      AddCustomScreen.tsx
      AddModelsScreen.tsx
      ListProvidersScreen.tsx
    components/
      Header.tsx
      Footer.tsx
      MenuList.tsx
      ModelRow.tsx
      BarChart.tsx
      ResultsTable.tsx
  tests/
    setup.ts
    benchmark.test.ts
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
```
