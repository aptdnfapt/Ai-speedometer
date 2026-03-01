import { useAppKeyboard as useKeyboard } from '../hooks/useAppKeyboard.ts'
import { useAppContext, useNavigate } from '../context/AppContext.tsx'
import { useTheme } from '../theme/ThemeContext.tsx'

export function ListProvidersScreen() {
  const { state } = useAppContext()
  const navigate = useNavigate()
  const theme = useTheme()

  useKeyboard((key) => {
    if (key.name === 'escape' || key.name === 'q') {
      navigate('model-menu')
    }
  })

  if (state.isLoadingConfig) {
    return (
      <box flexDirection="column" flexGrow={1} padding={1}>
        <text fg={theme.dim}>Loading providers...</text>
      </box>
    )
  }

  const providers = state.config?.providers ?? []

  if (providers.length === 0) {
    return (
      <box flexDirection="column" flexGrow={1} padding={1}>
        <text fg={theme.primary}>Configured Providers</text>
        <box marginTop={1}>
          <text fg={theme.warning}>No providers configured yet.</text>
        </box>
      </box>
    )
  }

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text fg={theme.primary}>Configured Providers</text>
      <box marginTop={1} flexGrow={1}>
        <scrollbox focused>
          {providers.map((provider, i) => (
            <box key={i} flexDirection="column" border borderStyle="rounded" borderColor={theme.border} backgroundColor={theme.background} marginBottom={1} padding={1}>
              <box flexDirection="row">
                <text fg={theme.accent}>{provider.name}</text>
                <text fg={theme.dim}>  [{provider.type}]</text>
              </box>
              {provider.models.map((model, j) => (
                <text key={j} fg={theme.dim}>  · {model.name || model.id}</text>
              ))}
            </box>
          ))}
        </scrollbox>
      </box>
    </box>
  )
}
