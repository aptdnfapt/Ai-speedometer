import { useState, useEffect } from 'react'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'
import type { Provider } from '../../types.ts'

type Step = 'pick' | 'add'

export function AddModelsScreen() {
  const { dispatch } = useAppContext()
  const navigate = useNavigate()
  const { width } = useTerminalDimensions()

  const CARD_W = Math.min(60, width - 4)

  const [step, setStep] = useState<Step>('pick')
  const [providers, setProviders] = useState<Provider[]>([])
  const [cursor, setCursor] = useState(0)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [modelInput, setModelInput] = useState('')
  const [addedModels, setAddedModels] = useState<string[]>([])
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [inputError, setInputError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const { getCustomProvidersFromConfig } = await import('../../ai-config.ts')
        const provs = await getCustomProvidersFromConfig()
        setProviders(provs)
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : String(e))
      }
    }
    load()
  }, [])

  useKeyboard((key) => {
    if (done) {
      if (key.name === 'return' || key.name === 'enter') navigate('model-menu')
      return
    }

    if (step === 'pick') {
      if (key.name === 'escape' || key.sequence === 'q' || key.sequence === 'Q') {
        navigate('model-menu')
        return
      }
      if (key.name === 'up') { setCursor(c => Math.max(0, c - 1)); return }
      if (key.name === 'down') { setCursor(c => Math.min(providers.length - 1, c + 1)); return }
      if (key.name === 'return' || key.name === 'enter') {
        const prov = providers[cursor]
        if (prov) {
          setSelectedProvider(prov)
          setModelInput('')
          setAddedModels([])
          setSaveError('')
          setInputError('')
          setStep('add')
        }
        return
      }
    }

    if (step === 'add') {
      if (key.name === 'escape') {
        setStep('pick')
        return
      }
      if (key.name === 'return' || key.name === 'enter') {
        if (modelInput.trim()) {
          addModel()
        } else {
          if (addedModels.length === 0) { setInputError('Add at least one model'); return }
          finishAdding()
        }
        return
      }
      if (key.name === 'backspace' || key.name === 'delete') {
        setModelInput(v => v.slice(0, -1))
        return
      }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
        setModelInput(v => v + key.sequence)
      }
    }
  })

  async function addModel() {
    if (!selectedProvider || !modelInput.trim()) return
    setInputError('')
    setSaveError('')
    const name = modelInput.trim()
    try {
      const { addModelToCustomProvider } = await import('../../ai-config.ts')
      await addModelToCustomProvider(selectedProvider.id, {
        id: name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        name,
      })
      setAddedModels(ms => [...ms, name])
      setModelInput('')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
  }

  async function finishAdding() {
    const { getAllAvailableProviders } = await import('../../opencode-integration.ts')
    const provs = await getAllAvailableProviders(false)
    dispatch({ type: 'SET_CONFIG', config: { providers: provs } })
    setDone(true)
  }

  if (done) {
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
          <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
            <box height={1}>
              <text fg="#9ece6a">Done! Added {addedModels.length} model{addedModels.length !== 1 ? 's' : ''} to {selectedProvider?.name}.</text>
            </box>
            <box height={1}>
              <text fg="#565f89">Press [Enter] to return</text>
            </box>
          </box>
        </box>
      </box>
    )
  }

  if (step === 'add' && selectedProvider) {
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
          <box height={1} paddingLeft={2} paddingTop={1} flexDirection="row">
            <text fg="#7dcfff">Add Models to: </text>
            <text fg="#c0caf5">{selectedProvider.name}</text>
          </box>
          <box height={1} backgroundColor="#292e42" />

          <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
            {(selectedProvider.models.length > 0 || addedModels.length > 0) && (
              <box flexDirection="column">
                <box height={1}>
                  <text fg="#7aa2f7">Current models:</text>
                </box>
                {selectedProvider.models.map(m => (
                  <box key={m.id} height={1}>
                    <text fg="#565f89">  · {m.name || m.id}</text>
                  </box>
                ))}
                {addedModels.map(m => (
                  <box key={m} height={1}>
                    <text fg="#9ece6a">  · {m} (new)</text>
                  </box>
                ))}
              </box>
            )}
            <box height={1} flexDirection="row">
              <text fg="#7aa2f7">Model name: </text>
              <text fg="#c0caf5">{modelInput}_</text>
            </box>
            {addedModels.length > 0 && (
              <box height={1}>
                <text fg="#9ece6a">Added {addedModels.length} model{addedModels.length !== 1 ? 's' : ''} so far</text>
              </box>
            )}
            {saveError && (
              <box height={1}>
                <text fg="#f7768e">Error: {saveError}</text>
              </box>
            )}
            {inputError && (
              <box height={1}>
                <text fg="#f7768e">{inputError}</text>
              </box>
            )}
          </box>
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
        <box height={1} paddingLeft={2} paddingTop={1}>
          <text fg="#7dcfff">Add Models to Provider</text>
        </box>
        <box height={1} backgroundColor="#292e42" />

        <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
          {loadError && (
            <box height={1}>
              <text fg="#f7768e">Error: {loadError}</text>
            </box>
          )}
          {!loadError && providers.length === 0 && (
            <box height={1}>
              <text fg="#ff9e64">No custom providers yet. Add one first.</text>
            </box>
          )}
          {providers.map((prov, i) => {
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
                <text fg={isActive ? '#c0caf5' : '#565f89'} width={Math.floor((CARD_W - 8) * 0.6)}>{prov.name}</text>
                <text fg={isActive ? '#7aa2f7' : '#292e42'} width={Math.floor((CARD_W - 8) * 0.3)}>{prov.models.length} models</text>
                <text fg="#7dcfff" width={2}>{isActive ? '›' : ' '}</text>
              </box>
            )
          })}
        </box>
      </box>
    </box>
  )
}
