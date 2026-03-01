import { useState } from 'react'
import { useRenderer } from '@opentui/react'
import { useAppKeyboard as useKeyboard } from '../hooks/useAppKeyboard.ts'
import { useNavigate } from '../context/AppContext.tsx'
import { useTheme } from '../theme/ThemeContext.tsx'
import pkg from '../../../package.json'

export function MainMenuScreen() {
  const navigate = useNavigate()
  const renderer = useRenderer()
  const theme = useTheme()
  const [cursor, setCursor] = useState(0)

  const ITEMS = [
    { label: '⚡ Run Benchmark',  desc: 'test model speed & throughput',  color: theme.accent },
    { label: '⚙  Manage Models',  desc: 'add providers and configure',     color: theme.secondary },
    { label: '✕  Exit',           desc: 'quit the application',            color: theme.error },
  ]

  useKeyboard((key) => {
    if (key.name === 'up') {
      setCursor(i => (i - 1 + ITEMS.length) % ITEMS.length)
    } else if (key.name === 'down') {
      setCursor(i => (i + 1) % ITEMS.length)
    } else if (key.name === 'enter' || key.name === 'return') {
      if (cursor === 0) navigate('model-select')
      else if (cursor === 1) navigate('model-menu')
      else if (cursor === 2) renderer.destroy()
    }
  })

  return (
    <box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
      <box flexDirection="column" alignItems="center" marginBottom={2}>
        <ascii-font text="AI-SPEEDOMETER" font="tiny" color={theme.primary} />
        <text fg={theme.dim}>v{pkg.version}</text>
      </box>
      <box
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor={theme.border}
        backgroundColor={theme.background}
        width={46}
      >
        {ITEMS.map((item, i) => {
          const active = i === cursor
          return (
            <box
              key={i}
              flexDirection="row"
              alignItems="center"
              backgroundColor={active ? theme.border : 'transparent'}
              paddingLeft={2}
              paddingRight={2}
              paddingTop={1}
              paddingBottom={1}
            >
              <box flexDirection="column" flexGrow={1}>
                <text fg={active ? item.color : theme.dim}>
                  {item.label}
                </text>
                <text fg={active ? theme.dim : theme.border}>
                  {item.desc}
                </text>
              </box>
              {active && <text fg={item.color}>›</text>}
            </box>
          )
        })}
      </box>
    </box>
  )
}
