import { describe, test, expect } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { AppProvider } from '../../tui/context/AppContext.tsx'
import { AddCustomScreen } from '../../tui/screens/AddCustomScreen.tsx'

function Wrapped() {
  return (
    <AppProvider>
      <AddCustomScreen />
    </AppProvider>
  )
}

describe('AddCustomScreen', () => {
  test('renders type selection on first step', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 30 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('OpenAI Compatible')
  })

  test('shows step progress indicator', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 30 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('①')
  })

  test('shows Anthropic option', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 30 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('Anthropic')
  })

  test('snapshot: AddCustomScreen initial state', async () => {
    const s = await testRender(<Wrapped />, { width: 80, height: 30 })
    await s.renderOnce()
    expect(s.captureCharFrame()).toMatchSnapshot()
    s.renderer.destroy()
  })
})
