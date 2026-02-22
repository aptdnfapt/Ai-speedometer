interface FooterProps {
  hints: string[]
}

export function Footer({ hints }: FooterProps) {
  const joined = hints.join('  ·  ')
  return (
    <box height={1} flexDirection="row" alignItems="center" paddingLeft={1} paddingRight={1} backgroundColor="#16161e">
      <text fg="#565f89">{joined}</text>
    </box>
  )
}
