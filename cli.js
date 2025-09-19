#!/usr/bin/env node

import readline from 'readline';
import fs from 'fs';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';  // Changed from streamText to generateText
import { testPrompt } from './test-prompt.js';
import { LLMBenchmark, ParallelBenchmark } from './benchmark-rest.js';
import 'dotenv/config';
import Table from 'cli-table3';

// Create a custom Anthropic provider function that supports baseUrl
function createAnthropicProvider(baseUrl, apiKey) {
  return anthropic({
    apiKey: apiKey,
    baseUrl: baseUrl
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

function colorText(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

// Enable raw mode for keyboard input (if available)
try {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
} catch (e) {
  // Fallback for environments without raw mode
}

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function clearScreen() {
  console.clear();
}

function showHeader() {
  console.log(colorText('Ai-speedometer', 'cyan'));
  console.log(colorText('=============================', 'cyan'));
  console.log(colorText('Note: opencode uses ai-sdk', 'dim'));
  console.log('');
}

// Configuration management
const CONFIG_FILE = 'ai-benchmark-config.json';

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log(colorText('Error loading config, starting fresh: ', 'yellow') + error.message);
  }
  return { providers: [] };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.log(colorText('Error saving config: ', 'red') + error.message);
  }
}

// Keyboard input handling
function getKeyPress() {
  return new Promise(resolve => {
    if (process.stdin.isRaw) {
      process.stdin.once('data', key => {
        if (key === '\u0003') {
          process.exit(0);
        }
        resolve(key);
      });
    } else {
      rl.question(colorText('Press Enter to continue...', 'yellow'), () => {
        resolve('\r');
      });
    }
  });
}

// Circular model selection with arrow keys
async function selectModelsCircular() {
  clearScreen();
  showHeader();
  console.log(colorText('Select Models for Benchmark', 'magenta'));
  console.log('');
  
  const config = loadConfig();
  
  if (config.providers.length === 0) {
    console.log(colorText('No providers available. Please add a provider first.', 'red'));
    await question(colorText('Press Enter to continue...', 'yellow'));
    return [];
  }
  
  const allModels = [];
  config.providers.forEach(provider => {
    provider.models.forEach(model => {
      allModels.push({
        ...model,
        providerName: provider.name,
        providerType: provider.type,
        providerId: provider.id,
        providerConfig: provider,
        selected: false
      });
    });
  });
  
  if (process.stdin.isRaw) {
    console.log(colorText('Use ↑↓ arrows to navigate, SPACE to select/deselect, ENTER to confirm', 'cyan'));
    console.log(colorText('Navigation is circular - moving past bottom/top wraps around', 'dim'));
    console.log(colorText('Circle states: ●=Current+Selected  ○=Current+Unselected  ●=Selected  ○=Unselected', 'dim'));
    console.log(colorText('Press "A" to select all models, "N" to deselect all', 'dim'));
    console.log('');
    
    let currentIndex = 0;
    
    while (true) {
      clearScreen();
      showHeader();
      console.log(colorText('Select Models for Benchmark', 'magenta'));
      console.log('');
console.log(colorText('Use ↑↓ arrows to navigate, SPACE to select/deselect, ENTER to confirm', 'cyan'));
    console.log(colorText('Navigation is circular - moving past bottom/top wraps around', 'dim'));
    console.log(colorText('Press "A" to select all models, "N" to deselect all', 'cyan'));
    console.log(colorText('Circle states: ●=Current+Selected  ○=Current+Unselected  ●=Selected  ○=Unselected', 'dim'));
    console.log('');
      
      // Display models in a vertical layout with single circle
      console.log(colorText('Available Models:', 'yellow'));
      console.log('');
      
      allModels.forEach((model, index) => {
        const isCurrent = index === currentIndex;
        const isSelected = model.selected;
        
        // Single circle that shows both current state and selection
        let circle;
        if (isCurrent && isSelected) {
          circle = colorText('●', 'green'); // Current and selected - filled green
        } else if (isCurrent && !isSelected) {
          circle = colorText('○', 'green'); // Current but not selected - empty green
        } else if (!isCurrent && isSelected) {
          circle = colorText('●', 'cyan'); // Selected but not current - filled cyan
        } else {
          circle = colorText('○', 'dim'); // Not current and not selected - empty dim
        }
        
        // Model name highlighting
        let modelName = isCurrent ? colorText(model.name, 'bright') : colorText(model.name, 'white');
        
        // Provider name
        let providerName = isCurrent ? colorText(`(${model.providerName})`, 'cyan') : colorText(`(${model.providerName})`, 'dim');
        
        console.log(`${circle} ${modelName} ${providerName}`);
      });
      
      console.log('');
      console.log(colorText(`Selected: ${allModels.filter(m => m.selected).length} models`, 'yellow'));
      
      const key = await getKeyPress();
      
      if (key === '\u001b[A') {
        // Up arrow - circular navigation
        currentIndex = (currentIndex - 1 + allModels.length) % allModels.length;
      } else if (key === '\u001b[B') {
        // Down arrow - circular navigation
        currentIndex = (currentIndex + 1) % allModels.length;
      } else if (key === ' ') {
        // Spacebar
        allModels[currentIndex].selected = !allModels[currentIndex].selected;
      } else if (key === 'a' || key === 'A') {
        // Select all models
        allModels.forEach(model => model.selected = true);
      } else if (key === 'n' || key === 'N') {
        // Deselect all models (None)
        allModels.forEach(model => model.selected = false);
      } else if (key === '\r') {
        // Enter
        break;
      } else if (key === '\u0003') {
        // Ctrl+C
        process.exit(0);
      }
    }
    
    return allModels.filter(m => m.selected);
  } else {
    // Fallback to arrow key navigation
    let currentIndex = 0;
    
    while (true) {
      clearScreen();
      showHeader();
      console.log(colorText('Select Models for Benchmark', 'magenta'));
      console.log(colorText('Use ↑↓ arrows to navigate, SPACE to select/deselect, ENTER to confirm', 'cyan'));
      console.log(colorText('Navigation is circular - moving past bottom/top wraps around', 'dim'));
      console.log(colorText('Press "A" to select all models, "N" to deselect all', 'cyan'));
      console.log(colorText('Circle states: ●=Current+Selected  ○=Current+Unselected  ●=Selected  ○=Unselected', 'dim'));
      console.log('');
      
      console.log(colorText('Available Models:', 'yellow'));
      console.log('');
      
      allModels.forEach((model, index) => {
        const isCurrent = index === currentIndex;
        const isSelected = model.selected;
        
        // Single circle that shows both current state and selection
        let circle;
        if (isCurrent && isSelected) {
          circle = colorText('●', 'green'); // Current and selected - filled green
        } else if (isCurrent && !isSelected) {
          circle = colorText('○', 'green'); // Current but not selected - empty green
        } else if (!isCurrent && isSelected) {
          circle = colorText('●', 'cyan'); // Selected but not current - filled cyan
        } else {
          circle = colorText('○', 'dim'); // Not current and not selected - empty dim
        }
        
        // Model name highlighting
        let modelName = isCurrent ? colorText(model.name, 'bright') : colorText(model.name, 'white');
        
        // Provider name
        let providerName = isCurrent ? colorText(`(${model.providerName})`, 'cyan') : colorText(`(${model.providerName})`, 'dim');
        
        console.log(`${circle} ${modelName} ${providerName}`);
      });
      
      console.log('');
      console.log(colorText(`Selected: ${allModels.filter(m => m.selected).length} models`, 'yellow'));
      
      const key = await getKeyPress();
      
      if (key === '\u001b[A') {
        // Up arrow - circular navigation
        currentIndex = (currentIndex - 1 + allModels.length) % allModels.length;
      } else if (key === '\u001b[B') {
        // Down arrow - circular navigation
        currentIndex = (currentIndex + 1) % allModels.length;
      } else if (key === ' ') {
        // Spacebar
        allModels[currentIndex].selected = !allModels[currentIndex].selected;
      } else if (key === 'a' || key === 'A') {
        // Select all models
        allModels.forEach(model => model.selected = true);
      } else if (key === 'n' || key === 'N') {
        // Deselect all models (None)
        allModels.forEach(model => model.selected = false);
      } else if (key === '\r') {
        // Enter
        break;
      } else if (key === '\u0003') {
        // Ctrl+C
        process.exit(0);
      }
    }
    
    return allModels.filter(m => m.selected);
  }
}

// Enhanced benchmark with streaming (run in parallel)
async function runStreamingBenchmark(models) {
  if (models.length === 0) {
    console.log(colorText('No models selected for benchmarking.', 'red'));
    return;
  }
  
  clearScreen();
  showHeader();
  console.log(colorText('Running Benchmark...', 'green'));
  console.log(colorText(`Running ${models.length} models in parallel...`, 'cyan'));
  console.log('');
  
  // Create a function to benchmark a single model
  const benchmarkModel = async (model) => {
    console.log(colorText(`Testing ${model.name} (${model.providerName})...`, 'yellow'));
    
    try {
      let firstTokenTime = null;
      let tokenCount = 0;
      let startTime = Date.now();
      
      const result = streamText({
        ...(model.providerType === 'openai-compatible' ? {
          model: createOpenAICompatible({
            name: model.providerName,
            apiKey: model.providerConfig.apiKey,
            baseURL: model.providerConfig.baseUrl,
          })(model.name),
          system: "",  // Remove system prompt for leaner API calls
        } : {
          model: createAnthropicProvider(model.providerConfig.baseUrl, model.providerConfig.apiKey)(model.name),
          system: "",  // Remove system prompt for leaner API calls
        }),
        prompt: testPrompt,
        maxTokens: 500,
        onChunk: ({ chunk }) => {
          if (!firstTokenTime && chunk.type === 'text-delta') {
            firstTokenTime = Date.now();
          }
          if (chunk.type === 'text-delta') {
            tokenCount++;
          }
        },
      });
      
      // Consume the stream and count tokens manually
      let fullText = '';
      for await (const textPart of result.textStream) {
        fullText += textPart;
        // Manual token count estimation as fallback
        tokenCount = Math.round(fullText.length / 4); // Rough estimate
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const timeToFirstToken = firstTokenTime ? firstTokenTime - startTime : totalTime;
      const tokensPerSecond = tokenCount > 0 && totalTime > 0 ? (tokenCount / totalTime) * 1000 : 0;
      
      // Try to get usage, but fallback to manual counting
      let usage = null;
      try {
        usage = await result.usage;
      } catch (e) {
        // Usage might not be available
      }
      
      // Use provider token count if available, otherwise use manual count
      const completionTokens = usage?.completionTokens || tokenCount;
      const promptTokens = usage?.promptTokens || Math.round(testPrompt.length / 4);
      const totalTokens = usage?.totalTokens || (completionTokens + promptTokens);
      
      console.log(colorText('Completed!', 'green'));
      console.log(colorText(`  Total Time: ${(totalTime / 1000).toFixed(2)}s`, 'cyan'));
      console.log(colorText(`  TTFT: ${(timeToFirstToken / 1000).toFixed(2)}s`, 'cyan'));
      console.log(colorText(`  Tokens/Sec: ${tokensPerSecond.toFixed(1)}`, 'cyan'));
      
      return {
        model: model.name,
        provider: model.providerName,
        totalTime,
        timeToFirstToken,
        tokenCount: completionTokens,
        tokensPerSecond,
        promptTokens: promptTokens,
        totalTokens: totalTokens,
        success: true
      };
      
    } catch (error) {
      console.log(colorText('Failed: ', 'red') + error.message);
      return {
        model: model.name,
        provider: model.providerName,
        totalTime: 0,
        timeToFirstToken: 0,
        tokenCount: 0,
        tokensPerSecond: 0,
        promptTokens: 0,
        totalTokens: 0,
        success: false,
        error: error.message
      };
    }
  };
  
  // Run all benchmarks in parallel
  console.log(colorText('Starting parallel benchmark execution...', 'cyan'));
  const promises = models.map(model => benchmarkModel(model));
  const results = await Promise.all(promises);
  
  console.log('');
  console.log(colorText('All benchmarks completed!', 'green'));
  
  await displayColorfulResults(results, 'AI SDK');
}

// Colorful results display with comprehensive table and enhanced bars
async function displayColorfulResults(results, method = 'AI SDK') {
  clearScreen();
  showHeader();
  console.log(colorText('BENCHMARK RESULTS', 'magenta'));
  console.log(colorText('=========================', 'magenta'));
  console.log('');
  console.log(colorText('Method: ', 'cyan') + colorText(method, 'yellow'));
  console.log('');
  
  // Filter successful results for table
  const successfulResults = results.filter(r => r.success);
  
  if (successfulResults.length === 0) {
    console.log(colorText('No successful benchmarks to display.', 'red'));
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  // Create comprehensive table
  console.log(colorText('COMPREHENSIVE PERFORMANCE SUMMARY', 'yellow'));
  
  // Add note about method differences
  console.log(colorText('Note: ', 'cyan') + colorText('Benchmark over REST API doesn\'t utilize streaming, so TTFT is 0. AI SDK utilizes streaming, but', 'dim'));
  console.log(colorText('      ', 'cyan') + colorText('if the model is a thinking model, TTFT will be much higher because thinking tokens are not counted as first token.', 'dim'));
  console.log('');
  
  const table = new Table({
    head: [
      colorText('Model', 'cyan'),
      colorText('Provider', 'cyan'),
      colorText('Total Time(s)', 'cyan'),
      colorText('TTFT(s)', 'cyan'),
      colorText('Tokens/Sec', 'cyan'),
      colorText('Output Tokens', 'cyan'),
      colorText('Prompt Tokens', 'cyan'),
      colorText('Total Tokens', 'cyan')
    ],
    colWidths: [20, 15, 15, 12, 15, 15, 15, 15],
    style: {
      head: ['cyan'],
      border: ['dim'],
      compact: false
    }
  });
  
  // Add data rows
  successfulResults.forEach(result => {
    table.push([
      colorText(result.model, 'white'),
      colorText(result.provider, 'white'),
      colorText((result.totalTime / 1000).toFixed(2), 'green'),
      colorText((result.timeToFirstToken / 1000).toFixed(2), 'yellow'),
      colorText(result.tokensPerSecond.toFixed(1), 'magenta'),
      colorText(result.tokenCount.toString(), 'blue'),
      colorText(result.promptTokens.toString(), 'blue'),
      colorText(result.totalTokens.toString(), 'bright')
    ]);
  });
  
  console.log(table.toString());
  console.log('');
  
  // Enhanced performance comparison charts
  console.log(colorText('PERFORMANCE COMPARISON CHARTS', 'yellow'));
  console.log(colorText('─'.repeat(80), 'dim'));
  console.log('');
  
  // Time comparison chart
  console.log(colorText('TOTAL TIME COMPARISON (lower is better)', 'cyan'));
  const maxTime = Math.max(...successfulResults.map(r => r.totalTime));
  const maxModelLength = Math.max(...successfulResults.map(r => r.model.length));
  
  successfulResults.forEach(result => {
    const barLength = Math.floor((result.totalTime / maxTime) * 25);
    const bar = colorText('█'.repeat(barLength), 'red') + colorText('░'.repeat(25 - barLength), 'dim');
    const timeDisplay = (result.totalTime / 1000).toFixed(2) + 's';
    const tpsDisplay = result.tokensPerSecond.toFixed(1) + ' tok/s';
    
    console.log(
      colorText(timeDisplay.padStart(8), 'red') + 
      colorText(' | ', 'dim') + 
      colorText(tpsDisplay.padStart(12), 'magenta') + 
      colorText(' | ', 'dim') + 
      colorText(result.model.padEnd(maxModelLength), 'white') + 
      colorText(' | ', 'dim') + 
      bar
    );
  });
  
  console.log('');
  console.log(colorText('TOKENS PER SECOND COMPARISON (higher is better)', 'cyan'));
  
  const maxTps = Math.max(...successfulResults.map(r => r.tokensPerSecond));
  
  successfulResults.forEach(result => {
    const barLength = Math.floor((result.tokensPerSecond / maxTps) * 25);
    const bar = colorText('█'.repeat(barLength), 'green') + colorText('░'.repeat(25 - barLength), 'dim');
    const timeDisplay = (result.totalTime / 1000).toFixed(2) + 's';
    const tpsDisplay = result.tokensPerSecond.toFixed(1) + ' tok/s';
    
    console.log(
      colorText(tpsDisplay.padStart(12), 'green') + 
      colorText(' | ', 'dim') + 
      colorText(timeDisplay.padStart(8), 'red') + 
      colorText(' | ', 'dim') + 
      colorText(result.model.padEnd(maxModelLength), 'white') + 
      colorText(' | ', 'dim') + 
      bar
    );
  });
  
  console.log('');
  
  // Show failed benchmarks
  const failedResults = results.filter(r => !r.success);
  if (failedResults.length > 0) {
    console.log(colorText('FAILED BENCHMARKS', 'red'));
    console.log(colorText('─'.repeat(40), 'dim'));
    failedResults.forEach(result => {
      console.log(colorText(`${result.model} (${result.provider}): ${result.error}`, 'red'));
    });
    console.log('');
  }
  
  console.log(colorText('Benchmark completed!', 'green'));
  await question(colorText('Press Enter to continue...', 'yellow'));
}

// Provider management
async function addProvider() {
  clearScreen();
  showHeader();
  console.log(colorText('Add New Provider', 'magenta'));
  console.log('');
  
  const providerOptions = [
    { id: 1, text: 'OpenAI Compatible', type: 'openai-compatible' },
    { id: 2, text: 'Anthropic', type: 'anthropic' },
    { id: 3, text: 'Back to main menu', action: 'back' }
  ];
  
  let currentIndex = 0;
  let selectedChoice = null;
  
  while (true) {
    clearScreen();
    showHeader();
    console.log(colorText('Add New Provider', 'magenta'));
    console.log(colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan'));
    console.log(colorText('Navigation is circular', 'dim'));
    console.log('');
    
    console.log(colorText('Select provider type:', 'cyan'));
    console.log('');
    
    // Display provider options with arrow key navigation
    providerOptions.forEach((option, index) => {
      const isCurrent = index === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const optionText = isCurrent ? colorText(option.text, 'bright') : colorText(option.text, 'yellow');
      
      console.log(`${indicator} ${optionText}`);
    });
    
    const key = await getKeyPress();
    
    if (key === '\u001b[A') {
      // Up arrow - circular navigation
      currentIndex = (currentIndex - 1 + providerOptions.length) % providerOptions.length;
    } else if (key === '\u001b[B') {
      // Down arrow - circular navigation
      currentIndex = (currentIndex + 1) % providerOptions.length;
    } else if (key === '\r') {
      // Enter - select current option
      selectedChoice = providerOptions[currentIndex];
      break;
    } else if (key === '\u0003') {
      // Ctrl+C
      process.exit(0);
    }
  }
  
  if (selectedChoice.action === 'back') return;
  
  const config = loadConfig();
  
  if (selectedChoice.type === 'openai-compatible') {
    // OpenAI Compatible
    const name = await question(colorText('Enter provider name (e.g., MyOpenAI): ', 'cyan'));
    const baseUrl = await question(colorText('Enter base URL (e.g., https://api.openai.com/v1): ', 'cyan'));
    const apiKey = await question(colorText('Enter API key: ', 'cyan'));
    const modelName = await question(colorText('Enter model name (e.g., gpt-4): ', 'cyan'));
    
    const provider = {
      id: Date.now().toString(),
      name,
      type: 'openai-compatible',
      baseUrl,
      apiKey,
      models: [{ name: modelName, id: Date.now().toString() + '_model' }]
    };
    
    config.providers.push(provider);
    saveConfig(config);
    console.log(colorText('Provider added successfully!', 'green'));
    
  } else if (selectedChoice.type === 'anthropic') {
    // Anthropic
    const name = await question(colorText('Enter provider name (e.g., MyAnthropic): ', 'cyan'));
    const baseUrl = await question(colorText('Enter base URL (e.g., https://api.anthropic.com): ', 'cyan'));
    const apiKey = await question(colorText('Enter Anthropic API key: ', 'cyan'));
    const modelName = await question(colorText('Enter model name (e.g., claude-3-sonnet-20240229): ', 'cyan'));
    
    const provider = {
      id: Date.now().toString(),
      name,
      type: 'anthropic',
      baseUrl,
      apiKey,
      models: [{ name: modelName, id: Date.now().toString() + '_model' }]
    };
    
    config.providers.push(provider);
    saveConfig(config);
    console.log(colorText('Provider added successfully!', 'green'));
  }
  
  await question(colorText('\nPress Enter to continue...', 'yellow'));
}

async function listProviders() {
  clearScreen();
  showHeader();
  console.log(colorText('Available Providers', 'magenta'));
  console.log('');
  
  const config = loadConfig();
  
  if (config.providers.length === 0) {
    console.log(colorText('No providers configured yet.', 'yellow'));
  } else {
    config.providers.forEach((provider, index) => {
      console.log(colorText(`${index + 1}. ${provider.name} (${provider.type})`, 'cyan'));
      
      if (provider.models.length > 0) {
        console.log(colorText('   Models:', 'dim'));
        provider.models.forEach((model, modelIndex) => {
          console.log(colorText(`     ${modelIndex + 1}. ${model.name}`, 'yellow'));
        });
      } else {
        console.log(colorText('   Models: None', 'dim'));
      }
      
      console.log('');
    });
  }
  
  await question(colorText('Press Enter to continue...', 'yellow'));
}

async function addModelToProvider() {
  clearScreen();
  showHeader();
  console.log(colorText('Add Model to Provider', 'magenta'));
  console.log('');
  
  const config = loadConfig();
  
  if (config.providers.length === 0) {
    console.log(colorText('No providers available. Please add a provider first.', 'red'));
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  let currentIndex = 0;
  
  while (true) {
    clearScreen();
    showHeader();
    console.log(colorText('Add Model to Provider', 'magenta'));
    console.log(colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan'));
    console.log(colorText('Navigation is circular', 'dim'));
    console.log('');
    
    console.log(colorText('Select provider:', 'cyan'));
    console.log('');
    
    // Display providers with arrow key navigation
    config.providers.forEach((provider, index) => {
      const isCurrent = index === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const providerName = isCurrent ? colorText(provider.name, 'bright') : colorText(provider.name, 'yellow');
      
      console.log(`${indicator} ${providerName}`);
    });
    
    const key = await getKeyPress();
    
    if (key === '\u001b[A') {
      // Up arrow - circular navigation
      currentIndex = (currentIndex - 1 + config.providers.length) % config.providers.length;
    } else if (key === '\u001b[B') {
      // Down arrow - circular navigation
      currentIndex = (currentIndex + 1) % config.providers.length;
    } else if (key === '\r') {
      // Enter - select current provider
      break;
    } else if (key === '\u0003') {
      // Ctrl+C
      process.exit(0);
    }
  }
  
  const provider = config.providers[currentIndex];
  const modelName = await question(colorText('Enter new model name: ', 'cyan'));
  
  provider.models.push({
    name: modelName,
    id: Date.now().toString() + '_model'
  });
  
  saveConfig(config);
  console.log(colorText('Model added successfully!', 'green'));
  await question(colorText('\nPress Enter to continue...', 'yellow'));
}

// REST API benchmark function using the existing benchmark-rest.js classes
async function runRestApiBenchmark(models) {
  if (models.length === 0) {
    console.log(colorText('No models selected for benchmarking.', 'red'));
    return;
  }
  
  clearScreen();
  showHeader();
  console.log(colorText('Running REST API Benchmark...', 'green'));
  console.log(colorText(`Running ${models.length} models in parallel...`, 'cyan'));
  console.log(colorText('Note: This uses direct REST API calls instead of AI SDK', 'dim'));
  console.log('');
  
  // Create a function to benchmark a single model using REST API
  const benchmarkModelRest = async (model) => {
    console.log(colorText(`Testing ${model.name} (${model.providerName}) via REST API...`, 'yellow'));
    
    try {
      const startTime = Date.now();
      const benchmark = new LLMBenchmark(model.providerName, model.name);
      const result = await benchmark.runBenchmarkForResults();
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      
      // Convert REST API result to match the AI SDK format
      console.log(colorText('Completed!', 'green'));
      console.log(colorText(`  Total Time: ${(totalTime / 1000).toFixed(2)}s`, 'cyan'));
      console.log(colorText(`  Tokens/Sec: ${result.tokensPerSecond.toFixed(1)}`, 'cyan'));
      
      return {
        model: model.name,
        provider: model.providerName,
        totalTime: totalTime,
        timeToFirstToken: 0, // REST API doesn't track TTFT
        tokenCount: result.totalTokens,
        tokensPerSecond: result.tokensPerSecond,
        promptTokens: Math.round(testPrompt.length / 4), // Estimate based on prompt length
        totalTokens: result.totalTokens,
        success: result.success,
        error: result.error
      };
      
    } catch (error) {
      console.log(colorText('Failed: ', 'red') + error.message);
      return {
        model: model.name,
        provider: model.providerName,
        totalTime: 0,
        timeToFirstToken: 0,
        tokenCount: 0,
        tokensPerSecond: 0,
        promptTokens: 0,
        totalTokens: 0,
        success: false,
        error: error.message
      };
    }
  };
  
  // Run all benchmarks in parallel
  console.log(colorText('Starting parallel REST API benchmark execution...', 'cyan'));
  const promises = models.map(model => benchmarkModelRest(model));
  const results = await Promise.all(promises);
  
  console.log('');
  console.log(colorText('All REST API benchmarks completed!', 'green'));
  
  await displayColorfulResults(results, 'REST API');
}

// Main menu with arrow key navigation
async function showMainMenu() {
  const menuOptions = [
    { id: 1, text: 'Set Model', action: () => showModelMenu() },
    { id: 2, text: 'Run Benchmark (AI SDK)', action: async () => {
      const selectedModels = await selectModelsCircular();
      if (selectedModels.length > 0) {
        await runStreamingBenchmark(selectedModels);
      }
    }},
    { id: 3, text: 'Run Benchmark (REST API)', action: async () => {
      const selectedModels = await selectModelsCircular();
      if (selectedModels.length > 0) {
        await runRestApiBenchmark(selectedModels);
      }
    }},
    { id: 4, text: 'Exit', action: () => {
      console.log(colorText('Goodbye!', 'green'));
      rl.close();
      process.exit(0);
    }}
  ];
  
  let currentIndex = 0;
  
  while (true) {
    clearScreen();
    showHeader();
    console.log(colorText('Main Menu:', 'cyan'));
    console.log(colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan'));
    console.log(colorText('Navigation is circular', 'dim'));
    console.log('');
    
    // Display menu options
    menuOptions.forEach((option, index) => {
      const isCurrent = index === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const optionText = isCurrent ? colorText(option.text, 'bright') : colorText(option.text, 'yellow');
      
      console.log(`${indicator} ${optionText}`);
    });
    
    const key = await getKeyPress();
    
    if (key === '\u001b[A') {
      // Up arrow - circular navigation
      currentIndex = (currentIndex - 1 + menuOptions.length) % menuOptions.length;
    } else if (key === '\u001b[B') {
      // Down arrow - circular navigation
      currentIndex = (currentIndex + 1) % menuOptions.length;
    } else if (key === '\r') {
      // Enter - select current option
      await menuOptions[currentIndex].action();
    } else if (key === '\u0003') {
      // Ctrl+C
      process.exit(0);
    }
  }
}

async function showModelMenu() {
  const menuOptions = [
    { id: 1, text: 'Add Provider', action: () => addProvider() },
    { id: 2, text: 'List Providers', action: () => listProviders() },
    { id: 3, text: 'Add Model to Provider', action: () => addModelToProvider() },
    { id: 4, text: 'Back to Main Menu', action: () => 'back' }
  ];
  
  let currentIndex = 0;
  
  while (true) {
    clearScreen();
    showHeader();
    console.log(colorText('Model Management:', 'cyan'));
    console.log(colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan'));
    console.log(colorText('Navigation is circular', 'dim'));
    console.log('');
    
    // Display menu options
    menuOptions.forEach((option, index) => {
      const isCurrent = index === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const optionText = isCurrent ? colorText(option.text, 'bright') : colorText(option.text, 'yellow');
      
      console.log(`${indicator} ${optionText}`);
    });
    
    const key = await getKeyPress();
    
    if (key === '\u001b[A') {
      // Up arrow - circular navigation
      currentIndex = (currentIndex - 1 + menuOptions.length) % menuOptions.length;
    } else if (key === '\u001b[B') {
      // Down arrow - circular navigation
      currentIndex = (currentIndex + 1) % menuOptions.length;
    } else if (key === '\r') {
      // Enter - select current option
      const result = await menuOptions[currentIndex].action();
      if (result === 'back') {
        return;
      }
    } else if (key === '\u0003') {
      // Ctrl+C
      process.exit(0);
    }
  }
}

// Handle process interruption
process.on('SIGINT', () => {
  console.log(colorText('\n\nCLI interrupted by user', 'yellow'));
  rl.close();
  process.exit(0);
});

// Start the CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  showMainMenu();
}

export { showMainMenu, addProvider, listProviders, selectModelsCircular, runStreamingBenchmark };