# Phase 3 — Menus & Navigation

Goal: all menu screens fully implemented and navigable. No benchmark or provider-add flows yet — just menus working perfectly with keyboard nav.

---

## TODO

### Shared component: MenuList

- [ ] Create `src/tui/components/MenuList.tsx`:
  - props:
    ```ts
    {
      items: { label: string; description?: string }[]
      selectedIndex: number
      onSelect: (index: number) => void
      onNavigate?: (index: number) => void
    }
    ```
  - `useKeyboard` inside: `↑` → selectedIndex-1 (circular), `↓` → +1, `Enter` → `onSelect`
  - each row: `● label  description` when selected (green), `○ label  description` when not (dim)
  - no scrollbox needed — menus are short (max 6 items)
  - `useState(selectedIndex)` for local cursor — calls `onNavigate` on change, `onSelect` on enter

### MainMenuScreen

- [ ] Implement `src/tui/screens/MainMenuScreen.tsx`:
  - menu items:
    1. `Run Benchmark` → navigate to `'model-select'`
    2. `Set Model` → navigate to `'model-menu'`
    3. `Exit` → `renderer.destroy()`
  - uses `<MenuList>` with local `useState(0)` for cursor
  - `useNavigate()` from context for navigation
  - `useRenderer()` for destroy on Exit
  - title: `<text fg="#FF00FF">Main Menu</text>`

### ModelMenuScreen

- [ ] Implement `src/tui/screens/ModelMenuScreen.tsx`:
  - menu items:
    1. `Add Verified Provider` → navigate to `'add-verified'`
    2. `Add Custom Provider` → navigate to `'add-custom'`
    3. `Add Models to Provider` → navigate to `'add-models'`
    4. `List Providers` → navigate to `'list-providers'`
    5. `Back` → navigate to `'main-menu'`
  - uses `<MenuList>`
  - title: `<text fg="#FF00FF">Model Management</text>`
  - `Esc` / `q` → back to main-menu (via `useKeyboard`)

### ListProvidersScreen

- [ ] Implement `src/tui/screens/ListProvidersScreen.tsx`:
  - reads `state.config.providers` from context
  - splits into verified (has `baseUrl` with `api.`) vs custom
  - `<scrollbox>` wrapping provider list:
    - each provider: name + type in a bordered box
    - models listed below each provider indented
  - `q` / `Esc` → back to `'model-menu'`
  - loading state: if `isLoadingConfig` → `<text>Loading providers...</text>`
  - empty state: `<text fg="yellow">No providers configured yet.</text>`

### Footer hints per screen (update App.tsx getHints)

- [ ] `main-menu` → `['[↑↓] navigate', '[Enter] select', '[Ctrl+C] quit']`
- [ ] `model-menu` → `['[↑↓] navigate', '[Enter] select', '[q] back']`
- [ ] `list-providers` → `['[↑↓] scroll', '[q] back']`
- [ ] all others (stubs) → `['[q] back']`

### Verification

- [ ] `bun src/index.ts` → Main Menu shows 3 items with ● / ○ indicators
- [ ] Arrow keys cycle through menu items
- [ ] Enter on "Set Model" → Model Management screen appears
- [ ] Enter on "List Providers" → provider list (or empty state)
- [ ] `q` from Model Management → back to Main Menu
- [ ] Enter on "Exit" → terminal restored cleanly
- [ ] `bun tsc --noEmit` → zero errors

---

## Files modified this phase

```
src/tui/
  App.tsx                         ← update getHints()
  components/
    MenuList.tsx                  ← new
  screens/
    MainMenuScreen.tsx            ← full impl
    ModelMenuScreen.tsx           ← full impl
    ListProvidersScreen.tsx       ← full impl
```

---

## Notes

- `MenuList` owns its cursor state internally — parent passes `onSelect` callback only
- `useKeyboard` in MenuList: do NOT bubble — no global key conflict with App's Ctrl+C handler
- ListProvidersScreen: use `<scrollbox focused>` so arrow keys scroll the list
- Circular navigation: `(index - 1 + items.length) % items.length` for up, `(index + 1) % items.length` for down
