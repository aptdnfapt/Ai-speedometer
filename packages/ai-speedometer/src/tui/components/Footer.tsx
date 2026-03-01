import { useTheme } from '../theme/ThemeContext.tsx'

interface FooterProps {
  hints: string[]
}

export function Footer({ hints }: FooterProps) {
  const theme = useTheme()
  const joined = hints.join('  ·  ')
  return (
    <box height={1} flexDirection="row" alignItems="center" paddingLeft={1} paddingRight={1} backgroundColor={theme.background}>
      <text fg={theme.dim}>{joined}</text>
    </box>
  )
}
