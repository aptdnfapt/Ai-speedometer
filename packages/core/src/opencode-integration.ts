import fs from 'fs'
import path from 'path'
import { homedir } from 'os'
import { getAllProviders, getModelsForProvider, loadCustomVerifiedProviders } from './models-dev.ts'
import { getCustomProvidersFromConfig } from './ai-config.ts'
import { parse as parseJsonc, type ParseError } from 'jsonc-parser'
import type { Provider } from './types.ts'

interface XDGPaths {
  data: string
  config: string
}

interface FilePaths {
  authJson: string
  opencodeJson: string
}

interface AuthEntry {
  type: string
  key?: string
}

type AuthData = Record<string, AuthEntry>

interface MigrationResult {
  migrated: number
  failed: number
  errors: string[]
}

interface DebugInfo {
  opencodePaths: FilePaths
  authExists: boolean
  configExists: boolean
  authData: string[]
  configProviders: string[]
  aiConfigPaths: { configJson: string; configDir: string; configExists: boolean }
  aiConfigData: { verifiedProviders: string[]; customProviders: string[] }
  xdgPaths: XDGPaths
}

const getXDGPaths = (): XDGPaths => ({
  data: path.join(process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share'), 'opencode'),
  config: path.join(process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'), 'opencode')
})

const getFilePaths = (): FilePaths => {
  const paths = getXDGPaths()
  return {
    authJson: path.join(paths.data, 'auth.json'),
    opencodeJson: path.join(paths.config, 'opencode.json')
  }
}

const ensureDirectories = (): void => {
  const paths = getXDGPaths()
  ;[paths.data, paths.config].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  })
}

export const readAuthJson = async (): Promise<AuthData> => {
  const { authJson } = getFilePaths()
  try {
    if (!fs.existsSync(authJson)) return {}
    const data = fs.readFileSync(authJson, 'utf8')
    const errors: ParseError[] = []
    const parsed = parseJsonc(data, errors, { allowTrailingComma: true }) as AuthData
    if (errors.length > 0) {
      console.warn('Warning: JSONC parsing errors in auth.json:', errors.map(e => e.error).join(', '))
      return parsed || {}
    }
    return parsed
  } catch (error) {
    console.warn('Warning: Could not read auth.json:', (error as Error).message)
    return {}
  }
}

export const writeAuthJson = async (authData: AuthData): Promise<boolean> => {
  const { authJson } = getFilePaths()
  try {
    ensureDirectories()
    fs.writeFileSync(authJson, JSON.stringify(authData, null, 2))
    fs.chmodSync(authJson, 0o600)
    return true
  } catch (error) {
    console.error('Error writing auth.json:', (error as Error).message)
    return false
  }
}

export const writeOpencodeConfig = async (): Promise<false> => {
  console.warn('Warning: opencode.json is no longer used. Use ai-benchmark-config.json instead.')
  return false
}

export const readOpencodeConfig = async (): Promise<{ provider: Record<string, unknown> }> => {
  console.warn('Warning: opencode.json is no longer used. Use ai-benchmark-config.json instead.')
  return { provider: {} }
}

interface OpencodeProviderOptions {
  apiKey?: string
  baseURL?: string
  [key: string]: unknown
}

interface OpencodeProviderEntry {
  name?: string
  npm?: string
  api?: string
  env?: string[]
  options?: OpencodeProviderOptions
  models?: Record<string, { id?: string; name?: string }>
}

interface OpencodeGlobalConfig {
  provider?: Record<string, OpencodeProviderEntry>
  [key: string]: unknown
}

