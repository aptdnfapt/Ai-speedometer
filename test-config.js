#!/usr/bin/env node

import { loadConfig, saveConfig } from './cli.js';
import fs from 'fs';

async function testConfig() {
  console.log('Testing simplified config structure...');
  
  // Test 1: Load config that doesn't exist
  console.log('\n1. Testing loading non-existent config...');
  let config = await loadConfig();
  console.log('Loaded config:', JSON.stringify(config, null, 2));
  
  // Test 2: Create a config with both verified and custom providers
  console.log('\n2. Testing saving config with both provider types...');
  config.providers = [
    {
      id: 'openai',
      name: 'OpenAI',
      type: 'verified',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test-openai',
      models: []
    },
    {
      id: 'custom-123',
      name: 'My Custom Provider',
      type: 'openai-compatible',
      baseUrl: 'https://api.custom.com/v1',
      apiKey: 'sk-test-custom',
      models: [
        { name: 'custom-model', id: 'custom_1' }
      ]
    }
  ];
  
  await saveConfig(config);
  console.log('Config saved successfully');
  
  // Test 3: Load the saved config
  console.log('\n3. Testing loading saved config...');
  const loadedConfig = await loadConfig();
  console.log('Loaded config:', JSON.stringify(loadedConfig, null, 2));
  
  // Test 4: Check the actual file content
  console.log('\n4. Checking actual file content...');
  const fileContent = fs.readFileSync('ai-benchmark-config.json', 'utf8');
  console.log('File content:', fileContent);
  
  // Clean up
  fs.unlinkSync('ai-benchmark-config.json');
  console.log('\nTest completed and cleaned up!');
}

testConfig().catch(console.error);