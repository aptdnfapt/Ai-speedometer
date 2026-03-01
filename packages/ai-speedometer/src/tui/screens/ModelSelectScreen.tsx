import { useState, useEffect, useCallback, useRef } from 'react'
import { useTerminalDimensions } from '@opentui/react'
import { useAppKeyboard as useKeyboard } from '../hooks/useAppKeyboard.ts'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'
import { useTheme } from '../theme/ThemeContext.tsx'
import { usePaste } from '../hooks/usePaste.ts'
import type { Model } from '@ai-speedometer/core/types'

interface ModelItem extends Model { key: string }
type ListRow = { kind: 'model'; model: ModelItem; idx: number } | { kind: 'separator'; label: string }
const DEBOUNCE_MS = 50

export function ModelSelectScreen() {
  const { state, dispatch } = useAppContext()
  const navigate = useNavigate()
  const theme = useTheme()
  const { height, width } = useTerminalDimensions()

  const [searchQuery, setSearchQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [allModels, setAllModels] = useState<ModelItem[]>([])
  const [recentKeys, setRecentKeys] = useState<Set<string>>(new Set())
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const scrollboxRef = useRef<any>(null)

  const PAGE_SIZE = Math.max(3, height - 14)
  const CARD_W = Math.min(60, width - 4)

  useEffect(() => {
    const providers = state.config?.providers ?? []
    const models: ModelItem[] = []
    for (const provider of providers) {
      for (const m of provider.models) {
        models.push({ id: m.id, name: m.name || m.id, providerName: provider.name, providerType: provider.type, providerId: provider.id, providerConfig: { baseUrl: provider.baseUrl, apiKey: provider.apiKey }, key: `${provider.id}::${m.id}` })
      }
    }
    setAllModels(models)
    async function loadRecents() {
      try {
        const { getRecentModels, cleanupRecentModelsFromConfig } = await import('@ai-speedometer/core/ai-config')
        await cleanupRecentModelsFromConfig()
        const recents: Array<{ modelId: string; providerName?: string }> = await getRecentModels()
        const keys = new Set<string>()
        for (const r of recents) { keys.add(r.modelId); if (r.providerName) keys.add(`${r.modelId}|${r.providerName}`) }
        setRecentKeys(keys)
      } catch { setRecentKeys(new Set()) }
    }
    loadRecents()
  }, [state.config])

  useEffect(() => { const t = setTimeout(() => setDebouncedQuery(searchQuery), DEBOUNCE_MS); return () => clearTimeout(t) }, [searchQuery])
  useEffect(() => { setCursor(0) }, [debouncedQuery])

  function isRecent(m: ModelItem) { return recentKeys.has(m.id) || recentKeys.has(`${m.id}|${m.providerName}`) }

  const orderedModels: ModelItem[] = (() => {
    if (!debouncedQuery) { const r = allModels.filter(m => isRecent(m)); return [...r, ...allModels.filter(m => !isRecent(m))] }
    const words = debouncedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0)
    return allModels.filter(m => { const h = `${m.name} ${m.providerName} ${m.providerId} ${m.id}`.toLowerCase(); return words.every(w => h.includes(w)) })
  })()

  const recentCount = !debouncedQuery ? orderedModels.filter(m => isRecent(m)).length : 0

  const allRows: ListRow[] = (() => {
    const rows: ListRow[] = []; let modelIdx = 0
    for (let i = 0; i < orderedModels.length; i++) {
      const m = orderedModels[i]; const mIsRecent = isRecent(m); const prevIsRecent = i > 0 ? isRecent(orderedModels[i - 1]) : false
      if (!debouncedQuery && recentCount > 0) {
        if (i === 0 && mIsRecent) rows.push({ kind: 'separator', label: '── recent ──' })
        else if (!mIsRecent && prevIsRecent) rows.push({ kind: 'separator', label: '── all models ──' })
      }
      rows.push({ kind: 'model', model: m, idx: modelIdx++ })
    }
    return rows
  })()

  const allModelRows = allRows.filter(r => r.kind === 'model') as Extract<ListRow, { kind: 'model' }>[]
  const cursorModel = allModelRows[cursor]?.model

  useEffect(() => {
    const sb = scrollboxRef.current; if (!sb) return
    const top = sb.scrollTop; const visible = PAGE_SIZE
    if (cursor < top) sb.scrollTo(cursor)
    else if (cursor >= top + visible) sb.scrollTo(cursor - visible + 1)
  }, [cursor, PAGE_SIZE])

  const launchBench = useCallback((models: Model[]) => { dispatch({ type: 'BENCH_START', models }); navigate('benchmark') }, [dispatch, navigate])

  usePaste((text) => { setSearchQuery(q => q + text.replace(/[\r\n]/g, '')) })

  useKeyboard((key) => {
    if (key.name === 'escape') { navigate('main-menu'); return }
    if (key.name === 'up') { setCursor(c => Math.max(0, c - 1)); return }
    if (key.name === 'down') { setCursor(c => Math.min(allModelRows.length - 1, c + 1)); return }
    if (key.name === 'pageup') { setCursor(c => Math.max(0, c - PAGE_SIZE)); return }
    if (key.name === 'pagedown') { setCursor(c => Math.min(allModelRows.length - 1, c + PAGE_SIZE)); return }
    if (key.name === 'tab') {
      if (!cursorModel) return
      setSelected(prev => { const next = new Set(prev); if (next.has(cursorModel.key)) next.delete(cursorModel.key); else next.add(cursorModel.key); return next })
      return
    }
    if (key.name === 'return' || key.name === 'enter') {
      if (selected.size > 0) launchBench(allModels.filter(m => selected.has(m.key)))
      else if (cursorModel) launchBench([cursorModel])
      return
    }
    if (!searchQuery && key.sequence === 'A') { setSelected(new Set(orderedModels.map(m => m.key))); return }
    if (!searchQuery && key.sequence === 'N') { setSelected(new Set()); return }
    if (!searchQuery && recentCount > 0 && key.sequence === 'R') { launchBench(orderedModels.slice(0, recentCount)); return }
    if (key.name === 'backspace' || key.name === 'delete') { setSearchQuery(q => q.slice(0, -1)); return }
    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') setSearchQuery(q => q + key.sequence)
  })

  if (state.isLoadingConfig) {
    return <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center"><text fg={theme.dim}>Loading config...</text></box>
  }

  const nameW = Math.floor((CARD_W - 10) / 2)
  const provW = CARD_W - nameW - 10

  return (
    <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <box flexDirection="column" border borderStyle="rounded" borderColor={theme.border} backgroundColor={theme.background} width={CARD_W}>
        <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text fg={theme.accent}>Search: </text>
          <text fg={theme.text}>{searchQuery}_</text>
        </box>
        <box height={1} backgroundColor={theme.border} />
        <scrollbox ref={scrollboxRef} height={PAGE_SIZE} style={{ scrollbarOptions: { showArrows: true, trackOptions: { foregroundColor: theme.primary, backgroundColor: theme.border } } }}>
          {allRows.length === 0 && <box height={1} paddingLeft={2}><text fg={theme.dim}>No models found</text></box>}
          {(() => {
            let modelCursor = 0
            return allRows.map((row, i) => {
              if (row.kind === 'separator') return <box key={`sep-${i}`} height={1} paddingLeft={2}><text fg={theme.dim}>{row.label}</text></box>
              const localCursor = modelCursor++
              const isActive = localCursor === cursor
              const isSel = selected.has(row.model.key)
              let nameFg = theme.dim
              if (isActive && isSel) nameFg = theme.accent
              else if (isActive) nameFg = theme.text
              else if (isSel) nameFg = theme.success
              return (
                <box key={row.model.key} height={1} width="100%" flexDirection="row" backgroundColor={isActive ? theme.border : 'transparent'}>
                  <text fg={theme.dim} width={2}> </text>
                  <text fg={nameFg} width={nameW}>{row.model.name}</text>
                  <text fg={isActive ? theme.primary : theme.dim} width={provW}>{row.model.providerName}</text>
                  <text fg={theme.success} width={2}>{isSel ? '✓' : ' '}</text>
                  <text fg={theme.accent} width={2}>{isActive ? '›' : ' '}</text>
                </box>
              )
            })
          })()}
        </scrollbox>
        <box height={1} backgroundColor={theme.border} />
        <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text fg={theme.secondary}>Selected: {selected.size} model{selected.size !== 1 ? 's' : ''}</text>
          {recentCount > 0 && <text fg={theme.dim}>   [R] recent ({recentCount})</text>}
          <text fg={theme.dim}>   [↑↓/PgUp/PgDn/wheel] scroll</text>
        </box>
      </box>
    </box>
  )
}
