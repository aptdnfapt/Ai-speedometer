import { useState } from 'react'
import { useKeyboard, useTerminalDimensions } from '@opentui/react'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'
import { usePaste } from '../hooks/usePaste.ts'

type ProviderType = 'openai-compatible' | 'anthropic'
type Step = 'type' | 'id' | 'name' | 'url' | 'key' | 'models' | 'saving' | 'done'

const STEPS: Step[] = ['type', 'id', 'name', 'url', 'key', 'models']
const STEP_LABELS = ['Type', 'ID', 'Name', 'URL', 'Key', 'Models']

const STEP_NUM = ['①', '②', '③', '④', '⑤', '⑥']

function stepIndex(s: Step): number {
  return STEPS.indexOf(s as Step)
}

export function AddCustomScreen() {
  const { dispatch } = useAppContext()
  const navigate = useNavigate()
  const { width } = useTerminalDimensions()

  const CARD_W = Math.min(60, width - 4)

  const [step, setStep] = useState<Step>('type')
  const [providerType, setProviderType] = useState<ProviderType>('openai-compatible')
  const [typeCursor, setTypeCursor] = useState(0)
  const [providerId, setProviderId] = useState('')
  const [providerName, setProviderName] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [modelInput, setModelInput] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [saveError, setSaveError] = useState('')
  const [savedModelCount, setSavedModelCount] = useState(0)
  const [inputError, setInputError] = useState('')

  const typeItems = ['OpenAI Compatible', 'Anthropic', 'Back']

  async function doSave() {
    setStep('saving')
    setSaveError('')
    try {
      const { addCustomProvider } = await import('@ai-speedometer/core/ai-config')
      await addCustomProvider({
        id: providerId.trim(),
        name: providerName.trim(),
        type: providerType,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        models: models.map(m => ({
          id: m.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          name: m,
        })),
      })
      const { getAllAvailableProviders } = await import('@ai-speedometer/core/opencode-integration')
      const providers = await getAllAvailableProviders(false)
      dispatch({ type: 'SET_CONFIG', config: { providers } })
      setSavedModelCount(models.length)
      setStep('done')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
      setStep('models')
    }
  }

  usePaste((text) => {
    if (step === 'id')     setProviderId(v => v + text)
    else if (step === 'name')   setProviderName(v => v + text)
    else if (step === 'url')    setBaseUrl(v => v + text)
    else if (step === 'key')    setApiKey(v => v + text)
    else if (step === 'models') setModelInput(v => v + text)
  })

  useKeyboard((key) => {
    if (step === 'done') {
      if (key.name === 'return' || key.name === 'enter') navigate('model-menu')
      return
    }

    if (step === 'saving') return

    if (step === 'type') {
      if (key.name === 'escape') { navigate('model-menu'); return }
      if (key.name === 'up') { setTypeCursor(c => Math.max(0, c - 1)); return }
      if (key.name === 'down') { setTypeCursor(c => Math.min(typeItems.length - 1, c + 1)); return }
      if (key.name === 'return' || key.name === 'enter') {
        if (typeCursor === 2) { navigate('model-menu'); return }
        setProviderType(typeCursor === 1 ? 'anthropic' : 'openai-compatible')
        setStep('id')
      }
      return
    }

    if (key.name === 'escape') {
      setInputError('')
      const idx = stepIndex(step)
      if (idx <= 1) { setStep('type'); return }
      setStep(STEPS[idx - 1])
      return
    }

    if (step === 'id') {
      if (key.name === 'return' || key.name === 'enter') {
        if (!providerId.trim()) { setInputError('ID is required'); return }
        setInputError('')
        setStep('name')
        return
      }
      if (key.name === 'backspace' || key.name === 'delete') { setProviderId(v => v.slice(0, -1)); return }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
        setProviderId(v => v + key.sequence)
      }
      return
    }

    if (step === 'name') {
      if (key.name === 'return' || key.name === 'enter') {
        if (!providerName.trim()) { setInputError('Name is required'); return }
        setInputError('')
        setStep('url')
        return
      }
      if (key.name === 'backspace' || key.name === 'delete') { setProviderName(v => v.slice(0, -1)); return }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
        setProviderName(v => v + key.sequence)
      }
      return
    }

    if (step === 'url') {
      if (key.name === 'return' || key.name === 'enter') {
        if (!baseUrl.trim()) { setInputError('URL is required'); return }
        if (!baseUrl.trim().startsWith('http')) { setInputError('URL must start with http'); return }
        setInputError('')
        setStep('key')
        return
      }
      if (key.name === 'backspace' || key.name === 'delete') { setBaseUrl(v => v.slice(0, -1)); return }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
        setBaseUrl(v => v + key.sequence)
      }
      return
    }

    if (step === 'key') {
      if (key.name === 'return' || key.name === 'enter') {
        setInputError('')
        setStep('models')
        return
      }
      if (key.name === 'backspace' || key.name === 'delete') { setApiKey(v => v.slice(0, -1)); return }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
        setApiKey(v => v + key.sequence)
      }
      return
    }

    if (step === 'models') {
      if (key.name === 'return' || key.name === 'enter') {
        if (modelInput.trim()) {
          setModels(ms => [...ms, modelInput.trim()])
          setModelInput('')
          setInputError('')
        } else {
          if (models.length === 0) { setInputError('Add at least one model'); return }
          doSave()
        }
        return
      }
      if (key.name === 'backspace' || key.name === 'delete') { setModelInput(v => v.slice(0, -1)); return }
      if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
        setModelInput(v => v + key.sequence)
      }
    }
  })

  const curStepIdx = stepIndex(step)

  function ProgressBar() {
    return (
      <box height={1} paddingLeft={2} paddingRight={2} flexDirection="row">
        {STEPS.map((s, i) => (
          <box key={s} flexDirection="row">
            <text fg={i < curStepIdx ? '#9ece6a' : i === curStepIdx ? '#7dcfff' : '#292e42'}>
              {STEP_NUM[i]} {STEP_LABELS[i]}
            </text>
            {i < STEPS.length - 1 && <text fg="#292e42">  </text>}
          </box>
        ))}
      </box>
    )
  }

  if (step === 'done') {
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
              <text fg="#9ece6a">Custom provider added!  {savedModelCount} model{savedModelCount !== 1 ? 's' : ''} configured.</text>
            </box>
            <box height={1}>
              <text fg="#565f89">Press [Enter] to return</text>
            </box>
          </box>
        </box>
      </box>
    )
  }

  if (step === 'saving') {
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
          <box paddingLeft={2} paddingTop={1} paddingBottom={1}>
            <text fg="#ff9e64">⠹ Saving...</text>
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
          <text fg="#7dcfff">Add Custom Provider</text>
        </box>

        <box height={1} backgroundColor="#292e42" />

        <box paddingTop={1} paddingBottom={1}>
          <ProgressBar />
        </box>

        <box height={1} backgroundColor="#292e42" />

        <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>

          {step === 'type' && (
            <box flexDirection="column">
              {typeItems.map((item, i) => (
                <box
                  key={item}
                  height={1}
                  width="100%"
                  flexDirection="row"
                  backgroundColor={i === typeCursor ? '#292e42' : 'transparent'}
                >
                  <text fg={i === typeCursor ? '#c0caf5' : '#565f89'}> {item}</text>
                  {i === typeCursor && <text fg="#7dcfff"> ›</text>}
                </box>
              ))}
            </box>
          )}

          {step === 'id' && (
            <box flexDirection="column">
              <box height={1} flexDirection="row">
                <text fg="#7aa2f7">Provider ID: </text>
                <text fg="#c0caf5">{providerId}_</text>
              </box>
              <box height={1}>
                <text fg="#565f89">e.g. my-openai</text>
              </box>
            </box>
          )}

          {step === 'name' && (
            <box flexDirection="column">
              <box height={1} flexDirection="row">
                <text fg="#7aa2f7">Display Name: </text>
                <text fg="#c0caf5">{providerName}_</text>
              </box>
              <box height={1}>
                <text fg="#565f89">e.g. My OpenAI</text>
              </box>
            </box>
          )}

          {step === 'url' && (
            <box flexDirection="column">
              <box height={1} flexDirection="row">
                <text fg="#7aa2f7">Base URL: </text>
                <text fg="#c0caf5">{baseUrl}_</text>
              </box>
              <box height={1}>
                <text fg="#565f89">e.g. https://api.example.com/v1</text>
              </box>
            </box>
          )}

          {step === 'key' && (
            <box flexDirection="column">
              <box height={1} flexDirection="row">
                <text fg="#7aa2f7">API Key: </text>
                <text fg="#c0caf5">{apiKey}_</text>
              </box>
              <box height={1}>
                <text fg="#565f89">sk-...   (leave empty if not needed)</text>
              </box>
            </box>
          )}

          {step === 'models' && (
            <box flexDirection="column">
              {models.length > 0 && (
                <box flexDirection="column">
                  {models.map(m => (
                    <box key={m} height={1}>
                      <text fg="#565f89">  · {m}</text>
                    </box>
                  ))}
                </box>
              )}
              <box height={1} flexDirection="row">
                <text fg="#7aa2f7">Model name: </text>
                <text fg="#c0caf5">{modelInput}_</text>
              </box>
              {models.length > 0 && (
                <box height={1}>
                  <text fg="#9ece6a">  {models.length} model{models.length !== 1 ? 's' : ''} added  (empty [Enter] to finish)</text>
                </box>
              )}
              {saveError && (
                <box height={1}>
                  <text fg="#f7768e">Error: {saveError}</text>
                </box>
              )}
            </box>
          )}

          {inputError ? (
            <box height={1}>
              <text fg="#f7768e">{inputError}</text>
            </box>
          ) : null}
        </box>
      </box>
    </box>
  )
}
