import fs from 'fs';
import path from 'path';
import { homedir } from 'os';
import { getAllProviders, getModelsForProvider } from './models-dev.js';
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

// Write to opencode.json with proper error handling
export const writeOpencodeConfig = async (config) => {
  const { opencodeJson } = getFilePaths();
  
  try {
    ensureDirectories();
    
    // Write the file with proper JSON formatting
    const jsonData = JSON.stringify(config, null, 2);
    fs.writeFileSync(opencodeJson, jsonData);
    
    return true;
  } catch (error) {
    console.error('Error writing opencode.json:', error.message);
    return false;
  }
};

// Read and parse opencode.json with robust JSONC parsing (matching opencode's approach)
export const readOpencodeConfig = async () => {
  const { opencodeJson } = getFilePaths();
  
  try {
    if (!fs.existsSync(opencodeJson)) {
      return { provider: {} };
    }
    
    const data = fs.readFileSync(opencodeJson, 'utf8');
    const errors = [];
    const config = parseJsonc(data, errors, { allowTrailingComma: true });
    
    if (errors.length > 0) {
      console.warn('Warning: JSONC parsing errors in opencode.json:', errors.map(e => e.error).join(', '));
      // Try to return what we could parse
      if (config && typeof config === 'object') {
        if (!config.provider) {
          config.provider = {};
        }
        return config;
      }
      return { provider: {} };
    }
    
    // Ensure provider section exists
    if (!config.provider) {
      config.provider = {};
    }
    
    return config;
  } catch (error) {
    console.warn('Warning: Could not read opencode.json:', error.message);
    return { provider: {} };
  }
};

// Get providers with valid API keys from auth.json
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

// Get custom providers from opencode.json
export const getCustomProviders = async () => {
  const config = await readOpencodeConfig();
  const customProviders = [];
  
  for (const [providerId, providerConfig] of Object.entries(config.provider || {})) {
    // Skip if this looks like a verified provider override
    if (providerConfig.options && !providerConfig.models) {
      continue;
    }
    
    // Extract models from the provider config
    const models = [];
    
    // If models are defined in the config
    if (providerConfig.models) {
      for (const [modelId, modelConfig] of Object.entries(providerConfig.models)) {
        const modelName = modelConfig.name || modelId;
        models.push({
          name: modelName.trim(), // Trim any trailing spaces
          id: `${providerId}_${modelId}`
        });
      }
    }
    
    // Extract baseUrl and apiKey from options
    const baseUrl = providerConfig.options?.baseURL || providerConfig.baseUrl;
    const apiKey = providerConfig.options?.apiKey || '';
    
    // Determine provider type based on npm field or fallback
    let providerType = 'openai-compatible'; // default
    if (providerConfig.npm === '@ai-sdk/anthropic') {
      providerType = 'anthropic';
    } else if (providerConfig.npm === '@ai-sdk/google') {
      providerType = 'google';
    } else if (providerConfig.npm === '@ai-sdk/openai') {
      providerType = 'openai';
    }
    
    // Only add if we have models or it's a custom provider configuration
    if (models.length > 0 || providerConfig.options) {
      customProviders.push({
        id: providerId,
        name: providerConfig.name || providerId,
        type: providerType,
        baseUrl: baseUrl,
        apiKey: apiKey,
        models: models
      });
    }
  }
  
  return customProviders;
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

// Get all available providers (authenticated + custom)
export const getAllAvailableProviders = async () => {
  const [authenticatedProviders, customProviders] = await Promise.all([
    getAuthenticatedProviders(),
    getCustomProviders()
  ]);
  
  return [...authenticatedProviders, ...customProviders];
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

// Migration helper: Import from old config format
export const migrateFromOldConfig = async (oldConfig) => {
  const results = {
    migrated: 0,
    failed: 0,
    errors: []
  };
  
  try {
    // Migrate verified providers
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
    
    // Migrate custom providers to opencode.json format
    if (oldConfig.customProviders && oldConfig.customProviders.length > 0) {
      const config = await readOpencodeConfig();
      
      for (const provider of oldConfig.customProviders) {
        try {
          // Convert to opencode.json format
          config.provider[provider.id] = {
            name: provider.name,
            options: {
              apiKey: provider.apiKey,
              baseURL: provider.baseUrl
            },
            models: {}
          };
          
          // Add models
          for (const model of provider.models) {
            config.provider[provider.id].models[model.id.replace(`${provider.id}_`, '')] = {
              name: model.name
            };
          }
          
          results.migrated++;
        } catch (error) {
          results.failed++;
          results.errors.push(`Failed to migrate custom provider ${provider.name}: ${error.message}`);
        }
      }
      
      // Save the updated config
      await writeOpencodeConfig(config);
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
  const paths = getFilePaths();
  const [authData, configData] = await Promise.all([
    readAuthJson(),
    readOpencodeConfig()
  ]);
  
  const authExists = fs.existsSync(paths.authJson);
  const configExists = fs.existsSync(paths.opencodeJson);
  
  return {
    paths,
    authExists,
    configExists,
    authData: Object.keys(authData),
    configProviders: Object.keys(configData.provider || {}),
    xdgPaths: getXDGPaths()
  };
};