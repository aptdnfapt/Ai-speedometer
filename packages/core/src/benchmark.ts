import { TEST_PROMPT as testPrompt } from './constants.ts'
import type { Model, BenchmarkResult } from './types.ts'
import type { BenchLogger } from './logger.ts'

export async function benchmarkSingleModelRest(model: Model, logger?: BenchLogger): Promise<BenchmarkResult> {
  try {
    if (!model.providerConfig || !model.providerConfig.apiKey) {
      throw new Error(`Missing API key for provider ${model.providerName}`)
    }

    if (!model.providerConfig.baseUrl) {
      throw new Error(`Missing base URL for provider ${model.providerName}`)
    }

    let actualModelId: string
    if (model.id && model.id.includes('_')) {
      actualModelId = model.id.split('_')[1]!
    } else if (model.id) {
      actualModelId = model.id
    } else {
      actualModelId = model.name
    }
    actualModelId = actualModelId.trim()

    await logger?.logHeader(model.name, model.providerName, model.providerConfig.apiKey)

    const startTime = Date.now()
    let firstTokenTime: number | null = null
    let streamedText = ''
    let inputTokens = 0
    let outputTokens = 0

    let endpoint: string
    if (model.providerConfig.endpointFormat) {
      endpoint = '/' + model.providerConfig.endpointFormat
    } else if (model.providerType === 'anthropic') {
      endpoint = '/messages'
    } else if (model.providerType === 'google') {
      endpoint = '/models/' + actualModelId + ':streamGenerateContent'
    } else {
      endpoint = '/chat/completions'
    }

    const baseUrl = model.providerConfig.baseUrl.replace(/\/$/, '')
    const url = `${baseUrl}${endpoint}`

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.providerConfig.apiKey}`
    }

    if (model.providerType === 'anthropic') {
      headers['x-api-key'] = model.providerConfig.apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else if (model.providerType === 'google') {
      delete headers['Authorization']
      headers['x-goog-api-key'] = model.providerConfig.apiKey
    }

    const body: Record<string, unknown> = {
      model: actualModelId,
      messages: [{ role: 'user', content: testPrompt }],
      max_tokens: 500,
      temperature: 0.7,
      stream: true,
      stream_options: { include_usage: true }
    }

    if (model.providerType === 'google') {
      body['contents'] = [{ parts: [{ text: testPrompt }] }]
      body['generationConfig'] = { maxOutputTokens: 500, temperature: 0.7 }
      delete body['messages']
      delete body['max_tokens']
      delete body['stream']
      delete body['stream_options']
    } else if (model.providerType === 'anthropic') {
      delete body['stream_options']
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errBody = await response.text()
      let errDetail = ''
      try {
        const parsed = JSON.parse(errBody) as { error?: { message?: string } | string; message?: string }
        if (typeof parsed.error === 'object' && parsed.error?.message) errDetail = parsed.error.message
        else if (typeof parsed.error === 'string') errDetail = parsed.error
        else if (parsed.message) errDetail = parsed.message
        else errDetail = errBody.slice(0, 200)
      } catch { errDetail = errBody.slice(0, 200) }
      throw new Error(`${response.status} ${response.statusText}${errDetail ? ': ' + errDetail : ''}`)
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let firstParsedTokenTime: number | null = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      if (!firstTokenTime) firstTokenTime = Date.now()

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine) await logger?.logRaw(trimmedLine)
        if (!trimmedLine) continue

        try {
          if (model.providerType === 'anthropic') {
            if (trimmedLine.startsWith('data: ')) {
              const jsonStr = trimmedLine.slice(6)
              if (jsonStr === '[DONE]') continue
              const chunk = JSON.parse(jsonStr) as Record<string, unknown>
              const chunkTyped = chunk as {
                type?: string
                delta?: { text?: string }
                message?: { usage?: { input_tokens?: number } }
                usage?: { output_tokens?: number; input_tokens?: number }
              }
              if (chunkTyped.type === 'content_block_delta' && chunkTyped.delta?.text) {
                if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
                streamedText += chunkTyped.delta.text
              } else if (chunkTyped.type === 'message_start' && chunkTyped.message?.usage) {
                inputTokens = chunkTyped.message.usage.input_tokens || 0
              } else if (chunkTyped.type === 'message_delta') {
                if (chunkTyped.usage?.output_tokens) outputTokens = chunkTyped.usage.output_tokens
                if (chunkTyped.usage?.input_tokens && !inputTokens) inputTokens = chunkTyped.usage.input_tokens
              }
            } else if (trimmedLine.startsWith('event: ')) {
              continue
            } else {
              const chunk = JSON.parse(trimmedLine) as {
                type?: string
                delta?: { text?: string }
                message?: { usage?: { input_tokens?: number } }
                usage?: { output_tokens?: number; input_tokens?: number }
              }
              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
                streamedText += chunk.delta.text
              } else if (chunk.type === 'message_start' && chunk.message?.usage) {
                inputTokens = chunk.message.usage.input_tokens || 0
              } else if (chunk.type === 'message_delta') {
                if (chunk.usage?.output_tokens) outputTokens = chunk.usage.output_tokens
                if (chunk.usage?.input_tokens && !inputTokens) inputTokens = chunk.usage.input_tokens
              }
            }
          } else if (model.providerType === 'google') {
            const chunk = JSON.parse(trimmedLine) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
              usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
            }
            if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
              if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
              streamedText += chunk.candidates[0].content.parts[0].text
            }
            if (chunk.usageMetadata?.promptTokenCount) inputTokens = chunk.usageMetadata.promptTokenCount
            if (chunk.usageMetadata?.candidatesTokenCount) outputTokens = chunk.usageMetadata.candidatesTokenCount
          } else {
            if (trimmedLine.startsWith('data: ')) {
              const jsonStr = trimmedLine.slice(6)
              if (jsonStr === '[DONE]') continue
              const chunk = JSON.parse(jsonStr) as {
                choices?: Array<{ delta?: { content?: string; reasoning?: string } }>
                usage?: { prompt_tokens?: number; completion_tokens?: number }
              }
              if (chunk.choices?.[0]?.delta?.content) {
                if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
                streamedText += chunk.choices[0].delta.content
              } else if (chunk.choices?.[0]?.delta?.reasoning) {
                if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
                streamedText += chunk.choices[0].delta.reasoning
              }
              if (chunk.usage?.prompt_tokens) inputTokens = chunk.usage.prompt_tokens
              if (chunk.usage?.completion_tokens) outputTokens = chunk.usage.completion_tokens
            }
          }
        } catch {
          continue
        }
      }
    }

    await logger?.flush()

    const endTime = Date.now()
    const totalTime = endTime - startTime
    const effectiveFirstToken = firstParsedTokenTime ?? firstTokenTime
    const timeToFirstToken = effectiveFirstToken ? effectiveFirstToken - startTime : totalTime
    const generationTime = totalTime - timeToFirstToken

    const usedEstimateForOutput = !outputTokens
    const usedEstimateForInput = !inputTokens
    const finalOutputTokens = outputTokens || Math.round(streamedText.length / 4)
    const finalInputTokens = inputTokens || Math.round((testPrompt as string).length / 4)
    const totalTokens = finalInputTokens + finalOutputTokens
    const tokensPerSecond = generationTime > 0 ? (finalOutputTokens / generationTime) * 1000 : 0

    return {
      model: model.name,
      provider: model.providerName,
      totalTime,
      timeToFirstToken,
      tokenCount: finalOutputTokens,
      tokensPerSecond,
      promptTokens: finalInputTokens,
      totalTokens,
      usedEstimateForOutput,
      usedEstimateForInput,
      success: true
    }
  } catch (error) {
    await logger?.flush()
    return {
      model: model.name,
      provider: model.providerName,
      totalTime: 0,
      timeToFirstToken: 0,
      tokenCount: 0,
      tokensPerSecond: 0,
      promptTokens: 0,
      totalTokens: 0,
      usedEstimateForOutput: true,
      usedEstimateForInput: true,
      success: false,
      error: (error as Error).message
    }
  }
}
