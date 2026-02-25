import type { Model, BenchmarkResult, Provider, ModelBenchState } from '../types.ts'

export function mockModel(overrides: Partial<Model> = {}): Model {
  return {
    id: 'gpt-4',
    name: 'GPT-4',
    providerName: 'OpenAI',
    providerType: 'openai-compatible',
    providerId: 'openai',
    providerConfig: { baseUrl: 'https://api.openai.com/v1', apiKey: 'sk-test' },
    ...overrides,
  }
}

export function mockBenchmarkResult(overrides: Partial<BenchmarkResult> = {}): BenchmarkResult {
  return {
    model: 'gpt-4',
    provider: 'OpenAI',
    totalTime: 2000,
    timeToFirstToken: 300,
    tokenCount: 100,
    tokensPerSecond: 50,
    promptTokens: 20,
    totalTokens: 120,
    usedEstimateForOutput: false,
    usedEstimateForInput: false,
    success: true,
    ...overrides,
  }
}

export function mockProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    models: [{ id: 'gpt-4', name: 'GPT-4' }],
    ...overrides,
  }
}

export function mockModelBenchState(
  status: ModelBenchState['status'],
  overrides: Partial<ModelBenchState> = {}
): ModelBenchState {
  return {
    model: mockModel(),
    status,
    ...overrides,
  }
}
