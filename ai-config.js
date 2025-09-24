import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

// Get AI speedometer config directory path
const getAIConfigPaths = () => {
  const aiConfigDir = process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config');
  const aiSpeedometerConfigDir = path.join(aiConfigDir, 'ai-speedometer');
  
  return {
    configDir: aiSpeedometerConfigDir,
    configJson: path.join(aiSpeedometerConfigDir, 'ai-benchmark-config.json'),
    recentModelsCache: path.join(aiSpeedometerConfigDir, 'recent-models.json')
  };
};

// Ensure config directory exists
const ensureAIConfigDirectory = () => {
  const { configDir } = getAIConfigPaths();
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
};

// Read and parse ai-benchmark-config.json
export const readAIConfig = async () => {
  const { configJson } = getAIConfigPaths();
  
  try {
    if (!fs.existsSync(configJson)) {
      // Return default empty structure if file doesn't exist
      return {
        verifiedProviders: {},
        customProviders: []
      };
    }
    
    const data = fs.readFileSync(configJson, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('Warning: Could not read ai-benchmark-config.json:', error.message);
    return {
      verifiedProviders: {},
      customProviders: []
    };
  }
};

// Write to ai-benchmark-config.json
export const writeAIConfig = async (config) => {
  const { configJson } = getAIConfigPaths();
  
  try {
    ensureAIConfigDirectory();
    
    // Write the file with proper JSON formatting
    const jsonData = JSON.stringify(config, null, 2);
    fs.writeFileSync(configJson, jsonData);
    
    return true;
  } catch (error) {
    console.error('Error writing ai-benchmark-config.json:', error.message);
    return false;
  }
};

// Add verified provider API key
export const addVerifiedProvider = async (providerId, apiKey) => {
  const config = await readAIConfig();
  
  config.verifiedProviders = config.verifiedProviders || {};
  config.verifiedProviders[providerId] = apiKey;
  
  return await writeAIConfig(config);
};

// Add custom provider
export const addCustomProvider = async (providerData) => {
  const config = await readAIConfig();
  
  config.customProviders = config.customProviders || [];
  
  // Check if provider with same ID already exists
  const existingIndex = config.customProviders.findIndex(p => p.id === providerData.id);
  if (existingIndex >= 0) {
    // Update existing provider
    config.customProviders[existingIndex] = providerData;
  } else {
    // Add new provider
    config.customProviders.push(providerData);
  }
  
  return await writeAIConfig(config);
};

// Add model to existing custom provider
export const addModelToCustomProvider = async (providerId, modelData) => {
  const config = await readAIConfig();
  
  if (!config.customProviders) {
    console.error('No custom providers found');
    return false;
  }
  
  const provider = config.customProviders.find(p => p.id === providerId);
  if (!provider) {
    console.error(`Custom provider ${providerId} not found`);
    return false;
  }
  
  provider.models = provider.models || [];
  
  // Check if model with same ID already exists
  const existingIndex = provider.models.findIndex(m => m.id === modelData.id);
  if (existingIndex >= 0) {
    // Update existing model
    provider.models[existingIndex] = modelData;
  } else {
    // Add new model
    provider.models.push(modelData);
  }
  
  return await writeAIConfig(config);
};

// Get custom providers from config
export const getCustomProvidersFromConfig = async () => {
  const config = await readAIConfig();
  return config.customProviders || [];
};

// Get verified providers from config
export const getVerifiedProvidersFromConfig = async () => {
  const config = await readAIConfig();
  return config.verifiedProviders || {};
};

// Remove custom provider
export const removeCustomProvider = async (providerId) => {
  const config = await readAIConfig();
  
  if (config.customProviders) {
    config.customProviders = config.customProviders.filter(p => p.id !== providerId);
    return await writeAIConfig(config);
  }
  
  return true;
};

// Remove verified provider
export const removeVerifiedProvider = async (providerId) => {
  const config = await readAIConfig();
  
  if (config.verifiedProviders && config.verifiedProviders[providerId]) {
    delete config.verifiedProviders[providerId];
    return await writeAIConfig(config);
  }
  
  return true;
};

// Add models to recent models list (smart addition - no duplicates, max 5)
export const addToRecentModels = async (models) => {
  const { recentModelsCache } = getAIConfigPaths();
  
  // Ensure cache directory exists
  ensureAIConfigDirectory();
  
  // Read existing recent models or create empty array
  let recentModels = [];
  try {
    if (fs.existsSync(recentModelsCache)) {
      const data = fs.readFileSync(recentModelsCache, 'utf8');
      recentModels = JSON.parse(data);
    }
  } catch (error) {
    // If file doesn't exist or is corrupted, start fresh
    recentModels = [];
  }
  
  // Process each model
  models.forEach(model => {
    // Remove existing entry with same modelId to prevent duplicates
    recentModels = recentModels.filter(
      recent => recent.modelId !== model.modelId
    );
    
    // Add new entry to the top (most recent first)
    recentModels.unshift({
      modelId: model.modelId,
      modelName: model.modelName,
      providerName: model.providerName,
      timestamp: Date.now()
    });
  });
  
  // Keep only the 5 most recent models
  recentModels = recentModels.slice(0, 5);
  
  // Write to separate cache file
  fs.writeFileSync(recentModelsCache, JSON.stringify(recentModels, null, 2));
  
  return recentModels;
};

// Get recent models (persists until manually cleared)
export const getRecentModels = async () => {
  const { recentModelsCache } = getAIConfigPaths();
  
  try {
    if (fs.existsSync(recentModelsCache)) {
      const data = fs.readFileSync(recentModelsCache, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    // If file doesn't exist or is corrupted, return empty array
  }
  
  return [];
};

// Clear all recent models (manual cleanup)
export const clearRecentModels = async () => {
  const { recentModelsCache } = getAIConfigPaths();
  
  try {
    if (fs.existsSync(recentModelsCache)) {
      fs.unlinkSync(recentModelsCache);
    }
  } catch (error) {
    // Ignore errors if file doesn't exist
  }
  
  return [];
};

// Clean up recent models from main config file (migration)
export const cleanupRecentModelsFromConfig = async () => {
  const config = await readAIConfig();
  
  if (config.recentModels && config.recentModels.length > 0) {
    // Move recent models to cache file
    const { recentModelsCache } = getAIConfigPaths();
    ensureAIConfigDirectory();
    
    try {
      fs.writeFileSync(recentModelsCache, JSON.stringify(config.recentModels, null, 2));
    } catch (error) {
      console.warn('Warning: Could not migrate recent models to cache:', error.message);
    }
    
    // Remove recent models from main config
    delete config.recentModels;
    await writeAIConfig(config);
  }
  
  return config;
};

// Get config file paths for debugging
export const getAIConfigDebugPaths = () => {
  const paths = getAIConfigPaths();
  const configExists = fs.existsSync(paths.configJson);
  
  return {
    ...paths,
    configExists
  };
};