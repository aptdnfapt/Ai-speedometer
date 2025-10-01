import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

// Import custom providers as embedded data
import customVerifiedProvidersData from './custom-verified-providers.json' with { type: 'json' };

// Cache directory and file paths
const CACHE_DIR = path.join(homedir(), '.cache', 'ai-speedometer');
const CACHE_FILE = path.join(CACHE_DIR, 'models.json');

// Fallback data (baked-in at build time)
const FALLBACK_PROVIDERS = [
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
];

// Ensure cache directory exists
function ensureCacheDir() {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
  } catch (error) {
    console.warn('Warning: Could not create cache directory:', error.message);
  }
}

// Check if cache is expired (1 hour)
function isCacheExpired(cacheData) {
  if (!cacheData.timestamp) return true;
  const now = Date.now();
  const cacheAge = now - cacheData.timestamp;
  const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
  return cacheAge > oneHour;
}

// Load cached data
function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      
      // Check if cache is expired
      if (isCacheExpired(parsed)) {
        return null;
      }
      
      return parsed;
    }
  } catch (error) {
    console.warn('Warning: Could not load cache:', error.message);
  }
  return null;
}

// Save data to cache
function saveCache(data) {
  try {
    ensureCacheDir();
    const cacheData = {
      ...data,
      timestamp: Date.now()
    };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
  } catch (error) {
    console.warn('Warning: Could not save cache:', error.message);
  }
}

