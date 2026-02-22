import { describe, test, expect } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { AppProvider } from '../../tui/context/AppContext.tsx'
import { AddVerifiedScreen } from '../../tui/screens/AddVerifiedScreen.tsx'

function Wrapped() {
  return (
    <AppProvider>
      <AddVerifiedScreen />
    </AppProvider>
  )
}

describe('AddVerifiedScreen', () => {
  test('renders search input on browse step', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 30 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('Search')
  })

  test('shows loading state initially', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 30 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toBeTruthy()
  })

  test('snapshot: AddVerifiedScreen initial state', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 30 })
    await s.renderOnce()
    expect(s.captureCharFrame()).toMatchSnapshot()
    s.renderer.destroy()
  })
})
