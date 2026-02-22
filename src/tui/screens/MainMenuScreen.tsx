import { useState } from 'react'
import { useRenderer } from '@opentui/react'
import { useKeyboard } from '@opentui/react'
import { useNavigate } from '../context/AppContext.tsx'

const ITEMS = [
  { label: '⚡ Run Benchmark',  desc: 'test model speed & throughput',  color: '#7dcfff' },
  { label: '⚙  Manage Models',  desc: 'add providers and configure',     color: '#bb9af7' },
  { label: '✕  Exit',           desc: 'quit the application',            color: '#f7768e' },
]

export function MainMenuScreen() {
  const navigate = useNavigate()
  const renderer = useRenderer()
  const [cursor, setCursor] = useState(0)

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
      <box
        flexDirection="column"
        border
        borderStyle="rounded"
        borderColor="#292e42"
        backgroundColor="#16161e"
        width={46}
      >
        {ITEMS.map((item, i) => {
          const active = i === cursor
          return (
            <box
              key={i}
              flexDirection="row"
              alignItems="center"
              backgroundColor={active ? '#292e42' : 'transparent'}
              paddingLeft={2}
              paddingRight={2}
              paddingTop={1}
              paddingBottom={1}
            >
              <box flexDirection="column" flexGrow={1}>
                <text fg={active ? item.color : '#565f89'}>
                  {item.label}
                </text>
                <text fg={active ? '#565f89' : '#292e42'}>
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
