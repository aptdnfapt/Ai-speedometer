# Phase 6 — Provider Management Screens

Goal: all three provider-add screens fully working — Add Verified Provider, Add Custom Provider, Add Models to Provider.

---

## TODO

### AddVerifiedScreen

- [ ] Implement `src/tui/screens/AddVerifiedScreen.tsx`:

  **What it does:** search providers from models.dev → pick one → enter API key → save

  **Layout — Tokyo Night styled:**
  ```
  ╭─ Add Verified Provider ────────────────────────────╮  border=#292e42 bg=#16161e
  │ Search: query_                                      │  "Search:" fg=#7dcfff
  ├─────────────────────────────────────────────────────┤
  │  openai         (openai-compatible)   bg=#292e42    │  active row highlight
  │  anthropic      (anthropic)           fg=#565f89    │  inactive dim
  │  google         (google)              fg=#565f89    │
  │ ...                                                 │
  ├─────────────────────────────────────────────────────┤
  │ Page 1/3  [PageUp/PageDown]           fg=#7dcfff    │
  ╰─────────────────────────────────────────────────────╯
  ```

  **State:**
  ```ts
  type Step = 'browse' | 'confirm'
  const [step, setStep] = useState<Step>('browse')
  const [allProviders, setAllProviders] = useState<ProviderInfo[]>([])
  const [filtered, setFiltered] = useState<ProviderInfo[]>([])
  const [cursor, setCursor] = useState(0)
  const [page, setPage] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [apiKeyFocused, setApiKeyFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  ```

  **Step: 'browse'**
  - load `getAllProviders()` from `models-dev.js` on mount
  - keyboard: same nav pattern as ModelSelectScreen (↑↓, PageUp/Down, search chars, Backspace)
  - `Enter` → set `selectedProvider` → `step = 'confirm'`
  - `q`/`Esc` → navigate to `'model-menu'`

  **Step: 'confirm'**
  - show provider details (name, type, baseUrl, model count preview)
  - `<input value={apiKey} onChange={setApiKey} focused placeholder="Enter API key" />`
  - `Enter` (when apiKey not empty) → call save flow:
    1. `setSaving(true)`
    2. `addApiKey(providerId, apiKey)` from `opencode-integration.js`
    3. `addVerifiedProvider(providerId, apiKey)` from `ai-config.js`
    4. on success: `setSaveSuccess(true)`, reload config in AppContext (`dispatch SET_CONFIG`)
    5. on error: `setSaveError(error.message)`
  - `Esc` → back to `'browse'` step
  - after success: show "Provider added! N models available" → `Enter` to return to model-menu

  **Footer hints:**
  - browse step: `['[↑↓] navigate', '[Enter] select', '[q] back']`
  - confirm step: `['[Enter] save', '[Esc] back to list']`

### AddCustomScreen

- [ ] Implement `src/tui/screens/AddCustomScreen.tsx`:

  **What it does:** multi-step form to add a fully custom provider

  **Steps:**
  ```ts
  type Step = 'type' | 'id' | 'name' | 'url' | 'key' | 'models' | 'saving' | 'done'
  ```

  **Step: 'type'** — pick provider type
  - uses `<MenuList>` with items: `OpenAI Compatible`, `Anthropic`, `Back`
  - `Enter` on Back → navigate to `'model-menu'`

  **Step: 'id'** — enter provider ID
  - `<input>` focused, placeholder "e.g. my-openai"
  - `Enter` (non-empty) → next step

  **Step: 'name'** — enter display name
  - `<input>` focused, placeholder "e.g. MyOpenAI"
  - `Enter` → next step

  **Step: 'url'** — enter base URL
  - `<input>` focused, placeholder "https://api.example.com/v1"
  - `Enter` → next step
  - basic validation: must start with `http`

  **Step: 'key'** — enter API key
  - `<input>` focused, placeholder "sk-..."
  - `Enter` → next step

  **Step: 'models'** — add model names
  - shows already-added models list above
  - `<input>` focused, placeholder "model-name (Enter to add, empty to finish)"
  - `Enter` with text → adds to local models array, clears input
  - `Enter` with empty → proceed to `'saving'` (if at least 1 model)
  - `Esc` → back to previous step

  **Step: 'saving'** — show spinner `⠹ Saving...`
  - calls `addCustomProvider(providerData)` from `ai-config.js`
  - on success → reload config + `step = 'done'`
  - on error → show error, `Enter` to retry or `Esc` to go back

  **Step: 'done'**
  - `<text fg="#9ece6a">Custom provider added! N models configured.</text>`
  - `Enter` → navigate to `'model-menu'`

  **Progress indicator** above form — shows which step: `① Type  ② ID  ③ Name  ④ URL  ⑤ Key  ⑥ Models`
  - current step fg `#7dcfff`, done steps fg `#9ece6a`, future steps fg `#565f89`

  **Footer hints:** per step context

### AddModelsScreen

- [ ] Implement `src/tui/screens/AddModelsScreen.tsx`:

  **What it does:** pick existing custom provider → add model names to it

  **Layout — Step 1: pick provider**
  - loads `getCustomProvidersFromConfig()` from `ai-config.js` on mount
  - if none: show "No custom providers yet. Add one first." + `q` to back
  - `<MenuList>` of custom providers
  - `Enter` → set selected provider → step 2

  **Layout — Step 2: add models (Tokyo Night):**
  ```
  ╭─ Add Models to: MyOpenAI ───────────────────────╮  border=#292e42 bg=#16161e
  │ Current models:              fg=#7aa2f7           │
  │   · gpt-4                    fg=#565f89           │
  │   · gpt-4-turbo              fg=#565f89           │
  │                                                   │
  │ Model name: new-model-name_  fg=#7dcfff           │
  │                                                   │
  │ Added 2 models so far        fg=#9ece6a           │
  ╰─────────────────────────────────────────────────╯
  ```
  - `<input>` focused for model name entry
  - `Enter` with text → `addModelToCustomProvider(provider.id, { name, id })` → append to list → clear input
  - `Enter` empty → if any added → success message → back to `'model-menu'`
  - `Esc` → back to provider list (step 1)
  - show live count of models added this session: `Added 2 models so far`

  **Footer hints:**
  - step 1: `['[↑↓] navigate', '[Enter] select', '[q] back']`
  - step 2: `['[Enter] add model', '[empty Enter] finish', '[Esc] back']`

### Verification

- [ ] Add Verified Provider → search works → pick provider → enter API key → saved → config reloads
- [ ] Add Custom Provider → full multi-step form → all fields validated → provider appears in List Providers
- [ ] Add Models → pick existing provider → add model names → appear in provider model list
- [ ] `bun tsc --noEmit` → zero errors

---

## Files modified this phase

```
src/tui/
  App.tsx                         ← update getHints() for all 3 screens
  screens/
    AddVerifiedScreen.tsx         ← full impl
    AddCustomScreen.tsx           ← full impl
    AddModelsScreen.tsx           ← full impl
```

---

## Notes

- `<input>` component from OpenTUI requires `focused` prop to receive keystrokes — manage focus state carefully
- After saving any provider: dispatch `SET_CONFIG` to AppContext with freshly loaded providers so ModelSelectScreen sees the new data immediately
- `addCustomProvider` from `ai-config.js` auto-generates model IDs: `modelName.toLowerCase().replace(/[^a-z0-9-]/g, '-')`
- Step progress indicator is cosmetic only — `⑤` etc. are Unicode circled numbers: `①②③④⑤⑥`
- API key input: do NOT mask the key (original CLI didn't either) — this is a terminal tool, key is visible
