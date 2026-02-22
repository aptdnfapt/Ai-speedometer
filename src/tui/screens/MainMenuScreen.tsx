import { useRenderer } from '@opentui/react'
import { useNavigate } from '../context/AppContext.tsx'
import { MenuList } from '../components/MenuList.tsx'

const ITEMS = [
  { label: 'Run Benchmark' },
  { label: 'Set Model' },
  { label: 'Exit' },
]

export function MainMenuScreen() {
  const navigate = useNavigate()
  const renderer = useRenderer()

  function handleSelect(index: number) {
    if (index === 0) navigate('model-select')
    else if (index === 1) navigate('model-menu')
    else if (index === 2) renderer.destroy()
  }

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text fg="#FF00FF">Main Menu</text>
      <box marginTop={1}>
        <MenuList items={ITEMS} onSelect={handleSelect} />
      </box>
    </box>
  )
}
