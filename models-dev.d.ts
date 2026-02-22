export interface ProviderInfo {
  id: string
  name: string
  type: string
  baseUrl: string
  models: Array<{ id: string; name: string }>
}

export declare function getAllProviders(): Promise<ProviderInfo[]>
export declare function searchProviders(query: string): Promise<ProviderInfo[]>
export declare function getModelsForProvider(providerId: string): Promise<Array<{ id: string; name: string }>>
export declare function refreshData(): Promise<ProviderInfo[]>
