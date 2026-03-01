export interface Model {
  id: string
  name: string
  providerName: string
  providerType: 'openai-compatible' | 'anthropic' | 'google'
  providerId: string
  providerConfig: ProviderConfig
}

export interface ProviderConfig {
  baseUrl: string
  apiKey: string
  endpointFormat?: string
}

export interface Provider {
  id: string
  name: string
  type: 'openai-compatible' | 'anthropic' | 'google'
  baseUrl: string
  apiKey: string
  models: Array<{ id: string; name: string }>
}

export interface BenchmarkResult {
  model: string
  provider: string
  totalTime: number
  timeToFirstToken: number
  tokenCount: number
  tokensPerSecond: number
  promptTokens: number
  totalTokens: number
  usedEstimateForOutput: boolean
  usedEstimateForInput: boolean
  success: boolean
  error?: string
}

export type ModelBenchStatus = 'pending' | 'running' | 'done' | 'error'

export interface ModelBenchState {
  model: Model
  status: ModelBenchStatus
  result?: BenchmarkResult
  error?: string
  startedAt?: number
}

export interface CliArgs {
  debug: boolean
  log: boolean
  bench: string | null
  benchCustom: string | null
  apiKey: string | null
  baseUrl: string | null
  endpointFormat: string | null
  formatted: boolean
  help: boolean
}
