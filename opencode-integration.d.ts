import type { Provider } from './src/types.ts'

export declare function getAllAvailableProviders(includeAll: boolean): Promise<Provider[]>
export declare function addApiKey(providerId: string, apiKey: string): Promise<boolean>
export declare function getCustomProviders(): Promise<Provider[]>
export declare function migrateFromOldConfig(oldConfig: unknown): Promise<{ migrated: number; failed: number; errors: string[] }>
export declare function getDebugInfo(): Promise<{
  opencodePaths: { authJson: string; opencodeJson: string }
  aiConfigPaths: { configJson: string; configDir: string; configExists: boolean }
  authExists: boolean
  configExists: boolean
  authData: string[]
  aiConfigData: { verifiedProviders: string[]; customProviders: string[] }
  xdgPaths: { data: string; config: string }
}>
export declare function readAuthJson(): Promise<Record<string, unknown>>
