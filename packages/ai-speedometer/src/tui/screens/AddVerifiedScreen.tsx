import { useState, useEffect, useRef } from 'react'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'
import { usePaste } from '../hooks/usePaste.ts'
import type { ProviderInfo } from '@ai-speedometer/core/models-dev'

type Step = 'browse' | 'confirm'

export function AddVerifiedScreen() {
  const { dispatch } = useAppContext()
  const navigate = useNavigate()
  const { height, width } = useTerminalDimensions()

  const PAGE_SIZE = Math.max(3, height - 16)
  const CARD_W = Math.min(62, width - 4)

  const [step, setStep] = useState<Step>('browse')
  const [allProviders, setAllProviders] = useState<ProviderInfo[]>([])
  const [filtered, setFiltered] = useState<ProviderInfo[]>([])
  const [cursor, setCursor] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const scrollboxRef = useRef<any>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const { getAllProviders } = await import('@ai-speedometer/core/models-dev')
        const providers = await getAllProviders()
        setAllProviders(providers)
        setFiltered(providers)
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e))
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!searchQuery) {
      setFiltered(allProviders)
    } else {
      const q = searchQuery.toLowerCase()
      setFiltered(allProviders.filter(p =>
        p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
      ))
    }
    setCursor(0)
  }, [searchQuery, allProviders])

  useEffect(() => {
    const sb = scrollboxRef.current
    if (!sb) return
    const top = sb.scrollTop
    const visible = PAGE_SIZE
    if (cursor < top) {
      sb.scrollTo(cursor)
    } else if (cursor >= top + visible) {
      sb.scrollTo(cursor - visible + 1)
    }
  }, [cursor, PAGE_SIZE])

  async function save() {
    if (!selectedProvider || !apiKey.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const { addApiKey } = await import('@ai-speedometer/core/opencode-integration')
      const { addVerifiedProvider, getVerifiedProvidersFromConfig } = await import('@ai-speedometer/core/ai-config')
      await addApiKey(selectedProvider.id, apiKey.trim())
      await addVerifiedProvider(selectedProvider.id, apiKey.trim())
      const { getAllAvailableProviders } = await import('@ai-speedometer/core/opencode-integration')
      const providers = await getAllAvailableProviders(false)
      dispatch({ type: 'SET_CONFIG', config: { providers } })
      setSaveSuccess(true)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  usePaste((text) => {
    const clean = text.replace(/[\r\n]/g, '')
    if (step === 'browse') setSearchQuery(q => q + clean)
    else if (step === 'confirm') setApiKey(k => k + clean)
  })

  useKeyboard((key) => {
    if (step === 'browse') {
      if (key.name === 'escape' || key.sequence === 'q' || key.sequence === 'Q') {
        navigate('model-menu')
        return
      }
      if (key.name === 'up') {
        setCursor(c => Math.max(0, c - 1))
        return
      }
      if (key.name === 'down') {
        setCursor(c => Math.min(filtered.length - 1, c + 1))
        return
      }
      if (key.name === 'pageup') {
        setCursor(c => Math.max(0, c - PAGE_SIZE))
        return
      }
      if (key.name === 'pagedown') {
        setCursor(c => Math.min(filtered.length - 1, c + PAGE_SIZE))
        return
      }
      if (key.name === 'return' || key.name === 'enter') {
        const prov = filtered[cursor]
        if (prov) {
          setSelectedProvider(prov)
          setApiKey('')
          setSaveError('')
          setSaveSuccess(false)
          setStep('confirm')
        }
        return
      }
      if (key.name === 'backspace' || key.name === 'delete') {
        setSearchQuery(q => q.slice(0, -1))
        return
      }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
        setSearchQuery(q => q + key.sequence)
      }
      return
    }

    if (step === 'confirm') {
      if (saveSuccess) {
        if (key.name === 'return' || key.name === 'enter') {
          navigate('model-menu')
        }
        return
      }
      if (saving) return
      if (key.name === 'escape') {
        setStep('browse')
        return
      }
      if (key.name === 'return' || key.name === 'enter') {
        save()
        return
      }
      if (key.name === 'backspace' || key.name === 'delete') {
        setApiKey(k => k.slice(0, -1))
        return
      }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
        setApiKey(k => k + key.sequence)
      }
    }
  })

  if (step === 'confirm' && selectedProvider) {
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
          <box height={1} paddingLeft={2} paddingTop={1}>
            <text fg="#7dcfff">Add Verified Provider</text>
          </box>
          <box height={1} backgroundColor="#292e42" />

          <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
            <box height={1} flexDirection="row">
              <text fg="#7aa2f7">Provider: </text>
              <text fg="#c0caf5">{selectedProvider.name}</text>
            </box>
            <box height={1} flexDirection="row">
              <text fg="#565f89">Type:     </text>
              <text fg="#565f89">{selectedProvider.type}</text>
            </box>
            <box height={1} flexDirection="row">
              <text fg="#565f89">URL:      </text>
              <text fg="#565f89">{selectedProvider.baseUrl}</text>
            </box>
            <box height={1} flexDirection="row">
              <text fg="#565f89">Models:   </text>
              <text fg="#565f89">{selectedProvider.models.length} available</text>
            </box>
          </box>

          <box height={1} backgroundColor="#292e42" />

          {saveSuccess ? (
            <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
              <box height={1}>
                <text fg="#9ece6a">Provider added!  {selectedProvider.models.length} models available</text>
              </box>
              <box height={1}>
                <text fg="#565f89">Press [Enter] to return</text>
              </box>
            </box>
          ) : (
            <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
              <box height={1} flexDirection="row">
                <text fg="#7dcfff">API Key: </text>
                <text fg="#c0caf5">{apiKey}_</text>
              </box>
              {saveError ? (
                <box height={1}>
                  <text fg="#f7768e">Error: {saveError}</text>
                </box>
              ) : null}
              {saving ? (
                <box height={1}>
                  <text fg="#ff9e64">Saving...</text>
                </box>
              ) : (
                <box height={1}>
                  <text fg="#565f89">[Enter] save   [Esc] back to list</text>
                </box>
              )}
            </box>
          )}
        </box>
      </box>
    )
  }

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
        <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text fg="#7dcfff">Search: </text>
          <text fg="#c0caf5">{searchQuery}_</text>
        </box>

        <box height={1} backgroundColor="#292e42" />

        <scrollbox ref={scrollboxRef} height={PAGE_SIZE} style={{ scrollbarOptions: { showArrows: true, trackOptions: { foregroundColor: '#7aa2f7', backgroundColor: '#292e42' } } }}>
          {loadError && (
            <box height={1} paddingLeft={2}>
              <text fg="#f7768e">Error loading providers: {loadError}</text>
            </box>
          )}
          {!loadError && filtered.length === 0 && (
            <box height={1} paddingLeft={2}>
              <text fg="#565f89">{allProviders.length === 0 ? 'Loading...' : 'No providers found'}</text>
            </box>
          )}
          {filtered.map((prov, i) => {
            const isActive = i === cursor
            return (
              <box
                key={prov.id}
                height={1}
                width="100%"
                flexDirection="row"
                backgroundColor={isActive ? '#292e42' : 'transparent'}
              >
                <text fg="#565f89" width={2}> </text>
                <text fg={isActive ? '#c0caf5' : '#565f89'} width={Math.floor((CARD_W - 10) / 2)}>{prov.name}</text>
                <text fg={isActive ? '#7aa2f7' : '#292e42'} width={Math.floor((CARD_W - 10) / 2)}>{prov.type}</text>
                <text fg="#7dcfff" width={2}>{isActive ? '›' : ' '}</text>
              </box>
            )
          })}
        </scrollbox>

        <box height={1} backgroundColor="#292e42" />

        <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text fg="#565f89">{filtered.length} providers</text>
          <text fg="#565f89">   [↑↓/PgUp/PgDn/wheel] scroll</text>
        </box>
      </box>
    </box>
  )
}
