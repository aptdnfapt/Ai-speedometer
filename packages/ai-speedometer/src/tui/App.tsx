import { useKeyboard, useRenderer } from '@opentui/react'
import { AppProvider, useAppContext, type Screen } from './context/AppContext.tsx'
import { ThemeProvider, useTheme } from './theme/ThemeContext.tsx'
import { ModalProvider, useModal } from './context/ModalContext.tsx'
import { ThemePicker } from './components/ThemePicker.tsx'
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
import { FAQScreen } from './screens/FAQScreen.tsx'

function getHints(screen: Screen, benchResults: import('./context/AppContext.tsx').AppState['benchResults']): string[] {
  switch (screen) {
    case 'main-menu':
      return ['[↑↓] navigate', '[Enter] select', '[T] theme', '[Ctrl+C] quit']
    case 'model-menu':
      return ['[↑↓] navigate', '[Enter] select', '[Q] back']
    case 'model-select':
      return ['[↑↓] navigate', '[Tab] select', '[Enter] run', '[A] all', '[N] none', '[R] recent', '[Esc] back']
    case 'benchmark': {
      const allDone = benchResults.length > 0 && benchResults.every(r => r.status === 'done' || r.status === 'error')
      return allDone ? ['[R] rerun', '[Enter] back to menu', '[Q] back to menu'] : ['Benchmark in progress...']
    }
    case 'list-providers':
      return ['[↑↓] scroll', '[Q] back']
    case 'faq':
      return ['[↑↓] scroll', '[Q] back']
    case 'add-verified':
      return ['[↑↓] navigate', '[Enter] select', '[Q] back']
    case 'add-custom':
      return ['[↑↓] navigate', '[Enter] confirm', '[Esc] back']
    case 'add-models':
      return ['[↑↓] navigate', '[Enter] add / finish', '[Esc] back']
    default:
      return ['[Q] back']
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
    case 'faq':            return <FAQScreen />
  }
}

function Shell() {
  const renderer = useRenderer()
  const { state } = useAppContext()
  const theme = useTheme()
  const { modalOpen, setModalOpen } = useModal()

  useKeyboard((key) => {
    if (key.ctrl && key.name === 'c') { renderer.destroy(); return }
    if (!key.ctrl && !key.meta && key.sequence === 'T') {
      setModalOpen(!modalOpen)
    }
  })

  return (
    <box flexDirection="column" height="100%" width="100%" backgroundColor={theme.background}>
      <Header screen={state.screen} />
      <box flexGrow={1} flexDirection="column">
        <ActiveScreen />
      </box>
      <Footer hints={getHints(state.screen, state.benchResults)} />
      {modalOpen && <ThemePicker onClose={() => setModalOpen(false)} />}
    </box>
  )
}

export function App({ logMode = false, theme = 'tokyonight' }: { logMode?: boolean; theme?: string }) {
  return (
    <ThemeProvider name={theme}>
      <ModalProvider>
        <AppProvider logMode={logMode}>
          <Shell />
        </AppProvider>
      </ModalProvider>
    </ThemeProvider>
  )
}
