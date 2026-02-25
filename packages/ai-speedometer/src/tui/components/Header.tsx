import pkg from '../../../package.json'
import type { Screen } from '../context/AppContext.tsx'

interface HeaderProps {
  screen: Screen
}

export function Header({ screen }: HeaderProps) {
  if (screen === 'main-menu') return null
  return (
    <box height={1} flexDirection="row" alignItems="center" paddingLeft={2} backgroundColor="#16161e">
      <text fg="#7aa2f7">AI-SPEEDOMETER</text>
      <text fg="#292e42">  ·  </text>
      <text fg="#565f89">v{pkg.version}</text>
    </box>
  )
}
