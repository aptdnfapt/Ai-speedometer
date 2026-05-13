import {
  TEST_PROMPT as testPrompt,
  getOpencodeSystemPrompt,
  getOpencodeEnvBlock,
  getOpencodeHeaders,
  OPENCODE_TOOLS
} from './constants.ts'

import type { Model, BenchmarkResult } from './types.ts'
import type { BenchLogger } from './logger.ts'

/* ------------------------------------------------------------
   opencode-harness benchmark
   1:1 mimic of opencode CLI request shape (system prompt, tools,
   headers, env block, coding task) so providers do not flag the
   benchmark as non-authentic usage.
   ------------------------------------------------------------ */

function getModelIdForApi(model: Model): string {
  if (model.id && model.id.includes('_')) {
    return model.id.split('_')[1]!.trim()
  } else if (model.id) {
    return model.id.trim()
  }
  return model.name.trim()
}

function isGitRepo(dir: string): boolean {
  try {
    const { execSync } = require('child_process')
    execSync('git rev-parse --git-dir', { cwd: dir, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function buildSystemMessages(modelId: string, providerId: string, cwd: string): Array<{ role: string; content: string }> {
  const sysPrompt = getOpencodeSystemPrompt(modelId)
  const envBlock = getOpencodeEnvBlock(modelId, providerId, cwd, isGitRepo(cwd))
  return [
    { role: 'system', content: sysPrompt },
    { role: 'system', content: envBlock }
  ]
}

function buildToolList(modelId: string): Array<Record<string, unknown>> {
  const mid = modelId.toLowerCase()
  // Exact logic from opencode registry.ts lines 290-295
  const usePatch = mid.includes('gpt-') && !mid.includes('oss') && !mid.includes('gpt-4')

  const all: Array<Record<string, unknown>> = []
  const add = (id: string, desc: string, params: Record<string, unknown>) => {
    all.push({
      type: 'function',
      function: { name: id, description: desc, parameters: params }
    })
  }

  // Always include
  add(OPENCODE_TOOLS.read.name, OPENCODE_TOOLS.read.description, OPENCODE_TOOLS.read.parameters)
  add(OPENCODE_TOOLS.glob.name, OPENCODE_TOOLS.glob.description, OPENCODE_TOOLS.glob.parameters)
  add(OPENCODE_TOOLS.grep.name, OPENCODE_TOOLS.grep.description, OPENCODE_TOOLS.grep.parameters)
  add(OPENCODE_TOOLS.task.name, OPENCODE_TOOLS.task.description, OPENCODE_TOOLS.task.parameters)
  add(OPENCODE_TOOLS.webfetch.name, OPENCODE_TOOLS.webfetch.description, OPENCODE_TOOLS.webfetch.parameters)
  add(OPENCODE_TOOLS.websearch.name, OPENCODE_TOOLS.websearch.description, OPENCODE_TOOLS.websearch.parameters)
  add(OPENCODE_TOOLS.todowrite.name, OPENCODE_TOOLS.todowrite.description, OPENCODE_TOOLS.todowrite.parameters)
  add(OPENCODE_TOOLS.question.name, OPENCODE_TOOLS.question.description, OPENCODE_TOOLS.question.parameters)
  add(OPENCODE_TOOLS.skill.name, OPENCODE_TOOLS.skill.description, OPENCODE_TOOLS.skill.parameters)

  if (usePatch) {
    add(OPENCODE_TOOLS.apply_patch.name, OPENCODE_TOOLS.apply_patch.description, OPENCODE_TOOLS.apply_patch.parameters)
  } else {
    add(OPENCODE_TOOLS.edit.name, OPENCODE_TOOLS.edit.description, OPENCODE_TOOLS.edit.parameters)
    add(OPENCODE_TOOLS.write.name, OPENCODE_TOOLS.write.description, OPENCODE_TOOLS.write.parameters)
  }

  // bash is always present; named 'bash' in the tool descriptions
  add('bash', OPENCODE_TOOLS.bash.description, OPENCODE_TOOLS.bash.parameters)

  return all
}

export async function benchmarkSingleModelRest(model: Model, logger?: BenchLogger): Promise<BenchmarkResult> {
  try {
    if (!model.providerConfig || !model.providerConfig.apiKey) {
      throw new Error(`Missing API key for provider ${model.providerName}`)
    }
    if (!model.providerConfig.baseUrl) {
      throw new Error(`Missing base URL for provider ${model.providerName}`)
    }

    const actualModelId = getModelIdForApi(model)
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

    const cwd = process.cwd()

    // ── Headers (authentic opencode) ──
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${model.providerConfig.apiKey}`,
      ...getOpencodeHeaders(model.providerType === 'anthropic' ? 'anthropic' : 'default')
    }

    if (model.providerType === 'anthropic') {
      headers['x-api-key'] = model.providerConfig.apiKey
      headers['anthropic-version'] = '2023-06-01'
    } else if (model.providerType === 'google') {
      delete headers['Authorization']
      headers['x-goog-api-key'] = model.providerConfig.apiKey
    }

    // ── Build opencode-shaped messages ──
    const systemMessages = buildSystemMessages(actualModelId, model.providerId, cwd)
    const userMessage = { role: 'user', content: testPrompt }

    // ── Build the tool list ──
    const tools = buildToolList(actualModelId)

    const body: Record<string, unknown> = {
      model: actualModelId,
      messages: [...systemMessages, userMessage],
      max_tokens: 500,
      temperature: 0.7,
      stream: true,
      stream_options: { include_usage: true },
      tools,
      tool_choice: 'auto'
    }

    if (model.providerType === 'google') {
      body['contents'] = [
        { parts: systemMessages.map((m) => ({ text: m.content })) },
        { parts: [{ text: userMessage.content }] }
      ]
      body['generationConfig'] = { maxOutputTokens: 500, temperature: 0.7 }
      delete body['messages']
      delete body['max_tokens']
      delete body['stream']
      delete body['stream_options']
      delete body['tools']
      delete body['tool_choice']
    } else if (model.providerType === 'anthropic') {
      delete body['stream_options']
      // Anthropic uses top-level system string
      body['system'] = systemMessages.map((m) => m.content).join('\n\n')
      body['messages'] = [userMessage]
      // Anthropic tools shape
      body['tools'] = tools.map((t: Record<string, unknown>) => {
        const fn = t.function as Record<string, unknown>
        return {
          name: fn.name,
          description: fn.description,
          input_schema: fn.parameters
        }
      })
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
            const anthropicDataPrefix = trimmedLine.startsWith('data: ') ? 6 : trimmedLine.startsWith('data:') ? 5 : -1
            if (anthropicDataPrefix !== -1) {
              const jsonStr = trimmedLine.slice(anthropicDataPrefix)
              if (jsonStr === '[DONE]') continue
              const chunk = JSON.parse(jsonStr) as Record<string, unknown>
              const chunkTyped = chunk as {
                type?: string
                delta?: { type?: string; text?: string; thinking?: string }
                message?: { usage?: { input_tokens?: number } }
                usage?: { output_tokens?: number; input_tokens?: number }
              }
              if (chunkTyped.type === 'content_block_delta' && (chunkTyped.delta?.text || chunkTyped.delta?.thinking)) {
                if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
                streamedText += chunkTyped.delta?.text || chunkTyped.delta?.thinking || ''
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
                delta?: { type?: string; text?: string; thinking?: string }
                message?: { usage?: { input_tokens?: number } }
                usage?: { output_tokens?: number; input_tokens?: number }
              }
              if (chunk.type === 'content_block_delta' && (chunk.delta?.text || chunk.delta?.thinking)) {
                if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
                streamedText += chunk.delta?.text || chunk.delta?.thinking || ''
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
            const dataPrefix = trimmedLine.startsWith('data: ') ? 6 : trimmedLine.startsWith('data:') ? 5 : -1
            if (dataPrefix === -1) continue
            const jsonStr = trimmedLine.slice(dataPrefix)
            if (jsonStr === '[DONE]') continue
            const chunk = JSON.parse(jsonStr) as {
              choices?: Array<{ delta?: { content?: string; reasoning?: string; reasoning_content?: string } }>
              usage?: { prompt_tokens?: number; completion_tokens?: number }
              type?: string
              delta?: { type?: string; text?: string; thinking?: string }
              message?: { usage?: { input_tokens?: number } }
            }
            if (chunk.choices?.[0]?.delta?.content) {
              if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
              streamedText += chunk.choices[0].delta.content
            } else if (chunk.choices?.[0]?.delta?.reasoning) {
              if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
              streamedText += chunk.choices[0].delta.reasoning
            } else if (chunk.choices?.[0]?.delta?.reasoning_content) {
              if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
              streamedText += chunk.choices[0].delta.reasoning_content
            } else if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
              if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
              streamedText += chunk.delta.text
            } else if (chunk.type === 'content_block_delta' && chunk.delta?.thinking) {
              if (!firstParsedTokenTime) firstParsedTokenTime = Date.now()
              streamedText += chunk.delta.thinking
            }
            if (chunk.usage?.prompt_tokens) inputTokens = chunk.usage.prompt_tokens
            if (chunk.usage?.completion_tokens) outputTokens = chunk.usage.completion_tokens
            if (chunk.type === 'message_start' && chunk.message?.usage?.input_tokens) inputTokens = chunk.message.usage.input_tokens
            if (chunk.type === 'message_delta' && (chunk as unknown as { usage?: { output_tokens?: number } }).usage?.output_tokens) {
              outputTokens = (chunk as unknown as { usage: { output_tokens: number } }).usage.output_tokens
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
    const f1000 = tokensPerSecond > 0
      ? (1000 * (timeToFirstToken / 1000 + 300 / tokensPerSecond)) / 3600
      : Infinity

    return {
      model: model.name,
      provider: model.providerName,
      totalTime,
      timeToFirstToken,
      tokenCount: finalOutputTokens,
      tokensPerSecond,
      f1000,
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
      f1000: Infinity,
      promptTokens: 0,
      totalTokens: 0,
      usedEstimateForOutput: true,
      usedEstimateForInput: true,
      success: false,
      error: (error as Error).message
    }
  }
}
