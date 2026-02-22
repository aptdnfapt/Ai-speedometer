import { getAllAvailableProviders } from '../opencode-integration.js'
import { benchmarkSingleModelRest } from './benchmark.ts'
import type { CliArgs, Model, Provider } from './types.ts'

function parseProviderModel(arg: string): { provider: string; model: string } {
  const firstColonIndex = arg.indexOf(':')
  if (firstColonIndex === -1) {
    throw new Error(`Invalid format. Use provider:model (e.g., openai:gpt-4)`)
  }
  return {
    provider: arg.substring(0, firstColonIndex),
    model: arg.substring(firstColonIndex + 1)
  }
}

function createCustomProviderFromCli(cliArgs: CliArgs): Provider & { models: Array<{ id: string; name: string }> } {
  const { provider, model } = parseProviderModel(cliArgs.benchCustom!)

  if (!cliArgs.baseUrl) throw new Error('--base-url is required for custom provider benchmarking')
  if (!cliArgs.apiKey) throw new Error('--api-key is required for custom provider benchmarking')

  const endpointFormat = cliArgs.endpointFormat || 'chat/completions'

  return {
    id: provider,
    name: provider,
    type: 'openai-compatible',
    baseUrl: cliArgs.baseUrl,
    apiKey: cliArgs.apiKey,
    endpointFormat,
    models: [{ name: model, id: model }]
  } as Provider & { models: Array<{ id: string; name: string }>; endpointFormat: string }
}

async function loadConfig(includeAll: boolean): Promise<{ providers: Provider[] }> {
  try {
    const providers = await getAllAvailableProviders(includeAll)
    return { providers }
  } catch {
    return { providers: [] }
  }
}

function buildJsonOutput(
  providerName: string,
  providerId: string,
  modelName: string,
  modelId: string,
  result: Awaited<ReturnType<typeof benchmarkSingleModelRest>>,
  formatted: boolean
): string {
  const jsonOutput = {
    provider: providerName,
    providerId,
    model: modelName,
    modelId,
    method: 'rest-api',
    success: result.success,
    totalTime: result.totalTime,
    totalTimeSeconds: result.totalTime / 1000,
    timeToFirstToken: result.timeToFirstToken,
    timeToFirstTokenSeconds: result.timeToFirstToken / 1000,
    tokensPerSecond: result.tokensPerSecond,
    outputTokens: result.tokenCount,
    promptTokens: result.promptTokens,
    totalTokens: result.totalTokens,
    is_estimated: !!(result.usedEstimateForOutput || result.usedEstimateForInput),
    error: result.error || null
  }
  return JSON.stringify(jsonOutput, null, formatted ? 2 : 0)
}

export async function runHeadlessBenchmark(cliArgs: CliArgs): Promise<void> {
  try {
    if (cliArgs.benchCustom) {
      const customProvider = createCustomProviderFromCli(cliArgs)
      const modelDef = customProvider.models[0]!

      const modelConfig: Model = {
        id: modelDef.id,
        name: modelDef.name,
        providerName: customProvider.name,
        providerType: customProvider.type,
        providerId: customProvider.id,
        providerConfig: {
          baseUrl: customProvider.baseUrl,
          apiKey: customProvider.apiKey,
          endpointFormat: (customProvider as unknown as { endpointFormat: string }).endpointFormat
        }
      }

      const result = await benchmarkSingleModelRest(modelConfig)
      console.log(buildJsonOutput(customProvider.name, customProvider.id, modelDef.name, modelDef.id, result, cliArgs.formatted))
      process.exit(result.success ? 0 : 1)
    }

    const benchSpec = cliArgs.bench!
    const colonIndex = benchSpec.indexOf(':')
    if (colonIndex === -1) {
      console.error('Error: Invalid --bench format. Use: provider:model')
      process.exit(1)
    }

    const providerSpec = benchSpec.substring(0, colonIndex)
    let modelName = benchSpec.substring(colonIndex + 1)

    if ((modelName.startsWith('"') && modelName.endsWith('"')) ||
        (modelName.startsWith("'") && modelName.endsWith("'"))) {
      modelName = modelName.slice(1, -1)
    }

    if (!providerSpec || !modelName) {
      console.error('Error: Invalid --bench format. Use: provider:model')
      process.exit(1)
    }

    const config = await loadConfig(true)

    const provider = config.providers.find(p =>
      p.id?.toLowerCase() === providerSpec.toLowerCase() ||
      p.name?.toLowerCase() === providerSpec.toLowerCase()
    )

    if (!provider) {
      console.error(`Error: Provider '${providerSpec}' not found`)
      console.error('Available providers:')
      config.providers.forEach(p => console.error(`  - ${p.id || p.name}`))
      process.exit(1)
    }

    const model = provider.models.find(m => {
      const modelIdLower = m.id?.toLowerCase() || ''
      const modelNameLower = m.name?.toLowerCase() || ''
      const searchLower = modelName.toLowerCase()
      if (modelIdLower === searchLower) return true
      const idWithoutPrefix = modelIdLower.includes('_')
        ? modelIdLower.split('_').slice(1).join('_')
        : modelIdLower
      if (idWithoutPrefix === searchLower) return true
      if (modelNameLower === searchLower) return true
      return false
    })

    if (!model) {
      console.error(`Error: Model '${modelName}' not found in provider '${provider.name}'`)
      console.error('Available models:')
      provider.models.forEach(m => {
        const idWithoutPrefix = m.id?.includes('_') ? m.id.split('_').slice(1).join('_') : m.id
        console.error(`  - ${m.name} (id: ${idWithoutPrefix})`)
      })
      process.exit(1)
    }

    const finalApiKey = cliArgs.apiKey || provider.apiKey
    if (!finalApiKey) {
      console.error(`Error: No API key found for provider '${provider.name}'`)
      console.error('Please provide --api-key flag or configure the provider first')
      process.exit(1)
    }

    const modelConfig: Model = {
      id: model.id,
      name: model.name,
      providerName: provider.name,
      providerType: provider.type,
      providerId: provider.id,
      providerConfig: {
        ...provider,
        apiKey: finalApiKey,
        baseUrl: provider.baseUrl || ''
      }
    }

    const result = await benchmarkSingleModelRest(modelConfig)
    console.log(buildJsonOutput(provider.name, provider.id, model.name, model.id, result, cliArgs.formatted))
    process.exit(result.success ? 0 : 1)
  } catch (error) {
    console.error('Error: ' + (error as Error).message)
    process.exit(1)
  }
}
