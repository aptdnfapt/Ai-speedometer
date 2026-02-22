import { describe, test, expect } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { AppProvider } from '../../tui/context/AppContext.tsx'
import { ModelSelectScreen } from '../../tui/screens/ModelSelectScreen.tsx'

function Wrapped() {
  return (
    <AppProvider>
      <ModelSelectScreen />
    </AppProvider>
  )
}

describe('ModelSelectScreen', () => {
  test('renders search input', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 30 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('Search')
  })

  test('snapshot: ModelSelectScreen initial state', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 30 })
    await s.renderOnce()
    expect(s.captureCharFrame()).toMatchSnapshot()
    s.renderer.destroy()
  })
})