const readOpencodeGlobalConfig = (): OpencodeGlobalConfig => {
  const configDir = path.join(
    process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config'),
    'opencode'
  )
  // opencode reads both config.json and opencode.json, merging them
  const candidates = ['config.json', 'opencode.json', 'opencode.jsonc']
  let merged: OpencodeGlobalConfig = {}

  for (const filename of candidates) {
    const filePath = path.join(configDir, filename)
    try {
      if (!fs.existsSync(filePath)) continue
      const text = fs.readFileSync(filePath, 'utf8')
      const errors: ParseError[] = []
      const parsed = parseJsonc(text, errors, { allowTrailingComma: true }) as OpencodeGlobalConfig
      if (parsed && typeof parsed === 'object') {
        // merge provider maps, later files win per-provider
        merged = {
          ...merged,
          ...parsed,
          provider: { ...(merged.provider ?? {}), ...(parsed.provider ?? {}) }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read opencode config file ${filename}:`, (error as Error).message)
    }
  }

  return merged
}

export const getOpencodeGlobalConfigProviders = async (): Promise<Provider[]> => {
  return getAuthenticatedProviders()
}

export const getAuthenticatedProviders = async (): Promise<Provider[]> => {
  try {
    const [allModelsDevProviders, authData, globalConfig] = await Promise.all([
      getAllProviders(),
      readAuthJson(),
      Promise.resolve(readOpencodeGlobalConfig())
    ])

    // Step 1: build database — models.dev as base, config inline models merged on top (additive)
    // exactly like opencode: database[providerID] = mergeDeep(modelsDevEntry, configEntry)
    const database = new Map<string, {
      id: string
      name: string
      type: string
      baseUrl: string
      models: Map<string, { id: string; name: string }>
      npm?: string
    }>()

    // seed database from models.dev
    for (const mdProvider of allModelsDevProviders) {
      const modelMap = new Map<string, { id: string; name: string }>()
      for (const m of mdProvider.models) {
        modelMap.set(`${mdProvider.id}_${m.id}`, { id: `${mdProvider.id}_${m.id}`, name: m.name })
      }
      database.set(mdProvider.id, {
        id: mdProvider.id,
        name: mdProvider.name,
        type: mdProvider.type,
        baseUrl: mdProvider.baseUrl,
        models: modelMap
      })
    }

    // merge config providers into database — config inline models added/override on top
    for (const [providerID, entry] of Object.entries(globalConfig.provider ?? {})) {
      const existing = database.get(providerID)
      const modelMap: Map<string, { id: string; name: string }> = existing
        ? new Map(existing.models)
        : new Map()

      for (const [modelKey, m] of Object.entries(entry.models ?? {})) {
        const resolvedId = `${providerID}_${m.id ?? modelKey}`
        modelMap.set(resolvedId, { id: resolvedId, name: m.name ?? m.id ?? modelKey })
      }

      database.set(providerID, {
        id: providerID,
        name: entry.name ?? existing?.name ?? providerID,
        type: existing?.type ?? 'openai-compatible',
        baseUrl: entry.options?.baseURL ?? entry.api ?? existing?.baseUrl ?? '',
        models: modelMap,
        npm: entry.npm
      })
    }

    // Step 2: resolve who has a key — auth.json first, then explicit options.apiKey in config
    // exactly like opencode: auth.json key + database entry = provider in final list
    const providerMap = new Map<string, Provider>()

    // auth.json keys
    for (const [providerID, authInfo] of Object.entries(authData)) {
      if (authInfo.type !== 'api' || !authInfo.key) continue
      const dbEntry = database.get(providerID)
      if (!dbEntry) continue
      const configEntry = globalConfig.provider?.[providerID]
      const npm = dbEntry.npm ?? configEntry?.npm
      const type: Provider['type'] = npm?.includes('anthropic') ? 'anthropic' : dbEntry.type as Provider['type']
      providerMap.set(providerID, {
        id: providerID,
        name: dbEntry.name,
        type,
        baseUrl: dbEntry.baseUrl,
        apiKey: authInfo.key,
        models: Array.from(dbEntry.models.values())
      })
    }

    // explicit options.apiKey in config (override auth.json if both exist)
    for (const [providerID, entry] of Object.entries(globalConfig.provider ?? {})) {
      if (!entry.options?.apiKey) continue
      const dbEntry = database.get(providerID)
      if (!dbEntry) continue
      const npm = dbEntry.npm ?? entry.npm
      const type: Provider['type'] = npm?.includes('anthropic') ? 'anthropic' : dbEntry.type as Provider['type']
      providerMap.set(providerID, {
        id: providerID,
        name: dbEntry.name,
        type,
        baseUrl: dbEntry.baseUrl,
        apiKey: entry.options.apiKey,
        models: Array.from(dbEntry.models.values())
      })
    }

    return Array.from(providerMap.values())
  } catch (error) {
    console.warn('Warning: Could not load providers:', (error as Error).message)
    return []
  }
}

export const getCustomProviders = async (): Promise<Provider[]> => []

export const verifyProvider = async (providerId: string) => {
  try {
    const allProviders = await getAllProviders()
    return allProviders.find(p => p.id === providerId) ?? null
  } catch (error) {
    console.warn('Warning: Could not verify provider:', (error as Error).message)
    return null
  }
}

export const addApiKey = async (providerId: string, apiKey: string): Promise<boolean> => {
  const authData = await readAuthJson()
  authData[providerId] = { type: 'api', key: apiKey }
  return writeAuthJson(authData)
}

export const removeApiKey = async (providerId: string): Promise<boolean> => {
  const authData = await readAuthJson()
  if (authData[providerId]) {
    delete authData[providerId]
    return writeAuthJson(authData)
  }
  return true
}

export const getAllAvailableProviders = async (includeAllProviders = false): Promise<Provider[]> => {
  const [opencodeProviders, customProvidersFromConfig, customVerifiedProviders] = await Promise.all([
    getAuthenticatedProviders(),
    (async () => {
      try {
        return await getCustomProvidersFromConfig()
      } catch (error) {
        console.warn('Warning: Could not load custom providers:', (error as Error).message)
        return []
      }
    })(),
    (async () => {
      try {
        return loadCustomVerifiedProviders()
      } catch (error) {
        console.warn('Warning: Could not load custom verified providers:', (error as Error).message)
        return []
      }
    })()
  ])

  const providerMap = new Map<string, Provider>()

  // priority (lowest → highest): bundled → opencode (auth+config merged) → our config
  customVerifiedProviders.forEach(p => providerMap.set(p.id, p as unknown as Provider))
  opencodeProviders.forEach(p => providerMap.set(p.id, p))
  customProvidersFromConfig.forEach(p => providerMap.set(p.id, p))

  if (includeAllProviders) {
    try {
      const allModelsDevProviders = await getAllProviders()
      const authenticatedIds = new Set(opencodeProviders.map((p: Provider) => p.id))
      const customIds = new Set(customProvidersFromConfig.map(p => p.id))
      const customVerifiedIds = new Set(customVerifiedProviders.map(p => p.id))

      allModelsDevProviders.forEach(provider => {
        if (!authenticatedIds.has(provider.id) && !customIds.has(provider.id) && !customVerifiedIds.has(provider.id)) {
          providerMap.set(provider.id, {
            ...provider,
            type: provider.type as Provider['type'],
            apiKey: '',
            models: provider.models.map(m => ({ ...m, id: `${provider.id}_${m.id}` }))
          })
        }
      })
    } catch (error) {
      console.warn('Warning: Could not load all models.dev providers:', (error as Error).message)
    }
  }

  return Array.from(providerMap.values())
}

export const isProviderAuthenticated = async (providerId: string): Promise<boolean> => {
  const authData = await readAuthJson()
  return authData[providerId]?.type === 'api'
}

export const getProviderAuth = async (providerId: string): Promise<AuthEntry | null> => {
  const authData = await readAuthJson()
  return authData[providerId] ?? null
}

export const migrateFromOldConfig = async (oldConfig: {
  verifiedProviders?: Record<string, string>
  customProviders?: Provider[]
}): Promise<MigrationResult> => {
  const results: MigrationResult = { migrated: 0, failed: 0, errors: [] }

  try {
    if (oldConfig.verifiedProviders) {
      for (const [providerId, apiKey] of Object.entries(oldConfig.verifiedProviders)) {
        const providerInfo = await verifyProvider(providerId)
        if (providerInfo) {
          const success = await addApiKey(providerId, apiKey)
          if (success) results.migrated++
          else { results.failed++; results.errors.push(`Failed to migrate ${providerId}`) }
        } else {
          results.failed++
          results.errors.push(`Provider ${providerId} not found in models.dev`)
        }
      }
    }

    if (oldConfig.customProviders && oldConfig.customProviders.length > 0) {
      try {
        const { readAIConfig, writeAIConfig } = await import('./ai-config.ts')
        const config = await readAIConfig()
        for (const provider of oldConfig.customProviders) {
          config.customProviders = config.customProviders || []
          config.customProviders.push({
            id: provider.id,
            name: provider.name,
            type: provider.type,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            models: provider.models || []
          })
          results.migrated++
        }
        await writeAIConfig(config)
      } catch (error) {
        results.failed++
        results.errors.push(`Failed to migrate custom providers: ${(error as Error).message}`)
      }
    }

    return results
  } catch (error) {
    results.failed++
    results.errors.push(`Migration failed: ${(error as Error).message}`)
    return results
  }
}

export const getDebugInfo = async (): Promise<DebugInfo> => {
  const opencodePaths = getFilePaths()
  const { getAIConfigDebugPaths, readAIConfig } = await import('./ai-config.ts')
  const aiConfigPaths = getAIConfigDebugPaths()
  const authData = await readAuthJson()
  const aiConfigData = await readAIConfig()

  return {
    opencodePaths,
    authExists: fs.existsSync(opencodePaths.authJson),
    configExists: fs.existsSync(opencodePaths.opencodeJson),
    authData: Object.keys(authData),
    configProviders: [],
    aiConfigPaths,
    aiConfigData: {
      verifiedProviders: Object.keys(aiConfigData.verifiedProviders || {}),
      customProviders: (aiConfigData.customProviders || []).map(p => p.id)
    },
    xdgPaths: getXDGPaths()
  }
}
