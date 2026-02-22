# Phase 8 — Build, Polish & Cleanup

Goal: production-ready build, clean types throughout, docs updated, old files removed, everything ships as the new CLI.

**STATUS: COMPLETE**

---

## DONE

### Build system

- [x] Finalize `package.json` scripts — added `typecheck`, `test:watch`, `test:update`
- [x] Build uses `bun build --compile` → produces true standalone ELF binary at `dist/ai-speedometer`
- [x] `bin` in `package.json` points to `dist/ai-speedometer` ✓
- [x] `prepublishOnly` calls `bun run build` ✓
- [x] `./dist/ai-speedometer --help` → clean help output ✓
- [x] `./dist/ai-speedometer` → TUI launches ✓

### Cleanup (done in commit 56c2c64)

- [x] Deleted `cli.js`, `debug-test.js`, `test-config.js`, `test-prompt.js`
- [x] Moved TEST_PROMPT to `src/constants.ts`
- [x] Ported `ai-config.js`, `models-dev.js`, `opencode-integration.js` → `.ts` files
- [x] Removed unused deps: `@ai-sdk/anthropic`, `@ai-sdk/openai-compatible`, `ai`, `cli-table3`, `dotenv`, `esbuild`
- [x] Only `jsonc-parser` remains in dependencies

### TypeScript polish

- [x] `bun tsc --noEmit` → 0 errors

### UX polish

- [x] All screens handle `isLoadingConfig=true` gracefully — `ModelSelectScreen` shows "Loading config..."
- [x] `ResultsTable` — truncates with `…` via `trunc()` for long model/provider names ✓
- [x] Footer always visible — `App.tsx` outer box uses `height="100%"` ✓
- [x] `BenchmarkScreen` spinner at 80ms interval ✓

### Error handling

- [x] Config load failure → `AppProvider` dispatches `SET_CONFIG` with empty providers on catch
- [x] Network failure in `AddVerifiedScreen` → shows error string from `loadError`
- [x] `renderer.destroy()` called on SIGINT in `src/tui/index.tsx` ✓

### Docs update

- [x] `docs/README.md` updated with Phase 8 section
- [x] `plan/phase-8-build-and-polish.md` marked complete

### Final verification

- [x] `bun run typecheck` → 0 errors
- [x] `bun test` → 51 pass, 0 fail
- [x] `bun run build` → produces `dist/ai-speedometer` (ELF standalone binary)
- [x] `./dist/ai-speedometer --help` → clean help output

---

## Notes

- `bun build --compile` produces a true standalone ELF binary — Bun runtime embedded, no external bun required
- `--outfile` without `--compile` fails when tree-sitter WASM assets are present (bun emits multiple output files)
- AI SDK deps removed — REST API is the only benchmark method, `headless.ts` doesn't use AI SDK
