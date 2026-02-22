import pkg from '../../../package.json'

export function Header() {
  return (
    <box flexDirection="column" alignItems="center" justifyContent="center" width="100%" height={4} backgroundColor="#16161e">
      <box flexDirection="row" alignItems="center">
        <ascii-font text="AI-SPEEDOMETER" font="tiny" color="#7aa2f7" />
        <box marginLeft={2}>
          <text fg="#565f89">v{pkg.version}</text>
        </box>
      </box>
    </box>
  )
}
