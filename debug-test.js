#!/usr/bin/env node

import { getAllAvailableProviders } from './opencode-integration.js';
import { testPrompt } from './test-prompt.js';

console.log('=== DEBUG: Testing Provider Configuration ===\n');

// Test 1: Load available providers
console.log('1. Loading available providers...');
const providers = await getAllAvailableProviders();
console.log(`Found ${providers.length} providers:`);

providers.forEach((provider, index) => {
  console.log(`\n${index + 1}. ${provider.name} (${provider.type})`);
  console.log(`   ID: ${provider.id}`);
  console.log(`   Base URL: ${provider.baseUrl}`);
  console.log(`   API Key: ${provider.apiKey ? provider.apiKey.slice(0, 8) + '...' : 'MISSING'}`);
  console.log(`   Models: ${provider.models.length}`);
  provider.models.forEach((model, modelIndex) => {
    console.log(`     ${modelIndex + 1}. ${model.name} (ID: ${model.id})`);
  });
});

// Test 2: Try to run a simple benchmark on first provider if available
if (providers.length > 0 && providers[0].models.length > 0) {
  const firstProvider = providers[0];
  const firstModel = firstProvider.models[0];
  
  console.log(`\n2. Testing benchmark on ${firstProvider.name}/${firstModel.name}...`);
  
  try {
    // Test REST API call
    const endpoint = firstProvider.type === 'anthropic' ? '/v1/messages' : '/chat/completions';
    const url = `${firstProvider.baseUrl}${endpoint}`;
    
    console.log(`   URL: ${url}`);
    console.log(`   Provider Type: ${firstProvider.type}`);
    console.log(`   Request Model Name: ${firstModel.name}`);
    console.log(`   Request Model ID: ${firstModel.id}`);
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${firstProvider.apiKey}`
    };

    if (firstProvider.type === 'anthropic') {
      headers['x-api-key'] = firstProvider.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    }

    const body = {
      model: firstModel.name,
      messages: [
        { role: 'user', content: testPrompt }
      ],
      max_tokens: 100,
      temperature: 0.7
    };

    if (firstProvider.type === 'anthropic') {
      body.max_tokens = 100;
    }

    console.log('   Making API request...');
    console.log(`   Request body: ${JSON.stringify(body, null, 2)}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    console.log(`   Response status: ${response.status}`);
    console.log(`   Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   Error response: ${errorText}`);
    } else {
      const data = await response.json();
      console.log('   Success! Response structure:');
      
      if (firstProvider.type === 'anthropic') {
        console.log(`     Content: ${data.content?.[0]?.text?.slice(0, 100)}...`);
        console.log(`     Usage: ${JSON.stringify(data.usage, null, 2)}`);
      } else {
        console.log(`     Content: ${data.choices?.[0]?.message?.content?.slice(0, 100)}...`);
        console.log(`     Usage: ${JSON.stringify(data.usage, null, 2)}`);
      }
    }
    
  } catch (error) {
    console.log(`   ERROR: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  }
} else {
  console.log('\n2. No providers or models available to test');
}

// Test 3: Try with different model name formats
if (providers.length > 1) {
  const secondProvider = providers[1];
  const secondModel = secondProvider.models[0];
  
  console.log(`\n3. Testing benchmark on ${secondProvider.name}/${secondModel.name} with different model name formats...`);
  
  try {
    const endpoint = secondProvider.type === 'anthropic' ? '/v1/messages' : '/chat/completions';
    const url = `${secondProvider.baseUrl}${endpoint}`;
    
    console.log(`   URL: ${url}`);
    console.log(`   Provider Type: ${secondProvider.type}`);
    console.log(`   Original Model Name: ${secondModel.name}`);
    console.log(`   Original Model ID: ${secondModel.id}`);
    
    // Try with different model name formats
    const modelFormats = [
      secondModel.name, // Original display name
      secondModel.id.split('_')[1], // Extract actual model ID
      secondModel.id.replace(`${secondProvider.id}_`, ''), // Remove provider prefix
    ];
    
    for (let i = 0; i < modelFormats.length; i++) {
      const modelName = modelFormats[i];
      console.log(`\n   Attempt ${i + 1}: Using model name "${modelName}"`);
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secondProvider.apiKey}`
      };

      if (secondProvider.type === 'anthropic') {
        headers['x-api-key'] = secondProvider.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      }

      const body = {
        model: modelName,
        messages: [
          { role: 'user', content: testPrompt }
        ],
        max_tokens: 50,
        temperature: 0.7
      };

      if (secondProvider.type === 'anthropic') {
        body.max_tokens = 50;
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(body)
        });

        console.log(`     Response status: ${response.status}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log(`     SUCCESS! Model format "${modelName}" works!`);
          console.log(`     Content: ${data.choices?.[0]?.message?.content?.slice(0, 50)}...`);
          console.log(`     Usage: ${JSON.stringify(data.usage, null, 2)}`);
          break; // Stop on first success
        } else {
          const errorText = await response.text();
          console.log(`     Failed: ${errorText.slice(0, 100)}...`);
        }
      } catch (error) {
        console.log(`     ERROR: ${error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`   ERROR: ${error.message}`);
  }
}

console.log('\n=== DEBUG COMPLETE ===');