# Phase 8 — Build, Polish & Cleanup

Goal: production-ready build, clean types throughout, docs updated, old files removed, everything ships as the new CLI.

---

## TODO

### Build system

- [ ] Finalize `package.json` scripts:
  ```json
  {
    "start": "bun src/index.ts",
    "dev": "bun --watch src/index.ts",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:update": "bun test --update-snapshots",
    "build": "bun build src/index.ts --outfile dist/ai-speedometer --target bun --minify && chmod +x dist/ai-speedometer",
    "typecheck": "bun tsc --noEmit"
  }
  ```

- [ ] Verify `dist/ai-speedometer` binary runs correctly:
  - `./dist/ai-speedometer` → boots TUI
  - `./dist/ai-speedometer --bench provider:model` → headless JSON output
  - `./dist/ai-speedometer --help` → help text printed, exits 0
  - `./dist/ai-speedometer --bench-custom p:m --base-url ... --api-key ...` → headless custom

- [ ] Update `package.json` `bin`:
  ```json
  {
    "ai-speedometer": "dist/ai-speedometer",
    "aispeed": "dist/ai-speedometer"
  }
  ```

- [ ] Verify `prepublishOnly` calls `npm run build` and produces correct dist file

### Cleanup

- [ ] Delete `cli.js` (replaced by `src/` TypeScript)
- [ ] Delete `debug-test.js` (was temp debugging file)
- [ ] Delete `test-config.js` (replaced by proper test suite)
- [ ] Delete `test-prompt.js` — move test prompt content into `src/constants.ts` as `export const TEST_PROMPT`
- [ ] Verify `ai-config.js`, `models-dev.js`, `opencode-integration.js` are still imported correctly from TypeScript (or port them to `.ts` if there are type issues)

### TypeScript polish

- [ ] Run `bun tsc --noEmit` — zero errors required
- [ ] Run `bun lint` if a linter is configured (check if eslint or biome is present)
- [ ] Ensure no `any` types except where strictly necessary — use `unknown` + type guards instead
- [ ] All component props have explicit TypeScript interfaces exported alongside the component
- [ ] All `AppAction` union members are exhaustive in `appReducer` switch — TypeScript will enforce this
- [ ] No unused imports — TypeScript strict mode catches these

### UX polish

- [ ] `Header.tsx` — confirm `ascii-font` renders at right size on 80-col terminal
- [ ] All screens handle `isLoadingConfig=true` gracefully — show spinner or "Loading..."
- [ ] `ModelSelectScreen` — confirm search debounce 50ms still feels snappy
- [ ] `BenchmarkScreen` — confirm spinner animation is smooth at 80ms interval
- [ ] `ResultsTable` — confirm column widths don't break on long model names (truncate with `…` if over limit)
- [ ] Footer always visible — ensure `App.tsx` outer box uses `height="100%"` correctly
- [ ] Test on 80x24 terminal (minimum) and 220x50 terminal (large) — no layout breaks

### Error handling

- [ ] Config load failure in `AppProvider` → show error screen, not crash
- [ ] Network failure in `AddVerifiedScreen` (getAllProviders fails) → friendly error + retry option
- [ ] Benchmark total failure (all models error) → BenchmarkScreen shows all error rows, still navigable
- [ ] `renderer.destroy()` called on SIGINT (`process.on('SIGINT', ...)`) in `src/tui/index.tsx`

### Docs update

- [ ] Update `README.md`:
  - remove references to `node cli.js`
  - add `bun src/index.ts` as dev run command
  - update install instructions if needed
  - keep headless `--bench` examples (unchanged functionality)
- [ ] Update `AGENTS.md` if any new commands are relevant (e.g. `bun test`, `bun run typecheck`)
- [ ] Update `ai-benchmark-config.json.template` if schema changed

### Final verification checklist

- [ ] `bun run typecheck` → 0 errors
- [ ] `bun test` → all tests pass, no failures
- [ ] `bun run build` → produces `dist/ai-speedometer`
- [ ] `./dist/ai-speedometer --help` → clean help output
- [ ] `./dist/ai-speedometer` → TUI launches, all screens navigable
- [ ] `./dist/ai-speedometer --bench provider:model` → JSON output to stdout
- [ ] No leftover temp files
- [ ] Git status shows only intentional changes

---

## Files deleted this phase

```
cli.js
debug-test.js
test-config.js
test-prompt.js          ← content moved to src/constants.ts
```

## Files modified this phase

```
package.json            ← scripts + bin updated
README.md               ← updated
AGENTS.md               ← updated if needed
src/constants.ts        ← new: TEST_PROMPT + other constants
```

---

## Notes

- `bun build` with `--target bun` produces a Bun-native binary — faster startup than Node
- The `dist/ai-speedometer` file is a standalone executable — `chmod +x` is needed
- `prepublishOnly` hook runs `npm run build` before `npm publish` — verify this still works
- Keep `@ai-sdk/anthropic` and `@ai-sdk/openai-compatible` in `dependencies` — they're still used by `headless.ts` if AI SDK mode is ever needed, plus they're in package.json already
- Actually: since AI SDK mode is removed, audit whether `@ai-sdk/anthropic` etc. are still imported anywhere — if not, remove from dependencies to reduce install size
