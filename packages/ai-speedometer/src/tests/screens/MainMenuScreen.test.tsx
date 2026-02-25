import { describe, test, expect } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { AppProvider } from '../../tui/context/AppContext.tsx'
import { MainMenuScreen } from '../../tui/screens/MainMenuScreen.tsx'

function Wrapped() {
  return (
    <AppProvider>
      <MainMenuScreen />
    </AppProvider>
  )
}

describe('MainMenuScreen', () => {
  test('renders 3 menu items', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 24 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('Run Benchmark')
    expect(frame).toContain('Manage Models')
    expect(frame).toContain('Exit')
  })

  test('first item shows › arrow', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 24 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('›')
  })

  test('snapshot: MainMenuScreen initial state', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 24 })
    await s.renderOnce()
    expect(s.captureCharFrame()).toMatchSnapshot()
    s.renderer.destroy()
  })
})
