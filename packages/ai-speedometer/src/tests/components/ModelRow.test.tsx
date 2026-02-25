import { describe, test, expect } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { ModelRow, SPINNER_FRAMES } from '../../tui/components/ModelRow.tsx'
import { mockModel, mockBenchmarkResult } from '../setup.ts'

const W = 80
const H = 3

describe('ModelRow', () => {
  test('shows · when status=pending', async () => {
    const s = await testRender(
      <ModelRow status="pending" model={mockModel()} spinnerFrame={0} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('·')
    expect(frame).toContain('GPT-4')
  })

  test('shows spinner char when status=running', async () => {
    const s = await testRender(
      <ModelRow status="running" model={mockModel()} spinnerFrame={3} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain(SPINNER_FRAMES[3])
    expect(frame).toContain('GPT-4')
  })

  test('shows ✓ when status=done', async () => {
    const s = await testRender(
      <ModelRow status="done" model={mockModel()} spinnerFrame={0} result={mockBenchmarkResult()} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('✓')
    expect(frame).toContain('GPT-4')
  })

  test('shows ✗ when status=error', async () => {
    const s = await testRender(
      <ModelRow status="error" model={mockModel()} spinnerFrame={0} error="API error" />,
      { width: W, height: H }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('✗')
    expect(frame).toContain('API error')
  })

  test('shows tps when done', async () => {
    const s = await testRender(
      <ModelRow
        status="done"
        model={mockModel()}
        spinnerFrame={0}
        result={mockBenchmarkResult({ tokensPerSecond: 42.5 })}
      />,
      { width: W, height: H }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('42.5')
  })

  test('snapshot: ModelRow pending', async () => {
    const s = await testRender(
      <ModelRow status="pending" model={mockModel()} spinnerFrame={0} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    expect(s.captureCharFrame()).toMatchSnapshot()
    s.renderer.destroy()
  })

  test('snapshot: ModelRow running frame=3', async () => {
    const s = await testRender(
      <ModelRow status="running" model={mockModel()} spinnerFrame={3} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    expect(s.captureCharFrame()).toMatchSnapshot()
    s.renderer.destroy()
  })

  test('snapshot: ModelRow done', async () => {
    const s = await testRender(
      <ModelRow status="done" model={mockModel()} spinnerFrame={0} result={mockBenchmarkResult()} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    expect(s.captureCharFrame()).toMatchSnapshot()
    s.renderer.destroy()
  })

  test('snapshot: ModelRow error', async () => {
    const s = await testRender(
      <ModelRow status="error" model={mockModel()} spinnerFrame={0} error="timeout" />,
      { width: W, height: H }
    )
    await s.renderOnce()
    expect(s.captureCharFrame()).toMatchSnapshot()
    s.renderer.destroy()
  })
})
