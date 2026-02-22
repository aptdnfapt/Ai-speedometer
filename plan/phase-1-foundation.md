# Phase 1 — Foundation & Project Setup

Goal: replace cli.js with a Bun+TypeScript project. No TUI yet — just wiring, config, and shared core logic compiling cleanly.

---

## TODO

- [ ] Delete `cli.js` from project root
- [ ] Install missing packages: `react` (if not present), check `@opentui/react` + `@opentui/core` are present
- [ ] Add `tsconfig.json` at project root with:
  - `"module": "ESNext"`
  - `"target": "ESNext"`
  - `"moduleResolution": "bundler"`
  - `"jsx": "react-jsx"`
  - `"jsxImportSource": "@opentui/react"`
  - `"strict": true`
  - `"paths"` aliases if needed
- [ ] Add `bunfig.toml` for test runner config (smol, just points to test glob)
- [ ] Update `package.json` scripts:
  - `"start": "bun src/index.ts"`
  - `"dev": "bun --watch src/index.ts"`
  - `"test": "bun test"`
  - `"build": "bun build src/index.ts --outfile dist/ai-speedometer --target bun"`
  - remove old `cli`, `cli:debug`, `build:dev` scripts
- [ ] Create `src/index.ts` — entry point:
  - parses `process.argv` for `--bench`, `--bench-custom`, `--help`, `--debug`
  - `--help` → prints help text, exits cleanly
  - `--bench` or `--bench-custom` → imports and runs `src/headless.ts`
  - else → imports and runs `src/tui/index.tsx`
- [ ] Create `src/types.ts` — all shared TypeScript types:
  - `Provider`, `Model`, `BenchmarkResult`, `ModelBenchState`, `CliArgs`
  - export all, used by every other module
- [ ] Create `src/benchmark.ts` — the core benchmark function:
  - port `benchmarkSingleModelRest()` from `cli.js` verbatim but typed
  - accepts `Model` type, returns `Promise<BenchmarkResult>`
  - no UI output — pure data function
  - handles openai-compatible, anthropic, google provider types
- [ ] Create `src/headless.ts` — port headless CLI mode:
  - port `runHeadlessBenchmark()` from `cli.js`
  - port `createCustomProviderFromCli()` + `parseProviderModel()`
  - uses `src/benchmark.ts` for actual benchmarking
  - outputs JSON to stdout same as before (backward compatible)
  - exits via `process.exit()` (headless mode — no TUI, no renderer)
- [ ] Create `src/tui/index.tsx` — stub only for now:
  - `createCliRenderer()` + `createRoot(<App />)`
  - `<App />` just renders `<text>AI-SPEEDOMETER booting...</text>`
  - proves the OpenTUI pipeline works end to end
- [ ] Verify `bun src/index.ts --help` prints help and exits
- [ ] Verify `bun src/index.ts` launches OpenTUI stub without crash
- [ ] Verify `bun src/index.ts --bench provider:model` still runs headless (will need real config)

---

## Files created this phase

```
tsconfig.json
bunfig.toml
src/
  index.ts
  types.ts
  benchmark.ts
  headless.ts
  tui/
    index.tsx          ← stub
    App.tsx            ← stub
```

---

## Notes

- `benchmark.ts` must NOT import any TUI/OpenTUI code — it's shared with headless mode
- `headless.ts` uses `process.exit()` — that's correct, no renderer here
- `src/tui/index.tsx` must use `renderer.destroy()` never `process.exit()` for exits
- Keep `ai-config.js`, `opencode-integration.js`, `models-dev.js`, `test-prompt.js` as-is for now — they get imported by TypeScript via dynamic import or direct import with type cast
- `@ai-sdk/anthropic` and `@ai-sdk/openai-compatible` stay in dependencies — used by headless only now (AI SDK streaming removed from benchmark but packages stay)
