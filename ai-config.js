import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

// Get AI speedometer config directory path
const getAIConfigPaths = () => {
  const aiConfigDir = process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config');
  const aiSpeedometerConfigDir = path.join(aiConfigDir, 'ai-speedometer');
  
  return {
    configDir: aiSpeedometerConfigDir,
    configJson: path.join(aiSpeedometerConfigDir, 'ai-benchmark-config.json')
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

// Get config file paths for debugging
export const getAIConfigDebugPaths = () => {
  const paths = getAIConfigPaths();
  const configExists = fs.existsSync(paths.configJson);
  
  return {
    ...paths,
    configExists
  };
};