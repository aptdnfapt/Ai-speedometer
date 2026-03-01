import { useState, useEffect, useRef } from 'react'
import { useTerminalDimensions } from '@opentui/react'
import { useAppKeyboard as useKeyboard } from '../hooks/useAppKeyboard.ts'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'
import { useTheme } from '../theme/ThemeContext.tsx'
import { usePaste } from '../hooks/usePaste.ts'
import type { ProviderInfo } from '@ai-speedometer/core/models-dev'

type Step = 'browse' | 'confirm'

export function AddVerifiedScreen() {
  const { dispatch } = useAppContext()
  const navigate = useNavigate()
  const theme = useTheme()
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
      const { addVerifiedProvider } = await import('@ai-speedometer/core/ai-config')
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
      if (key.name === 'up') { setCursor(c => Math.max(0, c - 1)); return }
      if (key.name === 'down') { setCursor(c => Math.min(filtered.length - 1, c + 1)); return }
      if (key.name === 'pageup') { setCursor(c => Math.max(0, c - PAGE_SIZE)); return }
      if (key.name === 'pagedown') { setCursor(c => Math.min(filtered.length - 1, c + PAGE_SIZE)); return }
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
      if (key.name === 'backspace' || key.name === 'delete') { setSearchQuery(q => q.slice(0, -1)); return }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
        setSearchQuery(q => q + key.sequence)
      }
      return
    }

    if (step === 'confirm') {
      if (saveSuccess) {
        if (key.name === 'return' || key.name === 'enter') navigate('model-menu')
        return
      }
      if (saving) return
      if (key.name === 'escape') { setStep('browse'); return }
      if (key.name === 'return' || key.name === 'enter') { save(); return }
      if (key.name === 'backspace' || key.name === 'delete') { setApiKey(k => k.slice(0, -1)); return }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
        setApiKey(k => k + key.sequence)
      }
    }
  })

  if (step === 'confirm' && selectedProvider) {
    return (
      <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
        <box flexDirection="column" border borderStyle="rounded" borderColor={theme.border} backgroundColor={theme.background} width={CARD_W}>
          <box height={1} paddingLeft={2} paddingTop={1}>
            <text fg={theme.accent}>Add Verified Provider</text>
          </box>
          <box height={1} backgroundColor={theme.border} />

          <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
            <box height={1} flexDirection="row">
              <text fg={theme.primary}>Provider: </text>
              <text fg={theme.text}>{selectedProvider.name}</text>
            </box>
            <box height={1} flexDirection="row">
              <text fg={theme.dim}>Type:     </text>
              <text fg={theme.dim}>{selectedProvider.type}</text>
            </box>
            <box height={1} flexDirection="row">
              <text fg={theme.dim}>URL:      </text>
              <text fg={theme.dim}>{selectedProvider.baseUrl}</text>
            </box>
            <box height={1} flexDirection="row">
              <text fg={theme.dim}>Models:   </text>
              <text fg={theme.dim}>{selectedProvider.models.length} available</text>
            </box>
          </box>

          <box height={1} backgroundColor={theme.border} />

          {saveSuccess ? (
            <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
              <box height={1}><text fg={theme.success}>Provider added!  {selectedProvider.models.length} models available</text></box>
              <box height={1}><text fg={theme.dim}>Press [Enter] to return</text></box>
            </box>
          ) : (
            <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
              <box height={1} flexDirection="row">
                <text fg={theme.accent}>API Key: </text>
                <text fg={theme.text}>{apiKey}_</text>
              </box>
              {saveError ? (
                <box height={1}><text fg={theme.error}>Error: {saveError}</text></box>
              ) : null}
              {saving ? (
                <box height={1}><text fg={theme.warning}>Saving...</text></box>
              ) : (
                <box height={1}><text fg={theme.dim}>[Enter] save   [Esc] back to list</text></box>
              )}
            </box>
          )}
        </box>
      </box>
    )
  }

  return (
    <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <box flexDirection="column" border borderStyle="rounded" borderColor={theme.border} backgroundColor={theme.background} width={CARD_W}>
        <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text fg={theme.accent}>Search: </text>
          <text fg={theme.text}>{searchQuery}_</text>
        </box>

        <box height={1} backgroundColor={theme.border} />

        <scrollbox ref={scrollboxRef} height={PAGE_SIZE} style={{ scrollbarOptions: { showArrows: true, trackOptions: { foregroundColor: theme.primary, backgroundColor: theme.border } } }}>
          {loadError && (
            <box height={1} paddingLeft={2}><text fg={theme.error}>Error loading providers: {loadError}</text></box>
          )}
          {!loadError && filtered.length === 0 && (
            <box height={1} paddingLeft={2}><text fg={theme.dim}>{allProviders.length === 0 ? 'Loading...' : 'No providers found'}</text></box>
          )}
          {filtered.map((prov, i) => {
            const isActive = i === cursor
            return (
              <box key={prov.id} height={1} width="100%" flexDirection="row" backgroundColor={isActive ? theme.border : 'transparent'}>
                <text fg={theme.dim} width={2}> </text>
                <text fg={isActive ? theme.text : theme.dim} width={Math.floor((CARD_W - 10) / 2)}>{prov.name}</text>
                <text fg={isActive ? theme.primary : theme.border} width={Math.floor((CARD_W - 10) / 2)}>{prov.type}</text>
                <text fg={theme.accent} width={2}>{isActive ? '›' : ' '}</text>
              </box>
            )
          })}
        </scrollbox>

        <box height={1} backgroundColor={theme.border} />

        <box flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          <text fg={theme.dim}>{filtered.length} providers</text>
          <text fg={theme.dim}>   [↑↓/PgUp/PgDn/wheel] scroll</text>
        </box>
      </box>
    </box>
  )
}
