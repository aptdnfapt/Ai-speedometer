import { describe, test, expect, afterEach } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { Header } from '../../tui/components/Header.tsx'

describe('Header', () => {
  test('renders AI-SPEEDOMETER text on non-main-menu screen', async () => {
    const s = await testRender(<Header screen="model-menu" />, { width: 80, height: 3 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('AI-SPEEDOMETER')
  })

  test('returns null on main-menu screen', async () => {
    const s = await testRender(<Header screen="main-menu" />, { width: 80, height: 3 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).not.toContain('AI-SPEEDOMETER')
  })

  test('snapshot: Header on benchmark screen', async () => {
    const s = await testRender(<Header screen="benchmark" />, { width: 80, height: 3 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toMatchSnapshot()
  })
})
