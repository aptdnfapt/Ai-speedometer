import { useState, useEffect, useCallback } from 'react'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'
import type { Model } from '../../types.ts'

interface ModelItem extends Model {
  key: string
}

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
  const [recentIds, setRecentIds] = useState<Set<string>>(new Set())
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
        const { getRecentModels, cleanupRecentModelsFromConfig } = await import('../../../ai-config.js')
        await cleanupRecentModelsFromConfig()
        const recents: Array<{ modelId: string }> = await getRecentModels()
        setRecentIds(new Set(recents.map(r => r.modelId)))
      } catch {
        setRecentIds(new Set())
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

  const filteredModels: ModelItem[] = (() => {
    if (!debouncedQuery) {
      const recents = allModels.filter(m => recentIds.has(m.id))
      const rest = allModels.filter(m => !recentIds.has(m.id))
      return [...recents, ...rest]
    }
    const q = debouncedQuery.toLowerCase()
    return allModels.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.providerName.toLowerCase().includes(q) ||
      m.providerId.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q)
    )
  })()

  const totalPages = Math.max(1, Math.ceil(filteredModels.length / PAGE_SIZE))
  const pageModels = filteredModels.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const recentCount = !debouncedQuery
    ? filteredModels.filter(m => recentIds.has(m.id)).length
    : 0

  const launchBench = useCallback((models: Model[]) => {
    dispatch({ type: 'BENCH_START', models })
    navigate('benchmark')
  }, [dispatch, navigate])

  useKeyboard((key) => {
    if (key.name === 'escape') {
      navigate('main-menu')
      return
    }
    if (key.name === 'up') {
      setCursor(c => (c - 1 + pageModels.length) % Math.max(1, pageModels.length))
      return
    }
    if (key.name === 'down') {
      setCursor(c => (c + 1) % Math.max(1, pageModels.length))
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
      const model = pageModels[cursor]
      if (!model) return
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(model.key)) next.delete(model.key)
        else next.add(model.key)
        return next
      })
      return
    }
    if (key.name === 'return' || key.name === 'enter') {
      if (selected.size > 0) {
        launchBench(allModels.filter(m => selected.has(m.key)))
      } else {
        const model = pageModels[cursor]
        if (model) launchBench([model])
      }
      return
    }
    if (!searchQuery && key.sequence === 'a') {
      setSelected(new Set(filteredModels.map(m => m.key)))
      return
    }
    if (!searchQuery && key.sequence === 'n') {
      setSelected(new Set())
      return
    }
    if (!searchQuery && recentCount > 0 && key.sequence === 'r') {
      launchBench(filteredModels.slice(0, recentCount))
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

        {/* divider line */}
        <box height={1} backgroundColor="#292e42" />

        {/* model list — fixed height, overflow hidden */}
        <box
          flexDirection="column"
          height={PAGE_SIZE}
          overflow="hidden"
          paddingTop={1}
          paddingBottom={1}
        >
          {pageModels.length === 0 && (
            <box paddingLeft={2}>
              <text fg="#565f89">No models found</text>
            </box>
          )}
          {pageModels.map((model, i) => {
            const isActive = i === cursor
            const isSel = selected.has(model.key)
            const isRecent = !debouncedQuery && recentIds.has(model.id)
            const globalIdx = page * PAGE_SIZE + i
            const prevModel = filteredModels[globalIdx - 1]
            const prevIsRecent = globalIdx > 0 && !debouncedQuery && prevModel !== undefined && recentIds.has(prevModel.id)

            let nameFg = '#565f89'
            if (isActive && isSel) nameFg = '#7dcfff'
            else if (isActive) nameFg = '#c0caf5'
            else if (isSel) nameFg = '#9ece6a'

            const nameW = Math.floor((CARD_W - 10) / 2)
            const provW = CARD_W - nameW - 10

            return (
              <box key={model.key} flexDirection="column">
                {/* recent section label */}
                {!debouncedQuery && recentCount > 0 && globalIdx === 0 && isRecent && (
                  <box height={1} paddingLeft={2}>
                    <text fg="#565f89">── recent ──</text>
                  </box>
                )}
                {/* separator after recent block */}
                {!debouncedQuery && recentCount > 0 && !isRecent && prevIsRecent && (
                  <box height={1} paddingLeft={2}>
                    <text fg="#292e42">────────────</text>
                  </box>
                )}
                {/* row — fixed height=1, full width highlight */}
                <box
                  height={1}
                  width="100%"
                  flexDirection="row"
                  backgroundColor={isActive ? '#292e42' : 'transparent'}
                >
                  <text fg="#565f89" width={2}> </text>
                  <text fg={nameFg} width={nameW}>{model.name}</text>
                  <text fg={isActive ? '#7aa2f7' : '#565f89'} width={provW}>{model.providerName}</text>
                  <text fg="#9ece6a" width={2}>{isSel ? '✓' : ' '}</text>
                  <text fg="#7dcfff" width={2}>{isActive ? '›' : ' '}</text>
                </box>
              </box>
            )
          })}
        </box>

        {/* divider line */}
        <box height={1} backgroundColor="#292e42" />

        {/* status bar */}
        <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text fg="#bb9af7">Selected: {selected.size} model{selected.size !== 1 ? 's' : ''}</text>
          {totalPages > 1 && (
            <text fg="#7dcfff">   Page {page + 1}/{totalPages}</text>
          )}
          {page < totalPages - 1 && (
            <text fg="#565f89">   ↓ more</text>
          )}
        </box>
      </box>
    </box>
  )
}
