import { useKeyboard, useRenderer } from '@opentui/react'
import { AppProvider, useAppContext, type Screen } from './context/AppContext.tsx'
import { Header } from './components/Header.tsx'
import { Footer } from './components/Footer.tsx'
import { MainMenuScreen } from './screens/MainMenuScreen.tsx'
import { ModelMenuScreen } from './screens/ModelMenuScreen.tsx'
import { ModelSelectScreen } from './screens/ModelSelectScreen.tsx'
import { BenchmarkScreen } from './screens/BenchmarkScreen.tsx'
import { AddVerifiedScreen } from './screens/AddVerifiedScreen.tsx'
import { AddCustomScreen } from './screens/AddCustomScreen.tsx'
import { AddModelsScreen } from './screens/AddModelsScreen.tsx'
import { ListProvidersScreen } from './screens/ListProvidersScreen.tsx'

function getHints(screen: Screen): string[] {
  switch (screen) {
    case 'main-menu':
      return ['[↑↓] navigate', '[Enter] select', '[Ctrl+C] quit']
    case 'model-menu':
      return ['[↑↓] navigate', '[Enter] select', '[q] back']
    case 'model-select':
      return ['[↑↓] navigate', '[Tab] select', '[Enter] run', '[A] all', '[N] none', '[R] recent', '[q] back']
    case 'list-providers':
      return ['[↑↓] scroll', '[q] back']
    default:
      return ['[q] back']
  }
}

function ActiveScreen() {
  const { state } = useAppContext()
  switch (state.screen) {
    case 'main-menu':      return <MainMenuScreen />
    case 'model-menu':     return <ModelMenuScreen />
    case 'model-select':   return <ModelSelectScreen />
    case 'benchmark':      return <BenchmarkScreen />
    case 'add-verified':   return <AddVerifiedScreen />
    case 'add-custom':     return <AddCustomScreen />
    case 'add-models':     return <AddModelsScreen />
    case 'list-providers': return <ListProvidersScreen />
  }
}

function Shell() {
  const renderer = useRenderer()
  const { state } = useAppContext()

  useKeyboard((key) => {
    if (key.ctrl && key.name === 'c') {
      renderer.destroy()
    }
  })

  return (
    <box flexDirection="column" height="100%" width="100%" backgroundColor="#1a1b26">
      <Header />
      <box flexGrow={1} flexDirection="column">
        <ActiveScreen />
      </box>
      <Footer hints={getHints(state.screen)} />
    </box>
  )
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
