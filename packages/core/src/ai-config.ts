import fs from 'fs'
import path from 'path'
import { homedir } from 'os'
import type { Provider } from './types.ts'

interface AIConfigPaths {
  configDir: string
  configJson: string
  recentModelsCache: string
}

interface AIConfig {
  verifiedProviders: Record<string, string>
  customProviders: Provider[]
  recentModels?: RecentModel[]
  theme?: string
}

interface RecentModel {
  modelId: string
  modelName: string
  providerName: string
  timestamp?: number
}

const getAIConfigPaths = (): AIConfigPaths => {
  const aiConfigDir = process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config')
  const aiSpeedometerConfigDir = path.join(aiConfigDir, 'ai-speedometer')
  return {
    configDir: aiSpeedometerConfigDir,
    configJson: path.join(aiSpeedometerConfigDir, 'ai-benchmark-config.json'),
    recentModelsCache: path.join(aiSpeedometerConfigDir, 'recent-models.json')
  }
}

const ensureAIConfigDirectory = (): void => {
  const { configDir } = getAIConfigPaths()
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
}

export const readAIConfig = async (): Promise<AIConfig> => {
  const { configJson } = getAIConfigPaths()
  try {
    if (!fs.existsSync(configJson)) {
      return { verifiedProviders: {}, customProviders: [] }
    }
    const data = fs.readFileSync(configJson, 'utf8')
    return JSON.parse(data) as AIConfig
  } catch (error) {
    console.warn('Warning: Could not read ai-benchmark-config.json:', (error as Error).message)
    return { verifiedProviders: {}, customProviders: [] }
  }
}

export const readThemeFromConfig = async (): Promise<string> => {
  const config = await readAIConfig()
  return config.theme ?? 'tokyonight'
}

export const writeThemeToConfig = async (theme: string): Promise<void> => {
  const config = await readAIConfig()
  await writeAIConfig({ ...config, theme })
}

export const writeAIConfig = async (config: AIConfig): Promise<boolean> => {
  const { configJson } = getAIConfigPaths()
  try {
    ensureAIConfigDirectory()
    fs.writeFileSync(configJson, JSON.stringify(config, null, 2))
    return true
  } catch (error) {
    console.error('Error writing ai-benchmark-config.json:', (error as Error).message)
    return false
  }
}

export const addVerifiedProvider = async (providerId: string, apiKey: string): Promise<boolean> => {
  const config = await readAIConfig()
  config.verifiedProviders = config.verifiedProviders || {}
  config.verifiedProviders[providerId] = apiKey
  return writeAIConfig(config)
}

export const addCustomProvider = async (providerData: Provider): Promise<boolean> => {
  const config = await readAIConfig()
  config.customProviders = config.customProviders || []
  const existingIndex = config.customProviders.findIndex(p => p.id === providerData.id)
  if (existingIndex >= 0) {
    config.customProviders[existingIndex] = providerData
  } else {
    config.customProviders.push(providerData)
  }
  return writeAIConfig(config)
}

export const addModelToCustomProvider = async (
  providerId: string,
  modelData: { id: string; name: string }
): Promise<boolean> => {
  const config = await readAIConfig()
  if (!config.customProviders) {
    console.error('No custom providers found')
    return false
  }
  const provider = config.customProviders.find(p => p.id === providerId)
  if (!provider) {
    console.error(`Custom provider ${providerId} not found`)
    return false
  }
  provider.models = provider.models || []
  const existingIndex = provider.models.findIndex(m => m.id === modelData.id)
  if (existingIndex >= 0) {
    provider.models[existingIndex] = modelData
  } else {
    provider.models.push(modelData)
  }
  return writeAIConfig(config)
}

export const getCustomProvidersFromConfig = async (): Promise<Provider[]> => {
  const config = await readAIConfig()
  return config.customProviders || []
}

export const getVerifiedProvidersFromConfig = async (): Promise<Record<string, string>> => {
  const config = await readAIConfig()
  return config.verifiedProviders || {}
}

export const removeCustomProvider = async (providerId: string): Promise<boolean> => {
  const config = await readAIConfig()
  if (config.customProviders) {
    config.customProviders = config.customProviders.filter(p => p.id !== providerId)
    return writeAIConfig(config)
  }
  return true
}

export const removeVerifiedProvider = async (providerId: string): Promise<boolean> => {
  const config = await readAIConfig()
  if (config.verifiedProviders && config.verifiedProviders[providerId]) {
    delete config.verifiedProviders[providerId]
    return writeAIConfig(config)
  }
  return true
}

export const addToRecentModels = async (models: RecentModel[]): Promise<RecentModel[]> => {
  const { recentModelsCache } = getAIConfigPaths()
  ensureAIConfigDirectory()
  let recentModels: RecentModel[] = []
  try {
    if (fs.existsSync(recentModelsCache)) {
      const data = fs.readFileSync(recentModelsCache, 'utf8')
      recentModels = JSON.parse(data) as RecentModel[]
    }
  } catch {
    recentModels = []
  }
  models.forEach(model => {
    recentModels = recentModels.filter(r => r.modelId !== model.modelId)
    recentModels.unshift({
      modelId: model.modelId,
      modelName: model.modelName,
      providerName: model.providerName,
      timestamp: Date.now()
    })
  })
  recentModels = recentModels.slice(0, 5)
  fs.writeFileSync(recentModelsCache, JSON.stringify(recentModels, null, 2))
  return recentModels
}

export const getRecentModels = async (): Promise<RecentModel[]> => {
  const { recentModelsCache } = getAIConfigPaths()
  try {
    if (fs.existsSync(recentModelsCache)) {
      const data = fs.readFileSync(recentModelsCache, 'utf8')
      return JSON.parse(data) as RecentModel[]
    }
  } catch {
    // return empty on any error
  }
  return []
}

export const clearRecentModels = async (): Promise<RecentModel[]> => {
  const { recentModelsCache } = getAIConfigPaths()
  try {
    if (fs.existsSync(recentModelsCache)) {
      fs.unlinkSync(recentModelsCache)
    }
  } catch {
    // ignore
  }
  return []
}

export const cleanupRecentModelsFromConfig = async (): Promise<AIConfig> => {
  const config = await readAIConfig()
  if (config.recentModels && config.recentModels.length > 0) {
    const { recentModelsCache } = getAIConfigPaths()
    ensureAIConfigDirectory()
    try {
      fs.writeFileSync(recentModelsCache, JSON.stringify(config.recentModels, null, 2))
    } catch (error) {
      console.warn('Warning: Could not migrate recent models to cache:', (error as Error).message)
    }
    delete config.recentModels
    await writeAIConfig(config)
  }
  return config
}

export const getAIConfigDebugPaths = (): AIConfigPaths & { configExists: boolean } => {
  const paths = getAIConfigPaths()
  return { ...paths, configExists: fs.existsSync(paths.configJson) }
}