// Fetch data from models.dev API
async function fetchFromAPI() {
  try {
    const response = await fetch('https://models.dev/api.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.warn('Warning: Could not fetch from models.dev API:', error.message);
    return null;
  }
}

// Load custom verified providers from embedded data (with filesystem fallback for development)
function loadCustomVerifiedProviders() {
  try {
    // Use embedded data first (will be available in built binary)
    let customProviders = customVerifiedProvidersData;
    
    // In development, try to load from filesystem for live updates
    const customProvidersPath = path.join(process.cwd(), 'custom-verified-providers.json');
    if (fs.existsSync(customProvidersPath)) {
      try {
        const customData = fs.readFileSync(customProvidersPath, 'utf8');
        customProviders = JSON.parse(customData);
      } catch (fileError) {
        console.warn('Warning: Could not load custom providers from file, using embedded data:', fileError.message);
        // Fall back to embedded data
      }
    }
    
    // Transform the custom providers to match our format
    const providers = [];
    
    if (customProviders['custom-verified-providers']) {
      for (const [, providerData] of Object.entries(customProviders['custom-verified-providers'])) {
        // Skip the extra-models-dev section as it's handled separately
        if (providerData.id === 'extra-models-dev') {
          continue;
        }
        
        if (providerData.id && providerData.name && providerData.models) {
          const provider = {
            id: providerData.id,
            name: providerData.name,
            baseUrl: providerData.baseUrl || '',
            type: providerData.type || 'openai-compatible',
            models: Object.values(providerData.models).map(model => ({
              id: model.id,
              name: model.name
            }))
          };
          providers.push(provider);
        }
      }
    }
    
    return providers;
  } catch (error) {
    console.warn('Warning: Could not load custom verified providers:', error.message);
  }
  return [];
}

// Load extra models from embedded data (with filesystem fallback for development)
function loadExtraModels() {
  try {
    // Use embedded data first (will be available in built binary)
    let customProviders = customVerifiedProvidersData;
    
    // In development, try to load from filesystem for live updates
    const customProvidersPath = path.join(process.cwd(), 'custom-verified-providers.json');
    if (fs.existsSync(customProvidersPath)) {
      try {
        const customData = fs.readFileSync(customProvidersPath, 'utf8');
        customProviders = JSON.parse(customData);
      } catch (fileError) {
        console.warn('Warning: Could not load extra models from file, using embedded data:', fileError.message);
        // Fall back to embedded data
      }
    }
    
    const extraModels = {};
    
    if (customProviders['custom-verified-providers'] && customProviders['custom-verified-providers']['extra-models-dev']) {
      for (const [providerId, models] of Object.entries(customProviders['custom-verified-providers']['extra-models-dev'])) {
        extraModels[providerId] = Object.values(models).map(model => ({
          id: model.id,
          name: model.name
        }));
      }
    }
    
    return extraModels;
  } catch (error) {
    console.warn('Warning: Could not load extra models:', error.message);
  }
  return {};
}

// Transform models.dev data to our format
function transformModelsDevData(apiData) {
  const providers = [];
  
  // Load custom verified providers first
  const customProviders = loadCustomVerifiedProviders();
  providers.push(...customProviders);
  
  // Load extra models from custom-verified-providers.json
  const extraModels = loadExtraModels();
  
  // If API data is available, add models.dev providers
  if (apiData) {
    for (const [, providerData] of Object.entries(apiData)) {
      if (providerData.id && providerData.name && providerData.models) {
        // Start with models from models.dev
        const models = Object.values(providerData.models).map(model => ({
          id: model.id,
          name: model.name
        }));
        
        // Add extra models if they exist for this provider
        if (extraModels[providerData.id]) {
          models.push(...extraModels[providerData.id]);
        }
        
        const provider = {
          id: providerData.id,
          name: providerData.name,
          baseUrl: providerData.api || providerData.baseUrl || '',
          type: providerData.npm ? 
            (providerData.npm.includes('anthropic') ? 'anthropic' : 'openai-compatible') : 
            'openai-compatible',
          models: models
        };
        providers.push(provider);
      }
    }
  }

  // If no providers (neither custom nor API), use fallback
  if (providers.length === 0) {
    return FALLBACK_PROVIDERS;
  }

  return providers;
}

// Get all providers (with caching and fallback)
async function getAllProviders() {
  // Try to load from cache first
  const cachedData = loadCache();
  if (cachedData && cachedData.providers) {
    // Ensure custom verified providers are included in cached data
    const customVerifiedProviders = loadCustomVerifiedProviders();
    const existingIds = new Set(cachedData.providers.map(p => p.id));
    const missingCustomProviders = customVerifiedProviders.filter(p => !existingIds.has(p.id));

    if (missingCustomProviders.length > 0) {
      cachedData.providers.push(...missingCustomProviders);
    }

    return cachedData.providers;
  }

  // Try to fetch from API
  const apiData = await fetchFromAPI();
  if (apiData) {
    const transformedData = transformModelsDevData(apiData);
    saveCache({ providers: transformedData });
    return transformedData;
  }

  // Fallback to built-in data, but add extra models and custom verified providers
  const fallbackProviders = [...FALLBACK_PROVIDERS];
  const extraModels = loadExtraModels();
  const customVerifiedProviders = loadCustomVerifiedProviders();

  // Add extra models to fallback providers
  fallbackProviders.forEach(provider => {
    if (extraModels[provider.id]) {
      provider.models.push(...extraModels[provider.id]);
    }
  });

  // Add custom verified providers to fallback
  fallbackProviders.push(...customVerifiedProviders);

  return fallbackProviders;
}

// Search providers by query
async function searchProviders(query) {
  const providers = await getAllProviders();
  const lowercaseQuery = query.toLowerCase();
  
  return providers.filter(provider => 
    provider.name.toLowerCase().includes(lowercaseQuery) ||
    provider.id.toLowerCase().includes(lowercaseQuery)
  );
}

// Get models for a specific provider
async function getModelsForProvider(providerId) {
  const providers = await getAllProviders();
  const provider = providers.find(p => p.id === providerId);
  return provider ? provider.models : [];
}

// Force refresh data from API
async function refreshData() {
  const apiData = await fetchFromAPI();
  if (apiData) {
    const transformedData = transformModelsDevData(apiData);
    saveCache({ providers: transformedData });
    return transformedData;
  }
  
  // If API fails, try to use cached data
  const cachedData = loadCache();
  if (cachedData && cachedData.providers) {
    return cachedData.providers;
  }
  
  // Ultimate fallback with extra models
  const fallbackProviders = [...FALLBACK_PROVIDERS];
  const extraModels = loadExtraModels();
  
  // Add extra models to fallback providers
  fallbackProviders.forEach(provider => {
    if (extraModels[provider.id]) {
      provider.models.push(...extraModels[provider.id]);
    }
  });
  
  return fallbackProviders;
}

// Clear cache
function clearCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      fs.unlinkSync(CACHE_FILE);
    }
  } catch (error) {
    console.warn('Warning: Could not clear cache:', error.message);
  }
}

export {
  getAllProviders,
  searchProviders,
  getModelsForProvider,
  refreshData,
  clearCache,
  fetchFromAPI,
  transformModelsDevData,
  loadCustomVerifiedProviders
};