import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import { getAllProviders, getModelsForProvider, loadCustomVerifiedProviders } from './models-dev.js';
import { parse as parseJsonc } from 'jsonc-parser';

// XDG Base Directory paths (matching opencode's implementation)
const getXDGPaths = () => {
  const xdgData = process.env.XDG_DATA_HOME || path.join(homedir(), '.local', 'share');
  const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config');
  
  return {
    data: path.join(xdgData, 'opencode'),
    config: path.join(xdgConfig, 'opencode')
  };
};

// File paths
const getFilePaths = () => {
  const paths = getXDGPaths();
  return {
    authJson: path.join(paths.data, 'auth.json'),
    opencodeJson: path.join(paths.config, 'opencode.json')
  };
};

// Ensure directories exist
const ensureDirectories = () => {
  const paths = getXDGPaths();
  
  [paths.data, paths.config].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
};

// Read and parse auth.json with robust JSONC parsing
export const readAuthJson = async () => {
  const { authJson } = getFilePaths();
  
  try {
    if (!fs.existsSync(authJson)) {
      return {};
    }
    
    const data = fs.readFileSync(authJson, 'utf8');
    const errors = [];
    const parsed = parseJsonc(data, errors, { allowTrailingComma: true });
    
    if (errors.length > 0) {
      console.warn('Warning: JSONC parsing errors in auth.json:', errors.map(e => e.error).join(', '));
      // Try to return what we could parse
      return parsed || {};
    }
    
    return parsed;
  } catch (error) {
    console.warn('Warning: Could not read auth.json:', error.message);
    return {};
  }
};

// Write to auth.json with proper permissions and error handling
export const writeAuthJson = async (authData) => {
  const { authJson } = getFilePaths();
  
  try {
    ensureDirectories();
    
    // Write the file with proper JSON formatting
    const jsonData = JSON.stringify(authData, null, 2);
    fs.writeFileSync(authJson, jsonData);
    
    // Set proper permissions (0o600 - read/write for owner only)
    fs.chmodSync(authJson, 0o600);
    
    return true;
  } catch (error) {
    console.error('Error writing auth.json:', error.message);
    return false;
  }
};

// Write to opencode.json - deprecated function, kept for compatibility
export const writeOpencodeConfig = async () => {
  console.warn('Warning: opencode.json is no longer used. Use ai-benchmark-config.json instead.');
  return false;
};

// Read and parse opencode.json - deprecated function, kept for compatibility
export const readOpencodeConfig = async () => {
  console.warn('Warning: opencode.json is no longer used. Use ai-benchmark-config.json instead.');
  return { provider: {} };
};

// Get providers with valid API keys from auth.json (verified providers only)
export const getAuthenticatedProviders = async () => {
  const authData = await readAuthJson();
  const allProviders = await getAllProviders();
  
  const authenticatedProviders = [];
  
  for (const [providerId, authInfo] of Object.entries(authData)) {
    // Find provider in models.dev
    const providerInfo = allProviders.find(p => p.id === providerId);
    
    if (providerInfo && authInfo.type === 'api' && authInfo.key) {
      // Get models for this provider
      const models = await getModelsForProvider(providerId);
      
      authenticatedProviders.push({
        id: providerId,
        name: providerInfo.name,
        type: providerInfo.type, // Use the actual provider type from models.dev
        baseUrl: providerInfo.baseUrl,
        apiKey: authInfo.key,
        authType: authInfo.type,
        models: models.map(model => ({
          name: model.name,
          id: `${providerId}_${model.id}`
        }))
      });
    }
  }
  
  return authenticatedProviders;
};

// Get custom providers - now always returns empty array since we don't use opencode.json anymore
// This function is kept for compatibility but will be deprecated
export const getCustomProviders = async () => {
  return [];
};

// Verify provider exists in models.dev
export const verifyProvider = async (providerId) => {
  try {
    const allProviders = await getAllProviders();
    return allProviders.find(p => p.id === providerId);
  } catch (error) {
    console.warn('Warning: Could not verify provider:', error.message);
    return null;
  }
};

// Add API key to auth.json
export const addApiKey = async (providerId, apiKey) => {
  const authData = await readAuthJson();
  
  // Add or update the provider
  authData[providerId] = {
    type: 'api',
    key: apiKey
  };
  
  return await writeAuthJson(authData);
};

// Remove API key from auth.json
export const removeApiKey = async (providerId) => {
  const authData = await readAuthJson();
  
  if (authData[providerId]) {
    delete authData[providerId];
    return await writeAuthJson(authData);
  }
  
  return true;
};

