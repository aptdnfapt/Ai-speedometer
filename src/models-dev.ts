import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

import customVerifiedProvidersData from '../custom-verified-providers.json' with { type: 'json' }

export interface ProviderInfo {
  id: string
  name: string
  type: string
  baseUrl: string
  models: Array<{ id: string; name: string }>
}

interface CacheData {
  providers: ProviderInfo[]
  timestamp: number
}

interface CustomModel {
  id: string
  name: string
}

interface CustomProviderEntry {
  id?: string
  name?: string
  baseUrl?: string
  type?: string
  models?: Record<string, CustomModel>
}

interface CustomVerifiedProvidersJson {
  'custom-verified-providers'?: Record<string, CustomProviderEntry | Record<string, CustomModel>>
}

interface ModelsDevProviderEntry {
  id?: string
  name?: string
  models?: Record<string, { id: string; name: string }>
  api?: string
  baseUrl?: string
  npm?: string
}

const CACHE_DIR = path.join(homedir(), '.cache', 'ai-speedometer')
const CACHE_FILE = path.join(CACHE_DIR, 'models.json')

const FALLBACK_PROVIDERS: ProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    type: 'openai-compatible',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    type: 'anthropic',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    type: 'openai-compatible',
    models: [
      { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' }
    ]
  }
]

function ensureCacheDir(): void {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
    }
  } catch (error) {
    console.warn('Warning: Could not create cache directory:', (error as Error).message)
  }
}

function isCacheExpired(cacheData: CacheData): boolean {
  if (!cacheData.timestamp) return true
  return Date.now() - cacheData.timestamp > 60 * 60 * 1000
}

function loadCache(): CacheData | null {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8')
      const parsed = JSON.parse(data) as CacheData
      if (isCacheExpired(parsed)) return null
      return parsed
    }
  } catch (error) {
    console.warn('Warning: Could not load cache:', (error as Error).message)
  }
  return null
}

function saveCache(data: { providers: ProviderInfo[] }): void {
  try {
    ensureCacheDir()
    const cacheData: CacheData = { ...data, timestamp: Date.now() }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2))
  } catch (error) {
    console.warn('Warning: Could not save cache:', (error as Error).message)
  }
}

async function fetchFromAPI(): Promise<Record<string, ModelsDevProviderEntry> | null> {
  try {
    const response = await fetch('https://models.dev/api.json')
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    return (await response.json()) as Record<string, ModelsDevProviderEntry>
  } catch (error) {
    console.warn('Warning: Could not fetch from models.dev API:', (error as Error).message)
    return null
  }
}

function getCustomProvidersJson(): CustomVerifiedProvidersJson {
  let data = customVerifiedProvidersData as CustomVerifiedProvidersJson
  const customProvidersPath = path.join(process.cwd(), 'custom-verified-providers.json')
  if (fs.existsSync(customProvidersPath)) {
    try {
      data = JSON.parse(fs.readFileSync(customProvidersPath, 'utf8')) as CustomVerifiedProvidersJson
    } catch (fileError) {
      console.warn('Warning: Could not load custom providers from file, using embedded data:', (fileError as Error).message)
    }
  }
  return data
}

export function loadCustomVerifiedProviders(): ProviderInfo[] {
  try {
    const customProviders = getCustomProvidersJson()
    const providers: ProviderInfo[] = []
    if (customProviders['custom-verified-providers']) {
      for (const [, providerData] of Object.entries(customProviders['custom-verified-providers'])) {
        const entry = providerData as CustomProviderEntry
        if (entry.id === 'extra-models-dev') continue
        if (entry.id && entry.name && entry.models) {
          providers.push({
            id: entry.id,
            name: entry.name,
            baseUrl: entry.baseUrl || '',
            type: entry.type || 'openai-compatible',
            models: Object.values(entry.models).map(m => ({ id: m.id, name: m.name }))
          })
        }
      }
    }
    return providers
  } catch (error) {
    console.warn('Warning: Could not load custom verified providers:', (error as Error).message)
    return []
  }
}

