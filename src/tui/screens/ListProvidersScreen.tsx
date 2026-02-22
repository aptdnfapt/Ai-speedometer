import { useKeyboard } from '@opentui/react'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'

export function ListProvidersScreen() {
  const { state } = useAppContext()
  const navigate = useNavigate()

  useKeyboard((key) => {
    if (key.name === 'escape' || key.name === 'q') {
      navigate('model-menu')
    }
  })

  if (state.isLoadingConfig) {
    return (
      <box flexDirection="column" flexGrow={1} padding={1}>
        <text>Loading providers...</text>
      </box>
    )
  }

  const providers = state.config?.providers ?? []

  if (providers.length === 0) {
    return (
      <box flexDirection="column" flexGrow={1} padding={1}>
        <text fg="#FF00FF">Configured Providers</text>
        <box marginTop={1}>
          <text fg="yellow">No providers configured yet.</text>
        </box>
      </box>
    )
  }

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text fg="#FF00FF">Configured Providers</text>
      <box marginTop={1} flexGrow={1}>
        <scrollbox focused>
          {providers.map((provider, i) => (
            <box key={i} flexDirection="column" border borderStyle="single" borderColor="#444444" marginBottom={1} padding={1}>
              <box flexDirection="row">
                <text fg="#00FFFF">{provider.name}</text>
                <text fg="#555555">  [{provider.type}]</text>
              </box>
              {provider.models.map((model, j) => (
                <text key={j} fg="#888888">  · {model.name || model.id}</text>
              ))}
            </box>
          ))}
        </scrollbox>
      </box>
    </box>
  )
}
