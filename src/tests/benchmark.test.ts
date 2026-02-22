import { describe, test, expect, mock, beforeEach } from 'bun:test'
import { mockModel } from './setup.ts'

function makeStreamBody(lines: string[]): ReadableStream {
  const encoded = lines.map(l => new TextEncoder().encode(l + '\n'))
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i < encoded.length) {
        controller.enqueue(encoded[i++])
      } else {
        controller.close()
      }
    }
  })
}

function makeOpenAIChunk(content: string, usage?: { prompt_tokens: number; completion_tokens: number }) {
  const chunk: Record<string, unknown> = {
    choices: [{ delta: { content } }],
  }
  if (usage) chunk.usage = usage
  return `data: ${JSON.stringify(chunk)}`
}

function makeFetchResponse(lines: string[], ok = true, status = 200) {
  const body = makeStreamBody(lines)
  return Promise.resolve({
    ok,
    status,
    statusText: ok ? 'OK' : 'Unauthorized',
    body,
    text: () => Promise.resolve('error body'),
  })
}

describe('benchmarkSingleModelRest', () => {
  beforeEach(() => {
    mock.restore()
  })

  test('returns success result with correct shape', async () => {
    const lines = [
      makeOpenAIChunk('Hello'),
      makeOpenAIChunk(' world', { prompt_tokens: 10, completion_tokens: 2 }),
      'data: [DONE]',
    ]
    global.fetch = mock(() => makeFetchResponse(lines)) as unknown as typeof fetch

    const { benchmarkSingleModelRest } = await import('../../src/benchmark.ts')
    const result = await benchmarkSingleModelRest(mockModel())

    expect(result.success).toBe(true)
    expect(result.model).toBe('GPT-4')
    expect(result.provider).toBe('OpenAI')
    expect(result.totalTime).toBeGreaterThanOrEqual(0)
    expect(result.tokenCount).toBeGreaterThan(0)
    expect(result.tokensPerSecond).toBeGreaterThanOrEqual(0)
    expect(result.promptTokens).toBe(10)
    expect(result.usedEstimateForOutput).toBe(false)
    expect(result.usedEstimateForInput).toBe(false)
  })

  test('returns error result on network failure', async () => {
    global.fetch = mock(() => Promise.reject(new Error('Network timeout'))) as unknown as typeof fetch

    const { benchmarkSingleModelRest } = await import('../../src/benchmark.ts')
    const result = await benchmarkSingleModelRest(mockModel())

    expect(result.success).toBe(false)
    expect(result.error).toContain('Network timeout')
    expect(result.totalTime).toBe(0)
    expect(result.tokensPerSecond).toBe(0)
  })

  test('returns error when API responds with non-ok status', async () => {
    global.fetch = mock(() => makeFetchResponse([], false, 401)) as unknown as typeof fetch

    const { benchmarkSingleModelRest } = await import('../../src/benchmark.ts')
    const result = await benchmarkSingleModelRest(mockModel())

    expect(result.success).toBe(false)
    expect(result.error).toContain('401')
  })

  test('returns error when API key is missing', async () => {
    const { benchmarkSingleModelRest } = await import('../../src/benchmark.ts')
    const result = await benchmarkSingleModelRest(mockModel({ providerConfig: { baseUrl: 'https://api.openai.com/v1', apiKey: '' } }))

    expect(result.success).toBe(false)
    expect(result.error).toContain('Missing API key')
  })

  test('returns error when baseUrl is missing', async () => {
    const { benchmarkSingleModelRest } = await import('../../src/benchmark.ts')
    const result = await benchmarkSingleModelRest(mockModel({ providerConfig: { baseUrl: '', apiKey: 'sk-test' } }))

    expect(result.success).toBe(false)
    expect(result.error).toContain('Missing base URL')
  })

  test('handles anthropic provider type - uses x-api-key header', async () => {
    const capturedHeaders: Record<string, string>[] = []
    const lines = [
      'data: ' + JSON.stringify({ type: 'message_start', message: { usage: { input_tokens: 15 } } }),
      'data: ' + JSON.stringify({ type: 'content_block_delta', delta: { text: 'Hello' } }),
      'data: ' + JSON.stringify({ type: 'message_delta', usage: { output_tokens: 5 } }),
    ]
    global.fetch = mock((url: string, opts: RequestInit) => {
      capturedHeaders.push(opts.headers as Record<string, string>)
      return makeFetchResponse(lines)
    }) as unknown as typeof fetch

    const { benchmarkSingleModelRest } = await import('../../src/benchmark.ts')
    const result = await benchmarkSingleModelRest(mockModel({ providerType: 'anthropic' }))

    expect(result.success).toBe(true)
    expect(capturedHeaders[0]?.['x-api-key']).toBe('sk-test')
    expect(capturedHeaders[0]?.['anthropic-version']).toBe('2023-06-01')
    expect(result.promptTokens).toBe(15)
    expect(result.usedEstimateForOutput).toBe(false)
  })

  test('handles google provider type - uses x-goog-api-key header', async () => {
    const capturedHeaders: Record<string, string>[] = []
    const lines = [
      JSON.stringify({
        candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
        usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 3 }
      }),
    ]
    global.fetch = mock((url: string, opts: RequestInit) => {
      capturedHeaders.push(opts.headers as Record<string, string>)
      return makeFetchResponse(lines)
    }) as unknown as typeof fetch

    const { benchmarkSingleModelRest } = await import('../../src/benchmark.ts')
    const result = await benchmarkSingleModelRest(
      mockModel({ providerType: 'google', providerConfig: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: 'gkey-test' } })
    )

    expect(result.success).toBe(true)
    expect(capturedHeaders[0]?.['x-goog-api-key']).toBe('gkey-test')
    expect(capturedHeaders[0]?.['Authorization']).toBeUndefined()
    expect(result.promptTokens).toBe(8)
  })

  test('sets usedEstimateForOutput=true when no usage metadata', async () => {
    const lines = [
      makeOpenAIChunk('word'),
      'data: [DONE]',
    ]
    global.fetch = mock(() => makeFetchResponse(lines)) as unknown as typeof fetch

    const { benchmarkSingleModelRest } = await import('../../src/benchmark.ts')
    const result = await benchmarkSingleModelRest(mockModel())

    expect(result.success).toBe(true)
    expect(result.usedEstimateForOutput).toBe(true)
    expect(result.usedEstimateForInput).toBe(true)
    expect(result.tokenCount).toBeGreaterThan(0)
  })

  test('calculates tokensPerSecond correctly', async () => {
    const lines = [
      makeOpenAIChunk('token', { prompt_tokens: 5, completion_tokens: 100 }),
      'data: [DONE]',
    ]
    global.fetch = mock(() => makeFetchResponse(lines)) as unknown as typeof fetch

    const { benchmarkSingleModelRest } = await import('../../src/benchmark.ts')
    const result = await benchmarkSingleModelRest(mockModel())

    expect(result.success).toBe(true)
    expect(result.tokenCount).toBe(100)
    expect(result.promptTokens).toBe(5)
    if (result.totalTime > 0) {
      const expectedTps = (result.tokenCount / result.totalTime) * 1000
      expect(Math.abs(result.tokensPerSecond - expectedTps)).toBeLessThan(0.01)
    } else {
      expect(result.tokensPerSecond).toBe(0)
    }
  })
})
