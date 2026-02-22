import { useState, useEffect, useCallback } from 'react'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'
import { usePaste } from '../hooks/usePaste.ts'
import type { Model } from '../../types.ts'

interface ModelItem extends Model {
  key: string
}

type ListRow =
  | { kind: 'model'; model: ModelItem; idx: number }
  | { kind: 'separator'; label: string }

const DEBOUNCE_MS = 50

export function ModelSelectScreen() {
  const { state, dispatch } = useAppContext()
  const navigate = useNavigate()
  const { height, width } = useTerminalDimensions()

  const [searchQuery, setSearchQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [allModels, setAllModels] = useState<ModelItem[]>([])
  const [recentKeys, setRecentKeys] = useState<Set<string>>(new Set())
  const [debouncedQuery, setDebouncedQuery] = useState('')

  const PAGE_SIZE = Math.max(3, height - 14)
  const CARD_W = Math.min(60, width - 4)

  useEffect(() => {
    const providers = state.config?.providers ?? []
    const models: ModelItem[] = []
    for (const provider of providers) {
      for (const m of provider.models) {
        models.push({
          id: m.id,
          name: m.name || m.id,
          providerName: provider.name,
          providerType: provider.type,
          providerId: provider.id,
          providerConfig: { baseUrl: provider.baseUrl, apiKey: provider.apiKey },
          key: `${provider.id}::${m.id}`,
        })
      }
    }
    setAllModels(models)

    async function loadRecents() {
      try {
        const { getRecentModels, cleanupRecentModelsFromConfig } = await import('../../ai-config.ts')
        await cleanupRecentModelsFromConfig()
        const recents: Array<{ modelId: string; providerName?: string }> = await getRecentModels()
        const keys = new Set<string>()
        for (const r of recents) {
          keys.add(r.modelId)
          if (r.providerName) keys.add(`${r.modelId}|${r.providerName}`)
        }
        setRecentKeys(keys)
      } catch {
        setRecentKeys(new Set())
      }
    }
    loadRecents()
  }, [state.config])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    setCursor(0)
    setPage(0)
  }, [debouncedQuery])

  function isRecent(m: ModelItem): boolean {
    return recentKeys.has(m.id) || recentKeys.has(`${m.id}|${m.providerName}`)
  }

  // ordered model list — recents first when no query
  const orderedModels: ModelItem[] = (() => {
    if (!debouncedQuery) {
      const recents = allModels.filter(m => isRecent(m))
      const rest    = allModels.filter(m => !isRecent(m))
      return [...recents, ...rest]
    }
    const words = debouncedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 0)
    return allModels.filter(m => {
      const haystack = `${m.name} ${m.providerName} ${m.providerId} ${m.id}`.toLowerCase()
      return words.every(w => haystack.includes(w))
    })
  })()

  const recentCount = !debouncedQuery ? orderedModels.filter(m => isRecent(m)).length : 0

  // build flat row list including separator rows — separators don't count as navigable
  const allRows: ListRow[] = (() => {
    const rows: ListRow[] = []
    let modelIdx = 0
    for (let i = 0; i < orderedModels.length; i++) {
      const m = orderedModels[i]
      const mIsRecent = isRecent(m)
      const prevIsRecent = i > 0 ? isRecent(orderedModels[i - 1]) : false

      if (!debouncedQuery && recentCount > 0) {
        if (i === 0 && mIsRecent) {
          rows.push({ kind: 'separator', label: '── recent ──' })
        } else if (!mIsRecent && prevIsRecent) {
          rows.push({ kind: 'separator', label: '── all models ──' })
        }
      }
      rows.push({ kind: 'model', model: m, idx: modelIdx++ })
    }
    return rows
  })()

  // navigable model count
  const modelRowCount = allRows.filter(r => r.kind === 'model').length

  // pagination over all rows (separators take up visual space)
  const totalPages = Math.max(1, Math.ceil(allRows.length / PAGE_SIZE))
  const pageRows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // cursor is index into model rows only
  const pageModelRows = pageRows.filter(r => r.kind === 'model') as Extract<ListRow, { kind: 'model' }>[]
  const cursorModel = pageModelRows[cursor]?.model

  const launchBench = useCallback((models: Model[]) => {
    dispatch({ type: 'BENCH_START', models })
    navigate('benchmark')
  }, [dispatch, navigate])

  usePaste((text) => {
    setSearchQuery(q => q + text)
  })

  useKeyboard((key) => {
    if (key.name === 'escape') { navigate('main-menu'); return }

    if (key.name === 'up') {
      setCursor(c => Math.max(0, c - 1))
      return
    }
    if (key.name === 'down') {
      setCursor(c => Math.min(pageModelRows.length - 1, c + 1))
      return
    }
    if (key.name === 'pageup') {
      setPage(p => Math.max(0, p - 1))
      setCursor(0)
      return
    }
    if (key.name === 'pagedown') {
      setPage(p => Math.min(totalPages - 1, p + 1))
      setCursor(0)
      return
    }
    if (key.name === 'tab') {
      if (!cursorModel) return
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(cursorModel.key)) next.delete(cursorModel.key)
        else next.add(cursorModel.key)
        return next
      })
      return
    }
    if (key.name === 'return' || key.name === 'enter') {
      if (selected.size > 0) {
        launchBench(allModels.filter(m => selected.has(m.key)))
      } else if (cursorModel) {
        launchBench([cursorModel])
      }
      return
    }
    if (!searchQuery && (key.sequence === 'A' || key.sequence === 'a')) {
      setSelected(new Set(orderedModels.map(m => m.key)))
      return
    }
    if (!searchQuery && (key.sequence === 'N' || key.sequence === 'n')) {
      setSelected(new Set())
      return
    }
    if (!searchQuery && recentCount > 0 && (key.sequence === 'R' || key.sequence === 'r')) {
      launchBench(orderedModels.slice(0, recentCount))
      return
    }
    if (key.name === 'backspace' || key.name === 'delete') {
      setSearchQuery(q => q.slice(0, -1))
      return
    }
    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
      setSearchQuery(q => q + key.sequence)
    }
  })

  if (state.isLoadingConfig) {
    return (
      <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
        <text fg="#565f89">Loading config...</text>
      </box>
    )
  }

  const nameW = Math.floor((CARD_W - 10) / 2)
  const provW = CARD_W - nameW - 10

  // map model index on page → cursor position
  let pageModelCursor = 0

  return (
    <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <box
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor="#292e42"
        backgroundColor="#16161e"
        width={CARD_W}
      >
        {/* search bar */}
        <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text fg="#7dcfff">Search: </text>
          <text fg="#c0caf5">{searchQuery}_</text>
        </box>

        <box height={1} backgroundColor="#292e42" />

        {/* model list — fixed height */}
        <box flexDirection="column" height={PAGE_SIZE} overflow="hidden" paddingTop={1} paddingBottom={1}>
          {pageRows.length === 0 && (
            <box height={1} paddingLeft={2}>
              <text fg="#565f89">No models found</text>
            </box>
          )}
          {pageRows.map((row, i) => {
            if (row.kind === 'separator') {
              return (
                <box key={`sep-${i}`} height={1} paddingLeft={2}>
                  <text fg="#565f89">{row.label}</text>
                </box>
              )
            }

            const localCursor = pageModelCursor++
            const isActive = localCursor === cursor
            const isSel = selected.has(row.model.key)

            let nameFg = '#565f89'
            if (isActive && isSel) nameFg = '#7dcfff'
            else if (isActive)    nameFg = '#c0caf5'
            else if (isSel)       nameFg = '#9ece6a'

            return (
              <box
                key={row.model.key}
                height={1}
                width="100%"
                flexDirection="row"
                backgroundColor={isActive ? '#292e42' : 'transparent'}
              >
                <text fg="#565f89" width={2}> </text>
                <text fg={nameFg} width={nameW}>{row.model.name}</text>
                <text fg={isActive ? '#7aa2f7' : '#565f89'} width={provW}>{row.model.providerName}</text>
                <text fg="#9ece6a" width={2}>{isSel ? '✓' : ' '}</text>
                <text fg="#7dcfff" width={2}>{isActive ? '›' : ' '}</text>
              </box>
            )
          })}
        </box>

        <box height={1} backgroundColor="#292e42" />

        {/* status bar */}
        <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text fg="#bb9af7">Selected: {selected.size} model{selected.size !== 1 ? 's' : ''}</text>
          {recentCount > 0 && <text fg="#565f89">   [R] recent ({recentCount})</text>}
          {totalPages > 1 && <text fg="#7dcfff">   Page {page + 1}/{totalPages}</text>}
          {page < totalPages - 1 && <text fg="#565f89">   ↓ more</text>}
        </box>
      </box>
    </box>
  )
}