function loadExtraModels(): Record<string, Array<{ id: string; name: string }>> {
  try {
    const customProviders = getCustomProvidersJson()
    const extraModels: Record<string, Array<{ id: string; name: string }>> = {}
    const section = customProviders['custom-verified-providers']?.['extra-models-dev']
    if (section) {
      for (const [providerId, models] of Object.entries(section as Record<string, Record<string, CustomModel>>)) {
        extraModels[providerId] = Object.values(models).map(m => ({ id: m.id, name: m.name }))
      }
    }
    return extraModels
  } catch (error) {
    console.warn('Warning: Could not load extra models:', (error as Error).message)
    return {}
  }
}

function transformModelsDevData(apiData: Record<string, ModelsDevProviderEntry> | null): ProviderInfo[] {
  const providers: ProviderInfo[] = []
  const customProviders = loadCustomVerifiedProviders()
  providers.push(...customProviders)
  const extraModels = loadExtraModels()

  if (apiData) {
    for (const [, providerData] of Object.entries(apiData)) {
      if (providerData.id && providerData.name && providerData.models) {
        const models = Object.values(providerData.models).map(m => ({ id: m.id, name: m.name }))
        if (extraModels[providerData.id]) {
          models.push(...extraModels[providerData.id])
        }
        providers.push({
          id: providerData.id,
          name: providerData.name,
          baseUrl: providerData.api || providerData.baseUrl || '',
          type: providerData.npm
            ? providerData.npm.includes('anthropic') ? 'anthropic' : 'openai-compatible'
            : 'openai-compatible',
          models
        })
      }
    }
  }

  return providers.length === 0 ? FALLBACK_PROVIDERS : providers
}

export async function getAllProviders(): Promise<ProviderInfo[]> {
  const cachedData = loadCache()
  if (cachedData?.providers) {
    const customVerifiedProviders = loadCustomVerifiedProviders()
    const existingIds = new Set(cachedData.providers.map(p => p.id))
    const missing = customVerifiedProviders.filter(p => !existingIds.has(p.id))
    if (missing.length > 0) cachedData.providers.push(...missing)
    return cachedData.providers
  }

  const apiData = await fetchFromAPI()
  if (apiData) {
    const transformed = transformModelsDevData(apiData)
    saveCache({ providers: transformed })
    return transformed
  }

  const fallback = [...FALLBACK_PROVIDERS]
  const extraModels = loadExtraModels()
  const customVerified = loadCustomVerifiedProviders()
  fallback.forEach(p => {
    if (extraModels[p.id]) p.models.push(...extraModels[p.id])
  })
  fallback.push(...customVerified)
  return fallback
}

export async function searchProviders(query: string): Promise<ProviderInfo[]> {
  const providers = await getAllProviders()
  const q = query.toLowerCase()
  return providers.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
}

export async function getModelsForProvider(providerId: string): Promise<Array<{ id: string; name: string }>> {
  const providers = await getAllProviders()
  return providers.find(p => p.id === providerId)?.models ?? []
}

export async function refreshData(): Promise<ProviderInfo[]> {
  const apiData = await fetchFromAPI()
  if (apiData) {
    const transformed = transformModelsDevData(apiData)
    saveCache({ providers: transformed })
    return transformed
  }
  const cached = loadCache()
  if (cached?.providers) return cached.providers
  const fallback = [...FALLBACK_PROVIDERS]
  const extraModels = loadExtraModels()
  fallback.forEach(p => {
    if (extraModels[p.id]) p.models.push(...extraModels[p.id])
  })
  return fallback
}

export function clearCache(): void {
  try {
    if (fs.existsSync(CACHE_FILE)) fs.unlinkSync(CACHE_FILE)
  } catch (error) {
    console.warn('Warning: Could not clear cache:', (error as Error).message)
  }
}

export { fetchFromAPI, transformModelsDevData }
