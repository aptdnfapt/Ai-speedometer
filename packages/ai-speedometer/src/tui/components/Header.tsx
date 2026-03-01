import pkg from '../../../package.json'
import type { Screen } from '../context/AppContext.tsx'
import { useTheme } from '../theme/ThemeContext.tsx'

interface HeaderProps {
  screen: Screen
}

export function Header({ screen }: HeaderProps) {
  const theme = useTheme()
  if (screen === 'main-menu') return null
  return (
    <box height={1} flexDirection="row" alignItems="center" paddingLeft={2} backgroundColor={theme.background}>
      <text fg={theme.primary}>AI-SPEEDOMETER</text>
      <text fg={theme.border}>  ·  </text>
      <text fg={theme.dim}>v{pkg.version}</text>
    </box>
  )
}
