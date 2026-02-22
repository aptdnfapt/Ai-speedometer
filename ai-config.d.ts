export declare function readAIConfig(): Promise<unknown>
export declare function getCustomProvidersFromConfig(): Promise<import('./src/types.ts').Provider[]>
export declare function getVerifiedProvidersFromConfig(): Promise<import('./src/types.ts').Provider[]>
export declare function addCustomProvider(data: unknown): Promise<boolean>
export declare function addModelToCustomProvider(providerId: string, model: unknown): Promise<boolean>
export declare function addVerifiedProvider(providerId: string, apiKey: string): Promise<boolean>
export declare function getAIConfigDebugPaths(): Promise<unknown>
export declare function addToRecentModels(models: Array<{ modelId: string; modelName: string; providerName: string }>): Promise<void>
export declare function getRecentModels(): Promise<Array<{ modelId: string; modelName: string; providerName: string }>>
export declare function cleanupRecentModelsFromConfig(): Promise<void>
