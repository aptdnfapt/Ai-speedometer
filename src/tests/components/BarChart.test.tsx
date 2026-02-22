import { describe, test, expect } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { BarChart } from '../../tui/components/BarChart.tsx'

describe('BarChart', () => {
  test('renders full bar when value equals max', async () => {
    const s = await testRender(
      <BarChart value={10} max={10} width={10} color="#9ece6a" />,
      { width: 20, height: 3 }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('██████████')
    expect(frame).not.toContain('░')
  })

  test('renders empty bar when value is 0', async () => {
    const s = await testRender(
      <BarChart value={0} max={10} width={10} color="#9ece6a" />,
      { width: 20, height: 3 }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('░░░░░░░░░░')
    expect(frame).not.toContain('█')
  })

  test('renders half bar at 50%', async () => {
    const s = await testRender(
      <BarChart value={5} max={10} width={10} color="#9ece6a" />,
      { width: 20, height: 3 }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('█████░░░░░')
  })

  test('handles max=0 gracefully without crash', async () => {
    const s = await testRender(
      <BarChart value={0} max={0} width={10} color="#9ece6a" />,
      { width: 20, height: 3 }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('░░░░░░░░░░')
    expect(frame).not.toContain('█')
  })

  test('snapshot: BarChart 50% width=20', async () => {
    const s = await testRender(
      <BarChart value={10} max={20} width={20} color="#7dcfff" />,
      { width: 30, height: 3 }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toMatchSnapshot()
  })
})
