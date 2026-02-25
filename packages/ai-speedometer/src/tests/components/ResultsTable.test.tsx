import { describe, test, expect } from 'bun:test'
import { testRender } from '@opentui/react/test-utils'
import { ResultsTable } from '../../tui/components/ResultsTable.tsx'
import { mockBenchmarkResult } from '../setup.ts'

const W = 120
const H = 20

describe('ResultsTable', () => {
  test('renders header row with column names', async () => {
    const s = await testRender(
      <ResultsTable results={[]} pendingCount={0} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('Model')
    expect(frame).toContain('Provider')
    expect(frame).toContain('Time(s)')
    expect(frame).toContain('Tokens/Sec')
  })

  test('renders done result with numeric data', async () => {
    const result = mockBenchmarkResult({ tokensPerSecond: 55.5, totalTime: 1500 })
    const s = await testRender(
      <ResultsTable results={[result]} pendingCount={0} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('55.5')
    expect(frame).toContain('1.50')
  })

  test('shows pending count message when pendingCount > 0', async () => {
    const s = await testRender(
      <ResultsTable results={[]} pendingCount={3} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('3')
    expect(frame).toContain('result')
  })

  test('shows [e] suffix when usedEstimateForOutput=true', async () => {
    const result = mockBenchmarkResult({ usedEstimateForOutput: true })
    const s = await testRender(
      <ResultsTable results={[result]} pendingCount={0} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    expect(frame).toContain('[e]')
  })

  test('sorts results by tokensPerSecond descending', async () => {
    const slow = mockBenchmarkResult({ model: 'slow-model', tokensPerSecond: 10 })
    const fast = mockBenchmarkResult({ model: 'fast-model', tokensPerSecond: 100 })
    const s = await testRender(
      <ResultsTable results={[slow, fast]} pendingCount={0} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    const frame = s.captureCharFrame()
    s.renderer.destroy()
    const fastIdx = frame.indexOf('fast-model')
    const slowIdx = frame.indexOf('slow-model')
    expect(fastIdx).toBeLessThan(slowIdx)
  })

  test('snapshot: ResultsTable 1 done 2 pending', async () => {
    const result = mockBenchmarkResult()
    const s = await testRender(
      <ResultsTable results={[result]} pendingCount={2} />,
      { width: W, height: H }
    )
    await s.renderOnce()
    expect(s.captureCharFrame()).toMatchSnapshot()
    s.renderer.destroy()
  })
})
