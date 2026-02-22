import { useKeyboard } from '@opentui/react'
import { useNavigate } from '../context/AppContext.tsx'
import { MenuList } from '../components/MenuList.tsx'

const ITEMS = [
  { label: 'Add Verified Provider' },
  { label: 'Add Custom Provider' },
  { label: 'Add Models to Provider' },
  { label: 'List Providers' },
  { label: 'Back' },
]

export function ModelMenuScreen() {
  const navigate = useNavigate()

  useKeyboard((key) => {
    if (key.name === 'escape' || key.name === 'q') {
      navigate('main-menu')
    }
  })

  function handleSelect(index: number) {
    if (index === 0) navigate('add-verified')
    else if (index === 1) navigate('add-custom')
    else if (index === 2) navigate('add-models')
    else if (index === 3) navigate('list-providers')
    else if (index === 4) navigate('main-menu')
  }

  return (
    <box flexDirection="column" flexGrow={1} padding={1}>
      <text fg="#7aa2f7">Model Management</text>
      <box marginTop={1}>
        <MenuList items={ITEMS} onSelect={handleSelect} />
      </box>
    </box>
  )
}