// Get all available providers (authenticated from auth.json + custom from ai-benchmark-config.json + custom verified from custom-verified-providers.json)
export const getAllAvailableProviders = async () => {
  const [authenticatedProviders, customProvidersFromConfig, customVerifiedProviders] = await Promise.all([
    getAuthenticatedProviders(),
    (async () => {
      try {
        const { getCustomProvidersFromConfig } = await import('./ai-config.js');
        return await getCustomProvidersFromConfig();
      } catch (error) {
        console.warn('Warning: Could not load custom providers:', error.message);
        return [];
      }
    })(),
    (async () => {
      try {
        return loadCustomVerifiedProviders();
      } catch (error) {
        console.warn('Warning: Could not load custom verified providers:', error.message);
        return [];
      }
    })()
  ]);

  // Deduplicate providers by ID, with authenticated providers taking precedence
  const providerMap = new Map();

  // Add custom verified providers first (lower priority)
  customVerifiedProviders.forEach(provider => {
    providerMap.set(provider.id, provider);
  });

  // Add custom providers from config (medium priority)
  customProvidersFromConfig.forEach(provider => {
    providerMap.set(provider.id, provider);
  });

  // Add authenticated providers last (highest priority - they have API keys)
  authenticatedProviders.forEach(provider => {
    providerMap.set(provider.id, provider);
  });

  return Array.from(providerMap.values());
};

// Check if a provider is authenticated
export const isProviderAuthenticated = async (providerId) => {
  const authData = await readAuthJson();
  return authData[providerId] && authData[providerId].type === 'api';
};

// Get provider authentication info
export const getProviderAuth = async (providerId) => {
  const authData = await readAuthJson();
  return authData[providerId] || null;
};

// Migration helper: Import from old config format to new ai-benchmark-config.json
export const migrateFromOldConfig = async (oldConfig) => {
  const results = {
    migrated: 0,
    failed: 0,
    errors: []
  };
  
  try {
    // Migrate verified providers to auth.json
    if (oldConfig.verifiedProviders) {
      for (const [providerId, apiKey] of Object.entries(oldConfig.verifiedProviders)) {
        const providerInfo = await verifyProvider(providerId);
        
        if (providerInfo) {
          const success = await addApiKey(providerId, apiKey);
          if (success) {
            results.migrated++;
          } else {
            results.failed++;
            results.errors.push(`Failed to migrate ${providerId}`);
          }
        } else {
          results.failed++;
          results.errors.push(`Provider ${providerId} not found in models.dev`);
        }
      }
    }
    
    // Migrate custom providers to ai-benchmark-config.json format
    if (oldConfig.customProviders && oldConfig.customProviders.length > 0) {
      try {
        const { addCustomProvider, readAIConfig, writeAIConfig } = await import('./ai-config.js');
        const config = await readAIConfig();
        
        for (const provider of oldConfig.customProviders) {
          try {
            // Convert to ai-benchmark-config.json format
            const providerData = {
              id: provider.id,
              name: provider.name,
              type: provider.type,
              baseUrl: provider.baseUrl,
              apiKey: provider.apiKey,
              models: provider.models || []
            };
            
            // Add to config
            config.customProviders = config.customProviders || [];
            config.customProviders.push(providerData);
            
            results.migrated++;
          } catch (error) {
            results.failed++;
            results.errors.push(`Failed to migrate custom provider ${provider.name}: ${error.message}`);
          }
        }
        
        // Save the updated config
        await writeAIConfig(config);
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to migrate custom providers: ${error.message}`);
      }
    }
    
    return results;
  } catch (error) {
    results.failed++;
    results.errors.push(`Migration failed: ${error.message}`);
    return results;
  }
};

// Export utility functions for debugging
export const getDebugInfo = async () => {
  const opencodePaths = getFilePaths();
  const [authData, aiConfigPaths] = await Promise.all([
    readAuthJson(),
    (async () => {
      try {
        const { getAIConfigPaths } = await import('./ai-config.js');
        return await getAIConfigPaths();
      } catch (error) {
        return { configDir: 'N/A', configJson: 'N/A', configExists: false };
      }
    })()
  ]);
  
  const authExists = fs.existsSync(opencodePaths.authJson);
  const configExists = fs.existsSync(opencodePaths.opencodeJson);
  
  // Get ai-benchmark-config.json data
  let aiConfigData = { verifiedProviders: {}, customProviders: [] };
  try {
    const { readAIConfig } = await import('./ai-config.js');
    aiConfigData = await readAIConfig();
  } catch (error) {
    // Ignore if ai-config is not available
  }
  
  return {
    opencodePaths,
    authExists,
    configExists,
    authData: Object.keys(authData),
    configProviders: [], // No longer used
    aiConfigPaths,
    aiConfigData: {
      verifiedProviders: Object.keys(aiConfigData.verifiedProviders || {}),
      customProviders: (aiConfigData.customProviders || []).map(p => p.id)
    },
    xdgPaths: getXDGPaths()
  };
};