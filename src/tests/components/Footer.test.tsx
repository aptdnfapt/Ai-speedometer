import { describe, test, expect } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { Footer } from '../../tui/components/Footer.tsx'

describe('Footer', () => {
  test('renders all hint strings', async () => {
    const hints = ['[↑↓] navigate', '[Enter] select', '[Ctrl+C] quit']
    const s = await testRender(<Footer hints={hints} />, { width: 120, height: 3 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    for (const hint of hints) {
      expect(frame).toContain(hint)
    }
  })

  test('renders separator between hints', async () => {
    const s = await testRender(<Footer hints={['A', 'B']} />, { width: 40, height: 3 })
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('·')
  })

  test('snapshot: Footer with 3 hints', async () => {
    const s = await testRender(
      <Footer hints={['[↑↓] navigate', '[Enter] select', '[Ctrl+C] quit']} />,
      { width: 120, height: 3 }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toMatchSnapshot()
  })
})
