#!/usr/bin/env node

import readline from 'readline';
import fs from 'fs';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';  // Changed from streamText to generateText
import { testPrompt } from './test-prompt.js';
import { getAllProviders, searchProviders, getModelsForProvider } from './models-dev.js';
import { 
  getAllAvailableProviders, 
  addApiKey, 
  getCustomProviders, 
  migrateFromOldConfig,
  getDebugInfo 
} from './opencode-integration.js';
import {
  readAIConfig,
  getCustomProvidersFromConfig,
  getVerifiedProvidersFromConfig,
  addCustomProvider,
  addModelToCustomProvider,
  getAIConfigDebugPaths,
  addToRecentModels,
  getRecentModels,
  cleanupRecentModelsFromConfig
} from './ai-config.js';
import 'dotenv/config';
import Table from 'cli-table3';

// Parse command line arguments
function parseCliArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    debug: false,
    bench: null,
    apiKey: null,
    useAiSdk: false,
    formatted: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--debug') {
      parsed.debug = true;
    } else if (arg === '--bench') {
      parsed.bench = args[++i];
    } else if (arg === '--api-key') {
      parsed.apiKey = args[++i];
    } else if (arg === '--ai-sdk') {
      parsed.useAiSdk = true;
    } else if (arg === '--formatted') {
      parsed.formatted = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    }
  }

  return parsed;
}

function showHelp() {
  console.log(colorText('ai-speedometer - Benchmark AI models', 'cyan'));
  console.log('');
  console.log(colorText('Usage:', 'yellow'));
  console.log('  ai-speedometer                                  ' + colorText('# Interactive mode', 'dim'));
  console.log('  ai-speedometer --bench <provider:model>         ' + colorText('# Headless benchmark', 'dim'));
  console.log('');
  console.log(colorText('Options:', 'yellow'));
  console.log('  --bench <provider:model>    ' + colorText('Run benchmark in headless mode', 'dim'));
  console.log('  --api-key <key>             ' + colorText('Override API key (optional)', 'dim'));
  console.log('  --ai-sdk                    ' + colorText('Use AI SDK instead of REST API', 'dim'));
  console.log('  --formatted                 ' + colorText('Format JSON output for human readability', 'dim'));
  console.log('  --debug                     ' + colorText('Enable debug logging', 'dim'));
  console.log('  --help, -h                  ' + colorText('Show this help message', 'dim'));
  console.log('');
  console.log(colorText('Examples:', 'yellow'));
  console.log('  ai-speedometer --bench openai:gpt-4');
  console.log('  ai-speedometer --bench anthropic:claude-3-opus --api-key "sk-..."');
  console.log('  ai-speedometer --bench openai:gpt-4 --ai-sdk');
  console.log('  ai-speedometer --bench openai:gpt-4 --formatted');
  console.log('');
}

const cliArgs = parseCliArgs();
const debugMode = cliArgs.debug;
let logFile = null;

function log(message) {
  if (!debugMode) return;
  
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  if (!logFile) {
    logFile = fs.createWriteStream('debug.log', { flags: 'w' });
  }
  
  logFile.write(logMessage);
  // Only print to console for important messages
  if (message.includes('ERROR') || message.includes('Creating') || message.includes('API Request')) {
    console.log(logMessage.trim());
  }
}

// Create a custom Anthropic provider function that supports baseUrl
function createAnthropicProvider(baseUrl, apiKey) {
  // Use createAnthropic instead of default anthropic for custom baseURL support
  log(`Creating Anthropic provider with baseUrl: ${baseUrl}`);
  log(`API Key length: ${apiKey ? apiKey.length : 0}`);
  
  // Use baseUrl as provided - no automatic normalization needed
  
  // Try with baseURL parameter (correct according to docs)
  const provider = createAnthropic({
    apiKey: apiKey,
    baseURL: baseUrl,
    // Add minimal fetch logging for debugging
    fetch: debugMode ? async (input, init) => {
      log(`API Request to: ${input}`);
      const response = await fetch(input, init);
      log(`Response status: ${response.status}`);
      return response;
    } : undefined
  });
  
  log(`Provider created successfully: ${provider ? 'yes' : 'no'}`);
  return provider;
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
  console.log('');
}

// Configuration management - now using ai-benchmark-config.json for custom providers
async function loadConfig(includeAllProviders = false) {
  try {
    // Check if we need to migrate from old config
    const oldConfigFile = 'ai-benchmark-config.json';
    if (fs.existsSync(oldConfigFile)) {
      console.log(colorText('Migrating from old config format to new format...', 'yellow'));
      
      try {
        const data = fs.readFileSync(oldConfigFile, 'utf8');
        const oldConfig = JSON.parse(data);
        
        const migrationResults = await migrateFromOldConfig(oldConfig);
        
        console.log(colorText(`Migration complete: ${migrationResults.migrated} items migrated`, 'green'));
        if (migrationResults.failed > 0) {
          console.log(colorText(`Migration warnings: ${migrationResults.failed} items failed`, 'yellow'));
          migrationResults.errors.forEach(error => {
            console.log(colorText(`  - ${error}`, 'dim'));
          });
        }
        
        // Backup old config
        fs.renameSync(oldConfigFile, `${oldConfigFile}.backup`);
        console.log(colorText('Old config backed up as ai-benchmark-config.json.backup', 'cyan'));
        
        await question(colorText('Press Enter to continue...', 'yellow'));
      } catch (error) {
        console.log(colorText('Migration failed: ', 'red') + error.message);
        await question(colorText('Press Enter to continue with empty config...', 'yellow'));
      }
    }
    
    // Load providers from both auth.json (verified) and ai-benchmark-config.json (custom)
    // Include all models.dev providers if includeAllProviders is true (for headless mode)
    const providers = await getAllAvailableProviders(includeAllProviders);
    
    return {
      providers,
      verifiedProviders: {} // Keep for compatibility but no longer used
    };
  } catch (error) {
    console.log(colorText('Error loading config, starting fresh: ', 'yellow') + error.message);
    return { providers: [], verifiedProviders: {} };
  }
}

// Save config - now using ai-benchmark-config.json and auth.json
async function saveConfig(config) {
  // Note: This function is kept for compatibility but the actual saving
  // is handled by the ai-config.js and opencode-integration.js functions
  console.log(colorText('Note: Configuration is now automatically saved to ai-benchmark-config.json and auth.json', 'cyan'));
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

// Circular model selection with arrow keys and pagination
async function selectModelsCircular() {
  clearScreen();
  showHeader();
  console.log(colorText('Select Models for Benchmark', 'magenta'));
  console.log('');
   
  const config = await loadConfig();
   
  // Clean up recent models from main config and migrate to cache
  await cleanupRecentModelsFromConfig();
   
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
        providerConfig: {
          ...provider,
          apiKey: provider.apiKey || '',
          baseUrl: provider.baseUrl || ''
        },
        selected: false
      });
    });
  });
  
  // Load recent models
  const recentModelsData = await getRecentModels();
  
  // Create a mapping of recent models to actual model objects
  const recentModelObjects = [];
  recentModelsData.forEach(recentModel => {
    const modelObj = allModels.find(model => 
      model.id === recentModel.modelId && 
      model.providerName === recentModel.providerName
    );
    if (modelObj) {
      recentModelObjects.push({
        ...modelObj,
        isRecent: true
      });
    }
  });
  
  let currentIndex = 0;
  let currentPage = 0;
  let searchQuery = '';
  
  // Create a reusable filter function to avoid code duplication
  const filterModels = (query) => {
    if (!query.trim()) {
      // When search is empty, return the combined list with recent models at top
      const recentModelIds = new Set(recentModelObjects.map(m => m.id));
      const nonRecentModels = allModels.filter(model => !recentModelIds.has(model.id));
      return [...recentModelObjects, ...nonRecentModels];
    }

    // When searching, search through all models (no recent section) with fuzzy matching
    const queryWords = query.toLowerCase().split(/\s+/).filter(word => word.length > 0);
    return allModels.filter(model => {
      const searchableText = `${model.name} ${model.providerName} ${model.providerId} ${model.providerType}`.toLowerCase();
      return queryWords.every(word => searchableText.includes(word));
    });
  };
  
  // Initialize filtered models using the filter function
  let filteredModels = filterModels('');
  let needsRedraw = true;

  // Debounce function to reduce filtering frequency
  let searchTimeout;
  const debouncedFilter = (query, callback) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      filteredModels = filterModels(query);
      needsRedraw = true;
      callback(filteredModels);
    }, 50); // 50ms debounce delay
  };

  while (true) {
    // Calculate pagination (needed for key handlers)
    const visibleItemsCount = getVisibleItemsCount(12); // Extra space for search bar
    const totalPages = Math.ceil(filteredModels.length / visibleItemsCount);

    if (needsRedraw) {
      // Build screen content in memory (double buffering)
      let screenContent = '';

      // Add header
      screenContent += colorText('Ai-speedometer', 'cyan') + '\n';
      screenContent += colorText('=============================', 'cyan') + '\n';
      screenContent += '\n';

      screenContent += colorText('Select Models for Benchmark', 'magenta') + '\n';
      screenContent += colorText('Use ↑↓ arrows to navigate, TAB to select/deselect, ENTER to run benchmark', 'cyan') + '\n';
      screenContent += colorText('Type to search (real-time filtering)', 'cyan') + '\n';
      screenContent += colorText('Press "A" to select all models, "N" to deselect all', 'cyan') + '\n';
      screenContent += colorText('Circle states: ●=Current+Selected  ○=Current+Unselected  ●=Selected  ○=Unselected', 'dim') + '\n';
      screenContent += colorText('Quick run: ENTER on any model | Multi-select: TAB then ENTER | Recent: R', 'dim') + '\n';
      screenContent += '\n';

      // Search interface - always visible
      screenContent += colorText('Search: ', 'yellow') + colorText(searchQuery + '_', 'bright') + '\n';
      screenContent += '\n';

      // Ensure current page is valid
      if (currentPage >= totalPages) currentPage = totalPages - 1;
      if (currentPage < 0) currentPage = 0;

      const startIndex = currentPage * visibleItemsCount;
      const endIndex = Math.min(startIndex + visibleItemsCount, filteredModels.length);

      // Display models in a vertical layout with pagination
      let hasRecentModelsInCurrentPage = false;
      let recentSectionDisplayed = false;
      let nonRecentSectionDisplayed = false;

      // Only show recent section when search is empty and we have recent models
      const showRecentSection = searchQuery.length === 0 && recentModelObjects.length > 0;

      // Check if current page contains any recent models (only when search is empty)
      if (showRecentSection) {
        for (let i = startIndex; i < endIndex; i++) {
          if (filteredModels[i].isRecent) {
            hasRecentModelsInCurrentPage = true;
            break;
          }
        }
      }

      // Display models with proper section headers
      for (let i = startIndex; i < endIndex; i++) {
        const model = filteredModels[i];
        const isCurrent = i === currentIndex;
        // For recent models, check selection state from the original model
        let isSelected;
        if (model.isRecent) {
          const originalModelIndex = allModels.findIndex(originalModel =>
            originalModel.id === model.id &&
            originalModel.providerName === model.providerName &&
            !originalModel.isRecent
          );
          isSelected = originalModelIndex !== -1 ? allModels[originalModelIndex].selected : false;
        } else {
          isSelected = model.selected;
        }

        // Show recent section header if we encounter a recent model and haven't shown the header yet
        if (model.isRecent && !recentSectionDisplayed && hasRecentModelsInCurrentPage && showRecentSection) {
          screenContent += colorText('-------recent--------', 'dim') + '\n';
          recentSectionDisplayed = true;
        }

        // Show separator between recent and non-recent models
        if (!model.isRecent && recentSectionDisplayed && !nonRecentSectionDisplayed && showRecentSection) {
          screenContent += colorText('-------recent--------', 'dim') + '\n';
          nonRecentSectionDisplayed = true;
        }

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

        screenContent += `${circle} ${modelName} ${providerName}\n`;
      }

      screenContent += '\n';
      screenContent += colorText(`Selected: ${allModels.filter(m => m.selected).length} models`, 'yellow') + '\n';

      // Show pagination info
      if (totalPages > 1) {
        const pageInfo = colorText(`Page ${currentPage + 1}/${totalPages}`, 'cyan');
        const navHint = colorText('Use Page Up/Down to navigate pages', 'dim');
        screenContent += `${pageInfo} ${navHint}\n`;

        if (currentPage < totalPages - 1) {
          screenContent += colorText('↓ More models below', 'dim') + '\n';
        }
      }

      // Clear screen and output entire buffer at once
      clearScreen();
      console.log(screenContent);
      needsRedraw = false;
    }
    
    const key = await getKeyPress();
    
    // Navigation keys - only handle special keys
    if (key === '\u001b[A') {
      // Up arrow - circular navigation within current page
      const pageStartIndex = currentPage * visibleItemsCount;
      const pageEndIndex = Math.min(pageStartIndex + visibleItemsCount, filteredModels.length);

      if (currentIndex <= pageStartIndex) {
        currentIndex = pageEndIndex - 1;
      } else {
        currentIndex--;
      }
      needsRedraw = true;
    } else if (key === '\u001b[B') {
      // Down arrow - circular navigation within current page
      const pageStartIndex = currentPage * visibleItemsCount;
      const pageEndIndex = Math.min(pageStartIndex + visibleItemsCount, filteredModels.length);

      if (currentIndex >= pageEndIndex - 1) {
        currentIndex = pageStartIndex;
      } else {
        currentIndex++;
      }
      needsRedraw = true;
    } else if (key === '\u001b[5~') {
      // Page Up
      if (currentPage > 0) {
        currentPage--;
        currentIndex = currentPage * visibleItemsCount;
        needsRedraw = true;
      }
    } else if (key === '\u001b[6~') {
      // Page Down
      if (currentPage < totalPages - 1) {
        currentPage++;
        currentIndex = currentPage * visibleItemsCount;
        needsRedraw = true;
      }
    } else if (key === '\t') {
      // Tab - select/deselect current model
      const currentModel = filteredModels[currentIndex];
      let actualModelIndex;

      if (currentModel.isRecent) {
        // For recent models, find by matching the original model ID and provider name
        actualModelIndex = allModels.findIndex(model =>
          model.id === currentModel.id &&
          model.providerName === currentModel.providerName &&
          !model.isRecent // Don't match the recent copy, match the original
        );
      } else {
        // For regular models, use the standard matching
        actualModelIndex = allModels.findIndex(model =>
          model.id === currentModel.id && model.providerName === currentModel.providerName
        );
      }

      if (actualModelIndex !== -1) {
        allModels[actualModelIndex].selected = !allModels[actualModelIndex].selected;
      }
      needsRedraw = true;
      // Force immediate screen redraw by continuing to next iteration
      continue;
    } else if (key === '\r') {
      // Enter - run benchmark on selected models
      const currentModel = filteredModels[currentIndex];
      if (currentModel) {
        // Check if any models are already selected
        const hasSelectedModels = allModels.some(model => model.selected);
        
        if (!hasSelectedModels) {
          // If no models are selected, select just the current model (quick single model)
          const actualModelIndex = allModels.indexOf(currentModel);
          if (actualModelIndex !== -1) {
            allModels[actualModelIndex].selected = true;
          }
        }
        // If models are already selected, keep them as is and run benchmark
        break;
      }
    } else if (key === '\u0003') {
      // Ctrl+C
      process.exit(0);
    } else if (key === '\b' || key === '\x7f') {
      // Backspace - delete character from search
      if (searchQuery.length > 0) {
        searchQuery = searchQuery.slice(0, -1);
        debouncedFilter(searchQuery, (newFilteredModels) => {
          filteredModels = newFilteredModels;
          currentIndex = 0;
          currentPage = 0;
        });
      }
    } else if (key === 'A') {
      // Select all models - only when search is empty and Shift+A is pressed
      if (searchQuery.length === 0) {
        filteredModels.forEach(model => {
          const actualModelIndex = allModels.indexOf(model);
          if (actualModelIndex !== -1) {
            allModels[actualModelIndex].selected = true;
          }
        });
        needsRedraw = true;
      } else {
        // If search is active, add 'A' to search query
        searchQuery += key;
        debouncedFilter(searchQuery, (newFilteredModels) => {
          filteredModels = newFilteredModels;
          currentIndex = 0;
          currentPage = 0;
        });
      }
    } else if (key === 'N') {
      // Deselect all models (None) - only when search is empty and Shift+N is pressed
      if (searchQuery.length === 0) {
        filteredModels.forEach(model => {
          const actualModelIndex = allModels.indexOf(model);
          if (actualModelIndex !== -1) {
            allModels[actualModelIndex].selected = false;
          }
        });
        needsRedraw = true;
      } else {
        // If search is active, add 'N' to search query
        searchQuery += key;
        debouncedFilter(searchQuery, (newFilteredModels) => {
          filteredModels = newFilteredModels;
          currentIndex = 0;
          currentPage = 0;
        });
      }
    } else if (key === 'R' || key === 'r') {
      // Run recent models - only when search is empty and we have recent models
      if (searchQuery.length === 0 && recentModelObjects.length > 0) {
        // Deselect all models first
        allModels.forEach(model => model.selected = false);

        // Select all recent models by finding the original models
        recentModelObjects.forEach(recentModel => {
          const actualModelIndex = allModels.findIndex(model =>
            model.id === recentModel.id &&
            model.providerName === recentModel.providerName &&
            !model.isRecent // Match the original, not the recent copy
          );
          if (actualModelIndex !== -1) {
            allModels[actualModelIndex].selected = true;
          }
        });

        needsRedraw = true;
        // Break out of loop to run benchmark
        break;
      } else {
        // If search is active or no recent models, add 'R' to search query
        searchQuery += key;
        debouncedFilter(searchQuery, (newFilteredModels) => {
          filteredModels = newFilteredModels;
          currentIndex = 0;
          currentPage = 0;
        });
      }
    } else if (key === 'a' || key === 'n') {
      // Lowercase 'a' and 'n' go to search field (not select all/none)
      searchQuery += key;
      debouncedFilter(searchQuery, (newFilteredModels) => {
        filteredModels = newFilteredModels;
        currentIndex = 0;
        currentPage = 0;
      });
    } else if (key === ' ' || key.length === 1) {
      // Spacebar or regular character - add to search query
      searchQuery += key;
      debouncedFilter(searchQuery, (newFilteredModels) => {
        filteredModels = newFilteredModels;
        currentIndex = 0;
        currentPage = 0;
      });
    }
  }
  
  return allModels.filter(m => m.selected);
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
      
      log(`Model provider type: ${model.providerType}`);
      log(`Model provider config: ${JSON.stringify(model.providerConfig, null, 2)}`);
      
      // Validate required configuration
      if (!model.providerConfig || !model.providerConfig.apiKey) {
        throw new Error(`Missing API key for provider ${model.providerName}`);
      }
      
      if (!model.providerConfig.baseUrl) {
        throw new Error(`Missing base URL for provider ${model.providerName}`);
      }
      
      log(`Model provider config baseUrl: ${model.providerConfig.baseUrl}`);
      log(`Model provider config apiKey: ${model.providerConfig.apiKey ? '***' + model.providerConfig.apiKey.slice(-4) : 'missing'}`);
      
      // Extract the actual model ID for API calls
      let actualModelId = model.name;
      if (model.id && model.id.includes('_')) {
        // For models with provider prefix, extract the actual model ID
        actualModelId = model.id.split('_')[1];
        log(`Using extracted model ID: ${actualModelId}`);
      }
      
      // Trim any trailing spaces from model names
      actualModelId = actualModelId.trim();
      log(`Using final model ID: "${actualModelId}"`);
      
      
      
      let modelConfig;
      if (model.providerType === 'openai-compatible') {
        modelConfig = {
          model: createOpenAICompatible({
            name: model.providerName,
            apiKey: model.providerConfig.apiKey,
            baseURL: model.providerConfig.baseUrl,
          })(actualModelId),
          system: "",  // Remove system prompt for leaner API calls
        };
      } else if (model.providerType === 'anthropic') {
        modelConfig = {
          model: createAnthropicProvider(model.providerConfig.baseUrl, model.providerConfig.apiKey)(actualModelId),
          system: "",  // Remove system prompt for leaner API calls
        };
      } else if (model.providerType === 'google') {
        // For Google providers, we need to import and use the Google SDK
        const { createGoogleGenerativeAI } = await import('@ai-sdk/google');
        const googleProvider = createGoogleGenerativeAI({
          apiKey: model.providerConfig.apiKey,
          baseURL: model.providerConfig.baseUrl,
        });
        modelConfig = {
          model: googleProvider(actualModelId),
          system: "",  // Remove system prompt for leaner API calls
        };
      } else {
        throw new Error(`Unsupported provider type: ${model.providerType}`);
      }
      
      const result = streamText({
        ...modelConfig,
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
      try {
        for await (const textPart of result.textStream) {
          fullText += textPart;
          // Manual token count estimation as fallback
          tokenCount = Math.round(fullText.length / 4); // Rough estimate
        }
        log(`Stream completed successfully. Total tokens: ${tokenCount}`);
        log(`Full text length: ${fullText.length} characters`);
      } catch (error) {
        log(`Stream error: ${error.message}`);
        log(`Error stack: ${error.stack}`);
        throw error;
      }
      
      // Close log file when done
      if (debugMode) {
        process.on('exit', () => {
          if (logFile) logFile.end();
        });
      }
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const timeToFirstToken = firstTokenTime ? firstTokenTime - startTime : totalTime;
      const tokensPerSecond = tokenCount > 0 && totalTime > 0 ? (tokenCount / totalTime) * 1000 : 0;
      
      // Try to get usage, but fallback to manual counting
      let usage = null;
      try {
        usage = await result.usage;
        log(`Provider usage data: ${JSON.stringify(usage, null, 2)}`);
      } catch (e) {
        log(`Usage not available: ${e.message}`);
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
      console.log(colorText(`  Total Tokens: ${totalTokens}`, 'cyan'));
      
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
      log(`Benchmark failed: ${error.message}`);
      log(`Error stack: ${error.stack}`);
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
  
  await displayColorfulResults(results, 'AI SDK', models);
}

// Colorful results display with comprehensive table and enhanced bars
async function displayColorfulResults(results, method = 'AI SDK', models = []) {
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
  console.log(colorText('Note: ', 'cyan') + colorText('REST API with streaming now supports TTFT measurement. AI SDK also supports streaming.', 'dim'));
  console.log(colorText('      ', 'cyan') + colorText('For thinking models, TTFT will be higher as thinking tokens are processed before output tokens.', 'dim'));
  console.log(colorText('      ', 'cyan') + colorText('[est] markers indicate token counts were estimated (API did not provide usage metadata).', 'dim'));
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
  
  // Sort results by tokens per second (descending) for table ranking
  const sortedResults = [...successfulResults].sort((a, b) => b.tokensPerSecond - a.tokensPerSecond);
  
  // Add data rows (already ranked by sort order)
  sortedResults.forEach((result) => {
    const outputTokenDisplay = result.tokenCount.toString() + (result.usedEstimateForOutput ? ' [est]' : '');
    const promptTokenDisplay = result.promptTokens.toString() + (result.usedEstimateForInput ? ' [est]' : '');
    const totalTokenDisplay = result.totalTokens.toString() + ((result.usedEstimateForInput || result.usedEstimateForOutput) ? ' [est]' : '');
    
    table.push([
      colorText(result.model, 'white'),
      colorText(result.provider, 'white'),
      colorText((result.totalTime / 1000).toFixed(2), 'green'),
      colorText((result.timeToFirstToken / 1000).toFixed(2), 'yellow'),
      colorText(result.tokensPerSecond.toFixed(1), 'magenta'),
      colorText(outputTokenDisplay, result.usedEstimateForOutput ? 'yellow' : 'blue'),
      colorText(promptTokenDisplay, result.usedEstimateForInput ? 'yellow' : 'blue'),
      colorText(totalTokenDisplay, (result.usedEstimateForInput || result.usedEstimateForOutput) ? 'yellow' : 'bright')
    ]);
  });
  
  console.log(table.toString());
  console.log('');
  
  // Enhanced performance comparison charts with ranking and provider sections
  console.log(colorText('PERFORMANCE COMPARISON CHARTS', 'yellow'));
  console.log(colorText('─'.repeat(80), 'dim'));
  console.log('');
  
  // Group results by provider
  const providerGroups = {};
  successfulResults.forEach(result => {
    if (!providerGroups[result.provider]) {
      providerGroups[result.provider] = [];
    }
    providerGroups[result.provider].push(result);
  });
  
  // Calculate consistent column widths for both charts
  const maxModelLength = Math.max(...successfulResults.map(r => r.model.length));
  const maxProviderLength = Math.max(...successfulResults.map(r => r.provider.length));
  const maxTimeLength = 8; // "99.99s"
  const maxTpsLength = 12; // "999.9 tok/s"
  const maxRankLength = 6; // "1st", "2nd", "3rd", "4th", etc.
  
  // Time comparison chart - ranked by fastest (lowest time first)
  console.log(colorText('TOTAL TIME RANKING (fastest at top - lower is better)', 'cyan'));
  const timeSortedResults = [...successfulResults].sort((a, b) => a.totalTime - b.totalTime);
  const maxTime = Math.max(...successfulResults.map(r => r.totalTime));
  
  timeSortedResults.forEach((result, index) => {
    const rank = index + 1;
    const barLength = Math.floor((result.totalTime / maxTime) * 25);
    const bar = colorText('█'.repeat(barLength), 'red') + colorText('░'.repeat(25 - barLength), 'dim');
    const timeDisplay = (result.totalTime / 1000).toFixed(2) + 's';
    const tpsDisplay = result.tokensPerSecond.toFixed(1) + ' tok/s';
    
    // Rank badges
    const rankBadge = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
    
    console.log(
      colorText(rankBadge.padStart(maxRankLength), rank === 1 ? 'yellow' : rank === 2 ? 'white' : rank === 3 ? 'bright' : 'white') +
      colorText(' | ', 'dim') + 
      colorText(timeDisplay.padStart(maxTimeLength), 'red') + 
      colorText(' | ', 'dim') + 
      colorText(tpsDisplay.padStart(maxTpsLength), 'magenta') + 
      colorText(' | ', 'dim') + 
      colorText(result.model.padEnd(maxModelLength), 'white') + 
      colorText(' | ', 'dim') + 
      colorText(result.provider.padEnd(maxProviderLength), 'cyan') +
      colorText(' | ', 'dim') + 
      bar
    );
  });
  
  console.log('');
  
  // Tokens per second comparison - ranked by highest TPS first
  console.log(colorText('TOKENS PER SECOND RANKING (fastest at top - higher is better)', 'cyan'));
  const tpsSortedResults = [...successfulResults].sort((a, b) => b.tokensPerSecond - a.tokensPerSecond);
  const maxTps = Math.max(...successfulResults.map(r => r.tokensPerSecond));
  
  tpsSortedResults.forEach((result, index) => {
    const rank = index + 1;
    const barLength = Math.floor((result.tokensPerSecond / maxTps) * 25);
    const bar = colorText('█'.repeat(barLength), 'green') + colorText('░'.repeat(25 - barLength), 'dim');
    const timeDisplay = (result.totalTime / 1000).toFixed(2) + 's';
    const tpsDisplay = result.tokensPerSecond.toFixed(1) + ' tok/s';
    
    // Rank badges
    const rankBadge = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}.`;
    
    console.log(
      colorText(rankBadge.padStart(maxRankLength), rank === 1 ? 'yellow' : rank === 2 ? 'white' : rank === 3 ? 'bright' : 'white') +
      colorText(' | ', 'dim') + 
      colorText(tpsDisplay.padStart(maxTpsLength), 'green') + 
      colorText(' | ', 'dim') + 
      colorText(timeDisplay.padStart(maxTimeLength), 'red') + 
      colorText(' | ', 'dim') + 
      colorText(result.model.padEnd(maxModelLength), 'white') + 
      colorText(' | ', 'dim') + 
      colorText(result.provider.padEnd(maxProviderLength), 'cyan') +
      colorText(' | ', 'dim') + 
      bar
    );
  });
  
  console.log('');
  
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
  
  // Add successful models to recent models list
  const successfulModels = results
    .filter(r => r.success)
    .map(r => {
      // Find the actual model object that matches this benchmark result
      const modelObj = models.find(model => 
        model.name === r.model && model.providerName === r.provider
      );
      
      return {
        modelId: modelObj ? modelObj.id : r.model, // Use actual ID if found, fallback to name
        modelName: r.model,
        providerName: r.provider
      };
    });
  
  if (successfulModels.length > 0) {
    await addToRecentModels(successfulModels);
  }
  
  console.log(colorText('Benchmark completed!', 'green'));
  await question(colorText('Press Enter to continue...', 'yellow'));
}

// Helper function to calculate visible items based on terminal height
function getVisibleItemsCount(headerHeight = 10) {
  const terminalHeight = process.stdout.rows || 24;
  return Math.max(3, terminalHeight - headerHeight);
}



// Add a verified provider (saves to both auth.json and ai-benchmark-config.json)
async function addVerifiedProvider() {
  let searchQuery = '';
  let allProviders = [];
  let filteredProviders = [];
  let currentIndex = 0;
  let currentPage = 0;
  
  // Load providers from models.dev
  try {
    allProviders = await getAllProviders();
    filteredProviders = allProviders;
  } catch (error) {
    clearScreen();
    showHeader();
    console.log(colorText('Add Verified Provider', 'magenta'));
    console.log('');
    console.log(colorText('Error loading providers: ', 'red') + error.message);
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  while (true) {
    // Build screen content in memory (double buffering)
    let screenContent = '';
    
    // Add header
    screenContent += colorText('Ai-speedometer', 'cyan') + '\n';
    screenContent += colorText('=============================', 'cyan') + '\n';
    screenContent += '\n';
    
    screenContent += colorText('Add Verified Provider', 'magenta') + '\n';
    screenContent += colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan') + '\n';
    screenContent += colorText('Type to search (real-time filtering)', 'cyan') + '\n';
    screenContent += colorText('Navigation is circular', 'dim') + '\n';
    screenContent += '\n';
    
    // Search interface - always visible
    screenContent += colorText('🔍 Search: ', 'yellow') + colorText(searchQuery + '_', 'bright') + '\n';
    screenContent += '\n';
    
    // Calculate pagination
    const visibleItemsCount = getVisibleItemsCount(11); // Account for search bar and header
    const totalItems = filteredProviders.length;
    const totalPages = Math.ceil(totalItems / visibleItemsCount);
    
    // Ensure current page is valid
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;
    
    const startIndex = currentPage * visibleItemsCount;
    const endIndex = Math.min(startIndex + visibleItemsCount, totalItems);
    
    // Display providers with pagination
    screenContent += colorText('Available Verified Providers:', 'cyan') + '\n';
    screenContent += '\n';
    
    // Show current page of providers
    for (let i = startIndex; i < endIndex && i < filteredProviders.length; i++) {
      const provider = filteredProviders[i];
      const isCurrent = i === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const providerName = isCurrent ? colorText(provider.name, 'bright') : colorText(provider.name, 'white');
      const providerType = isCurrent ? colorText(`(${provider.type})`, 'cyan') : colorText(`(${provider.type})`, 'dim');
      
      screenContent += `${indicator} ${providerName} ${providerType}\n`;
    }
    
    // Show pagination info
    screenContent += '\n';
    if (totalPages > 1) {
      const pageInfo = colorText(`Page ${currentPage + 1}/${totalPages}`, 'cyan');
      const navHint = colorText('Use Page Up/Down to navigate pages', 'dim');
      screenContent += `${pageInfo} ${navHint}\n`;
      
      if (currentPage < totalPages - 1) {
        screenContent += colorText('↓ More items below', 'dim') + '\n';
      }
    }
    
    // Clear screen and output entire buffer at once
    clearScreen();
    console.log(screenContent);
    
    const key = await getKeyPress();
    
    // Navigation keys - only handle special keys
    if (key === '\u001b[A') {
      // Up arrow - circular navigation within current page
      const pageStartIndex = currentPage * visibleItemsCount;
      const pageEndIndex = Math.min(pageStartIndex + visibleItemsCount, totalItems);
      
      if (currentIndex <= pageStartIndex) {
        currentIndex = pageEndIndex - 1;
      } else {
        currentIndex--;
      }
    } else if (key === '\u001b[B') {
      // Down arrow - circular navigation within current page
      const pageStartIndex = currentPage * visibleItemsCount;
      const pageEndIndex = Math.min(pageStartIndex + visibleItemsCount, totalItems);
      
      if (currentIndex >= pageEndIndex - 1) {
        currentIndex = pageStartIndex;
      } else {
        currentIndex++;
      }
    } else if (key === '\u001b[5~') {
      // Page Up
      if (currentPage > 0) {
        currentPage--;
        currentIndex = currentPage * visibleItemsCount;
      }
    } else if (key === '\u001b[6~') {
      // Page Down
      if (currentPage < totalPages - 1) {
        currentPage++;
        currentIndex = currentPage * visibleItemsCount;
      }
    } else if (key === '\r') {
      // Enter - select current provider
      await addVerifiedProviderAuto(filteredProviders[currentIndex]);
      break;
    } else if (key === '\u0003') {
      // Ctrl+C
      process.exit(0);
    } else if (key === '\b' || key === '\x7f') {
      // Backspace - delete character from search
      if (searchQuery.length > 0) {
        searchQuery = searchQuery.slice(0, -1);
        filteredProviders = await searchProviders(searchQuery);
        currentIndex = 0;
        currentPage = 0;
      }
    } else if (key.length === 1) {
      // Regular character - add to search query
      searchQuery += key;
      filteredProviders = await searchProviders(searchQuery);
      currentIndex = 0;
      currentPage = 0;
    }
  }
}

// Add a verified provider from models.dev with AUTO-ADD all models
async function addVerifiedProviderAuto(provider) {
  clearScreen();
  showHeader();
  console.log(colorText('Add Verified Provider', 'magenta'));
  console.log('');
  
  console.log(colorText('Provider: ', 'cyan') + colorText(provider.name, 'white'));
  console.log(colorText('Type: ', 'cyan') + colorText(provider.type, 'white'));
  console.log(colorText('Base URL: ', 'cyan') + colorText(provider.baseUrl, 'white'));
  console.log('');
  
  // Get available models for this provider
  const models = await getModelsForProvider(provider.id);
  
  if (models.length === 0) {
    console.log(colorText('No models available for this provider.', 'red'));
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  console.log(colorText(`Found ${models.length} models for ${provider.name}`, 'cyan'));
  console.log(colorText('All models will be automatically added', 'green'));
  console.log('');
  
  // Show first few models as preview
  console.log(colorText('Models to be added:', 'yellow'));
  const previewCount = Math.min(5, models.length);
  models.slice(0, previewCount).forEach(model => {
    console.log(colorText(`  • ${model.name}`, 'white'));
  });
  
  if (models.length > previewCount) {
    console.log(colorText(`  ... and ${models.length - previewCount} more`, 'dim'));
  }
  
  console.log('');
  
  // Get API key
  const apiKey = await question(colorText('Enter API key: ', 'cyan'));
  
  if (!apiKey) {
    console.log(colorText('API key is required.', 'red'));
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  // Add API key to auth.json (for opencode integration)
  const authSuccess = await addApiKey(provider.id, apiKey);
  
  if (!authSuccess) {
    console.log(colorText('Failed to save API key to auth.json', 'red'));
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  // Also add to ai-benchmark-config.json for consistency
  const { addVerifiedProvider: addVerifiedProviderToConfig } = await import('./ai-config.js');
  const configSuccess = await addVerifiedProviderToConfig(provider.id, apiKey);
  
  if (!configSuccess) {
    console.log(colorText('Warning: Could not save to ai-benchmark-config.json', 'yellow'));
  }
  
  console.log('');
  console.log(colorText('Provider added successfully!', 'green'));
  console.log(colorText(`API key saved to auth.json`, 'cyan'));
  console.log(colorText(`Models will be loaded dynamically from ${provider.name}`, 'cyan'));
  console.log(colorText(`Found ${models.length} available models`, 'cyan'));
  
  await question(colorText('\nPress Enter to continue...', 'yellow'));
}



// Add a custom provider (now using ai-benchmark-config.json)
async function addCustomProviderCLI() {
  clearScreen();
  showHeader();
  console.log(colorText('Add Custom Provider', 'magenta'));
  console.log('');
  console.log(colorText('Note: Custom providers are saved to ai-benchmark-config.json', 'cyan'));
  console.log('');
  
  const providerOptions = [
    { id: 1, text: 'OpenAI Compatible', type: 'openai-compatible' },
    { id: 2, text: 'Anthropic', type: 'anthropic' },
    { id: 3, text: 'Back to Custom Models menu', action: 'back' }
  ];
  
  let currentIndex = 0;
  let selectedChoice = null;
  
  while (true) {
    // Build screen content in memory (double buffering)
    let screenContent = '';
    
    // Add header
    screenContent += colorText('Ai-speedometer', 'cyan') + '\n';
    screenContent += colorText('=============================', 'cyan') + '\n';
    screenContent += '\n';
    
    screenContent += colorText('Add Custom Provider', 'magenta') + '\n';
    screenContent += colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan') + '\n';
    screenContent += colorText('Navigation is circular', 'dim') + '\n';
    screenContent += '\n';
    
    screenContent += colorText('Select provider type:', 'cyan') + '\n';
    screenContent += '\n';
    
    // Display provider options with arrow key navigation
    providerOptions.forEach((option, index) => {
      const isCurrent = index === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const optionText = isCurrent ? colorText(option.text, 'bright') : colorText(option.text, 'yellow');
      
      screenContent += `${indicator} ${optionText}\n`;
    });
    
    // Clear screen and output entire buffer at once
    clearScreen();
    console.log(screenContent);
    
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
  
  const providerId = await question(colorText('Enter provider ID (e.g., my-openai): ', 'cyan'));
  const name = await question(colorText('Enter provider name (e.g., MyOpenAI): ', 'cyan'));
  const baseUrl = await question(colorText('Enter base URL (e.g., https://api.openai.com/v1): ', 'cyan'));
  const apiKey = await question(colorText('Enter API key: ', 'cyan'));
  
  // Ask if user wants to add multiple models
  console.log('');
  console.log(colorText('Do you want to add multiple models?', 'cyan'));
  console.log(colorText('1. Add single model', 'yellow'));
  console.log(colorText('2. Add multiple models', 'yellow'));
  
  const modelChoice = await question(colorText('Enter choice (1 or 2): ', 'cyan'));
  
  let models = [];
  
  if (modelChoice === '2') {
    // Multiple models mode
    console.log('');
    console.log(colorText('Enter model names (one per line, empty line to finish):', 'cyan'));
    console.log(colorText('Examples: gpt-4, gpt-4-turbo, gpt-3.5-turbo', 'dim'));
    console.log('');
    
    while (true) {
      const modelName = await question(colorText('Model name: ', 'cyan'));
      if (!modelName.trim()) break;
      
      const modelId = modelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') + '_' + Date.now();
      models.push({
        name: modelName.trim(),
        id: modelId
      });
    }
  } else {
    // Single model mode
    const modelName = await question(colorText('Enter model name (e.g., gpt-4): ', 'cyan'));
    if (modelName.trim()) {
      const modelId = modelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') + '_' + Date.now();
      models.push({
        name: modelName.trim(),
        id: modelId
      });
    }
  }
  
  if (models.length === 0) {
    console.log(colorText('At least one model is required.', 'red'));
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  // Create provider data for ai-benchmark-config.json format
  const providerData = {
    id: providerId,
    name: name,
    type: selectedChoice.type,
    baseUrl: baseUrl,
    apiKey: apiKey,
    models: models
  };
  
  // Save to ai-benchmark-config.json
  const success = await addCustomProvider(providerData);
  
  if (!success) {
    console.log(colorText('Failed to save custom provider.', 'red'));
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  console.log(colorText('Custom provider added successfully!', 'green'));
  console.log(colorText(`Added ${models.length} model(s)`, 'cyan'));
  console.log(colorText(`Saved to ai-benchmark-config.json`, 'cyan'));
  
  await question(colorText('\nPress Enter to continue...', 'yellow'));
}

// Show debug information about config system
async function showDebugInfo() {
  clearScreen();
  showHeader();
  console.log(colorText('Config System Debug Info', 'magenta'));
  console.log('');
  
  const debugInfo = await getDebugInfo();
  
  console.log(colorText('OpenCode Paths (deprecated):', 'cyan'));
  console.log(colorText(`  auth.json: ${debugInfo.opencodePaths.authJson}`, 'white'));
  console.log(colorText(`  opencode.json: ${debugInfo.opencodePaths.opencodeJson}`, 'white'));
  console.log('');
  
  console.log(colorText('AI Speedometer Config Paths:', 'cyan'));
  console.log(colorText(`  ai-benchmark-config.json: ${debugInfo.aiConfigPaths.configJson}`, 'white'));
  console.log(colorText(`  Config directory: ${debugInfo.aiConfigPaths.configDir}`, 'white'));
  console.log('');
  
  console.log(colorText('File Status:', 'cyan'));
  console.log(colorText(`  auth.json exists: ${debugInfo.authExists ? 'Yes' : 'No'}`, 'white'));
  console.log(colorText(`  opencode.json exists: ${debugInfo.configExists ? 'No' : 'No'}`, 'white'));
  console.log(colorText(`  ai-benchmark-config.json exists: ${debugInfo.aiConfigPaths.configExists ? 'Yes' : 'No'}`, 'white'));
  console.log('');
  
  console.log(colorText('Authenticated Providers (auth.json):', 'cyan'));
  if (debugInfo.authData.length === 0) {
    console.log(colorText('  None', 'dim'));
  } else {
    debugInfo.authData.forEach(provider => {
      console.log(colorText(`  - ${provider}`, 'white'));
    });
  }
  console.log('');
  
  console.log(colorText('Verified Providers (ai-benchmark-config.json):', 'cyan'));
  if (debugInfo.aiConfigData.verifiedProviders.length === 0) {
    console.log(colorText('  None', 'dim'));
  } else {
    debugInfo.aiConfigData.verifiedProviders.forEach(provider => {
      console.log(colorText(`  - ${provider}`, 'white'));
    });
  }
  console.log('');
  
  console.log(colorText('Custom Providers (ai-benchmark-config.json):', 'cyan'));
  if (debugInfo.aiConfigData.customProviders.length === 0) {
    console.log(colorText('  None', 'dim'));
  } else {
    debugInfo.aiConfigData.customProviders.forEach(provider => {
      console.log(colorText(`  - ${provider}`, 'white'));
    });
  }
  console.log('');
  
  console.log(colorText('XDG Paths (for OpenCode):', 'cyan'));
  console.log(colorText(`  Data: ${debugInfo.xdgPaths.data}`, 'white'));
  console.log(colorText(`  Config: ${debugInfo.xdgPaths.config}`, 'white'));
  console.log('');
  
  await question(colorText('Press Enter to continue...', 'yellow'));
}

async function listProviders() {
  clearScreen();
  showHeader();
  console.log(colorText('Existing Providers', 'magenta'));
  console.log('');
  
  const config = await loadConfig();
  
  if (config.providers.length === 0) {
    console.log(colorText('No providers configured yet.', 'yellow'));
  } else {
    // Separate verified and custom providers
    const verifiedProviders = config.providers.filter(p => {
      // Verified providers come from auth.json via models.dev
      return p.baseUrl && p.baseUrl.includes('api.'); // Simple heuristic
    });
    
    const customProviders = config.providers.filter(p => {
      return !verifiedProviders.includes(p);
    });
    
    // Show verified providers
    if (verifiedProviders.length > 0) {
      console.log(colorText('Verified Providers (from models.dev):', 'green'));
      verifiedProviders.forEach((provider, index) => {
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
    
    // Show custom providers
    if (customProviders.length > 0) {
      console.log(colorText('Custom Providers:', 'magenta'));
      customProviders.forEach((provider, index) => {
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
  }
  
  await question(colorText('Press Enter to continue...', 'yellow'));
}

// Add Custom Models submenu
async function addCustomModelsMenu() {
  const menuOptions = [
    { id: 1, text: 'Add Models to Existing Provider', action: () => addModelsToExistingProvider() },
    { id: 2, text: 'Add Custom Provider', action: () => addCustomProviderCLI() },
    { id: 3, text: 'Back to Model Management', action: () => 'back' }
  ];
  
  let currentIndex = 0;
  
  while (true) {
    // Build screen content in memory (double buffering)
    let screenContent = '';
    
    // Add header
    screenContent += colorText('Ai-speedometer', 'cyan') + '\n';
    screenContent += colorText('=============================', 'cyan') + '\n';
    screenContent += '\n';
    
    screenContent += colorText('Add Custom Models', 'magenta') + '\n';
    screenContent += colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan') + '\n';
    screenContent += colorText('Navigation is circular', 'dim') + '\n';
    screenContent += '\n';
    
    // Display menu options
    menuOptions.forEach((option, index) => {
      const isCurrent = index === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const optionText = isCurrent ? colorText(option.text, 'bright') : colorText(option.text, 'yellow');
      
      screenContent += `${indicator} ${optionText}\n`;
    });
    
    // Clear screen and output entire buffer at once
    clearScreen();
    console.log(screenContent);
    
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

// Add models to existing custom provider
async function addModelsToExistingProvider() {
  clearScreen();
  showHeader();
  console.log(colorText('Add Models to Existing Provider', 'magenta'));
  console.log('');
  
  // Get custom providers from config
  const customProviders = await getCustomProvidersFromConfig();
  
  if (customProviders.length === 0) {
    console.log(colorText('No custom providers available. Please add a custom provider first.', 'red'));
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  let currentIndex = 0;
  
  while (true) {
    // Build screen content in memory (double buffering)
    let screenContent = '';
    
    // Add header
    screenContent += colorText('Ai-speedometer', 'cyan') + '\n';
    screenContent += colorText('=============================', 'cyan') + '\n';
    screenContent += '\n';
    
    screenContent += colorText('Add Models to Existing Provider', 'magenta') + '\n';
    screenContent += colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan') + '\n';
    screenContent += colorText('Navigation is circular', 'dim') + '\n';
    screenContent += '\n';
    
    screenContent += colorText('Select custom provider:', 'cyan') + '\n';
    screenContent += '\n';
    
    // Display custom providers with arrow key navigation
    customProviders.forEach((provider, index) => {
      const isCurrent = index === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const providerName = isCurrent ? colorText(provider.name, 'bright') : colorText(provider.name, 'yellow');
      const providerType = isCurrent ? colorText(`(${provider.type})`, 'cyan') : colorText(`(${provider.type})`, 'dim');
      
      screenContent += `${indicator} ${providerName} ${providerType}\n`;
    });
    
    // Clear screen and output entire buffer at once
    clearScreen();
    console.log(screenContent);
    
    const key = await getKeyPress();
    
    if (key === '\u001b[A') {
      // Up arrow - circular navigation
      currentIndex = (currentIndex - 1 + customProviders.length) % customProviders.length;
    } else if (key === '\u001b[B') {
      // Down arrow - circular navigation
      currentIndex = (currentIndex + 1) % customProviders.length;
    } else if (key === '\r') {
      // Enter - select current provider
      break;
    } else if (key === '\u0003') {
      // Ctrl+C
      process.exit(0);
    }
  }
  
  const provider = customProviders[currentIndex];
  
  console.log('');
  console.log(colorText('Selected provider: ', 'cyan') + colorText(provider.name, 'white'));
  console.log('');
  
  // Ask if user wants to add multiple models
  console.log(colorText('Do you want to add multiple models?', 'cyan'));
  console.log(colorText('1. Add single model', 'yellow'));
  console.log(colorText('2. Add multiple models', 'yellow'));
  
  const modelChoice = await question(colorText('Enter choice (1 or 2): ', 'cyan'));
  
  let modelsAdded = 0;
  
  if (modelChoice === '2') {
    // Multiple models mode
    console.log('');
    console.log(colorText('Enter model names (one per line, empty line to finish):', 'cyan'));
    console.log(colorText('Examples: gpt-4, gpt-4-turbo, gpt-3.5-turbo', 'dim'));
    console.log('');
    
    while (true) {
      const modelName = await question(colorText('Model name: ', 'cyan'));
      if (!modelName.trim()) break;
      
      const modelId = modelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') + '_' + Date.now();
      const modelData = {
        name: modelName.trim(),
        id: modelId
      };
      
      const success = await addModelToCustomProvider(provider.id, modelData);
      if (success) {
        modelsAdded++;
        console.log(colorText(`✓ Added model: ${modelName.trim()}`, 'green'));
      } else {
        console.log(colorText(`✗ Failed to add model: ${modelName.trim()}`, 'red'));
      }
    }
  } else {
    // Single model mode
    const modelName = await question(colorText('Enter model name: ', 'cyan'));
    if (modelName.trim()) {
      const modelId = modelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-') + '_' + Date.now();
      const modelData = {
        name: modelName.trim(),
        id: modelId
      };
      
      const success = await addModelToCustomProvider(provider.id, modelData);
      if (success) {
        modelsAdded = 1;
        console.log(colorText(`✓ Added model: ${modelName.trim()}`, 'green'));
      } else {
        console.log(colorText(`✗ Failed to add model: ${modelName.trim()}`, 'red'));
      }
    }
  }
  
  if (modelsAdded > 0) {
    console.log('');
    console.log(colorText(`Successfully added ${modelsAdded} model(s) to ${provider.name}`, 'green'));
  } else {
    console.log(colorText('No models were added.', 'yellow'));
  }
  
  await question(colorText('\nPress Enter to continue...', 'yellow'));
}

// Silent benchmark helper (returns raw result without UI)
async function benchmarkSingleModelRest(model) {

    
    try {
      // Validate required configuration
      if (!model.providerConfig || !model.providerConfig.apiKey) {
        throw new Error(`Missing API key for provider ${model.providerName}`);
      }
      
      if (!model.providerConfig.baseUrl) {
        throw new Error(`Missing base URL for provider ${model.providerName}`);
      }
      
      // Extract the actual model ID for API calls (moved before usage)
      let actualModelId = model.name;
      if (model.id && model.id.includes('_')) {
        actualModelId = model.id.split('_')[1];
      }
      actualModelId = actualModelId.trim();
      
      const startTime = Date.now();
      let firstTokenTime = null;
      let streamedText = '';
      let tokenCount = 0;
      
      // Use correct endpoint based on provider type
      let endpoint;
      if (model.providerType === 'anthropic') {
        endpoint = '/messages';
      } else if (model.providerType === 'google') {
        endpoint = '/models/' + actualModelId + ':streamGenerateContent';
      } else {
        endpoint = '/chat/completions';
      }
      
      // Ensure baseUrl doesn't end with slash and endpoint doesn't start with slash
      const baseUrl = model.providerConfig.baseUrl.replace(/\/$/, '');
      const url = `${baseUrl}${endpoint}`;
      

      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.providerConfig.apiKey}`
      };

      // Add provider-specific headers
      if (model.providerType === 'anthropic') {
        headers['x-api-key'] = model.providerConfig.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (model.providerType === 'google') {
        delete headers['Authorization'];
        headers['x-goog-api-key'] = model.providerConfig.apiKey;
      }

      const body = {
        model: actualModelId,
        messages: [
          { role: 'user', content: testPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7,
        stream: true
      };

      // Adjust for provider-specific formats
      if (model.providerType === 'anthropic') {
        body.max_tokens = 500;
        body.stream = true;
      } else if (model.providerType === 'google') {
        body.contents = [{ parts: [{ text: testPrompt }] }];
        body.generationConfig = {
          maxOutputTokens: 500,
          temperature: 0.7
        };
        delete body.messages;
        delete body.max_tokens;
        delete body.stream;
      }


      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });


      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      // Process streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let isFirstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Capture TTFT on first chunk arrival (network level)
        if (isFirstChunk && !firstTokenTime) {
          firstTokenTime = Date.now();
          isFirstChunk = false;
          // Show live TTFT result (only in interactive mode, not headless)
          const ttftSeconds = ((firstTokenTime - startTime) / 1000).toFixed(2);
          if (!cliArgs.bench) {
            console.log(colorText(`TTFT received at ${ttftSeconds}s for ${model.name}`, 'green'));
          }
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine) continue;

          try {
            if (model.providerType === 'anthropic') {
              // Anthropic uses newline-delimited JSON with event types
              if (trimmedLine.startsWith('data: ')) {
                const jsonStr = trimmedLine.slice(6);
                if (jsonStr === '[DONE]') break;
                
                const chunk = JSON.parse(jsonStr);
                
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  streamedText += chunk.delta.text;
                } else if (chunk.type === 'message_start' && chunk.message?.usage) {
                  inputTokens = chunk.message.usage.input_tokens || 0;
                } else if (chunk.type === 'message_delta') {
                  // Capture output tokens from message_delta
                  if (chunk.usage?.output_tokens) {
                    outputTokens = chunk.usage.output_tokens;
                  }
                  // Some implementations put input_tokens here too
                  if (chunk.usage?.input_tokens && !inputTokens) {
                    inputTokens = chunk.usage.input_tokens;
                  }
                }
              } else if (trimmedLine.startsWith('event: ')) {
                // Skip event lines (Anthropic SSE format uses separate event and data lines)
                continue;
              } else {
                // Try parsing as raw JSON (some Anthropic-compatible APIs don't use SSE format)
                const chunk = JSON.parse(trimmedLine);
                
                if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                  streamedText += chunk.delta.text;
                } else if (chunk.type === 'message_start' && chunk.message?.usage) {
                  inputTokens = chunk.message.usage.input_tokens || 0;
                } else if (chunk.type === 'message_delta') {
                  if (chunk.usage?.output_tokens) {
                    outputTokens = chunk.usage.output_tokens;
                  }
                  if (chunk.usage?.input_tokens && !inputTokens) {
                    inputTokens = chunk.usage.input_tokens;
                  }
                }
              }
            } else if (model.providerType === 'google') {
              // Google streaming format
              const chunk = JSON.parse(trimmedLine);
              if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
                const text = chunk.candidates[0].content.parts[0].text;
                streamedText += text;
              }
              if (chunk.usageMetadata?.promptTokenCount) {
                inputTokens = chunk.usageMetadata.promptTokenCount;
              }
              if (chunk.usageMetadata?.candidatesTokenCount) {
                outputTokens = chunk.usageMetadata.candidatesTokenCount;
              }
            } else {
              // OpenAI-compatible SSE format
              if (trimmedLine.startsWith('data: ')) {
                const jsonStr = trimmedLine.slice(6);
                if (jsonStr === '[DONE]') break;
                
                const chunk = JSON.parse(jsonStr);
                
                if (chunk.choices?.[0]?.delta?.content) {
                  streamedText += chunk.choices[0].delta.content;
                }
                
                if (chunk.usage?.prompt_tokens) {
                  inputTokens = chunk.usage.prompt_tokens;
                }
                if (chunk.usage?.completion_tokens) {
                  outputTokens = chunk.usage.completion_tokens;
                }
              }
            }
          } catch (parseError) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const timeToFirstToken = firstTokenTime ? firstTokenTime - startTime : totalTime;

      // Calculate token counts - use provider's count if available, otherwise estimate
      const usedEstimateForOutput = !outputTokens;
      const usedEstimateForInput = !inputTokens;
      const finalOutputTokens = outputTokens || Math.round(streamedText.length / 4);
      const finalInputTokens = inputTokens || Math.round(testPrompt.length / 4);
      const totalTokens = finalInputTokens + finalOutputTokens;
      const tokensPerSecond = totalTime > 0 ? (totalTokens / totalTime) * 1000 : 0;
      
      return {
        model: model.name,
        provider: model.providerName,
        totalTime: totalTime,
        timeToFirstToken: timeToFirstToken,
        tokenCount: finalOutputTokens,
        tokensPerSecond: tokensPerSecond,
        promptTokens: finalInputTokens,
        totalTokens: totalTokens,
        usedEstimateForOutput: usedEstimateForOutput,
        usedEstimateForInput: usedEstimateForInput,
        success: true
      };
      
    } catch (error) {
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
}

// REST API benchmark function using direct API calls (with UI)
async function runRestApiBenchmark(models) {
  if (models.length === 0) {
    console.log(colorText('No models selected for benchmarking.', 'red'));
    return;
  }
  
  clearScreen();
  showHeader();
  console.log(colorText('Running REST API Benchmark with Streaming...', 'green'));
  console.log(colorText(`Running ${models.length} models in parallel...`, 'cyan'));
  console.log(colorText('Note: This uses direct REST API calls with streaming support', 'dim'));
  console.log('');
  
  // Run all benchmarks in parallel with UI feedback
  console.log(colorText('Starting parallel REST API benchmark execution...', 'cyan'));
  
  // Start all benchmarks in parallel
  const promises = models.map(model => {
    console.log(colorText(`Testing ${model.name} (${model.providerName}) via REST API with streaming...`, 'yellow'));
    return benchmarkSingleModelRest(model);
  });
  
  const results = await Promise.all(promises);
  
  // Show individual results after all complete
  results.forEach((result, index) => {
    if (result.success) {
      console.log(colorText(`✓ ${result.model} (${result.provider}) completed!`, 'green'));
      console.log(colorText(`  Total Time: ${(result.totalTime / 1000).toFixed(2)}s`, 'cyan'));
      console.log(colorText(`  TTFT: ${(result.timeToFirstToken / 1000).toFixed(2)}s`, 'cyan'));
      console.log(colorText(`  Tokens/Sec: ${result.tokensPerSecond.toFixed(1)}`, 'cyan'));
    } else {
      console.log(colorText(`✗ ${result.model} (${result.provider}) failed: `, 'red') + result.error);
    }
  });
  
  console.log('');
  console.log(colorText('All REST API benchmarks completed!', 'green'));
  
  await displayColorfulResults(results, 'REST API (Streaming)', models);
  
  // Add successful models to recent models list
  const successfulModels = results
    .filter(r => r.success)
    .map(r => {
      // Find the actual model object that matches this benchmark result
      const modelObj = models.find(model => 
        model.name === r.model && model.providerName === r.provider
      );
      
      return {
        modelId: modelObj ? modelObj.id : r.model, // Use actual ID if found, fallback to name
        modelName: r.model,
        providerName: r.provider
      };
    });
  
  if (successfulModels.length > 0) {
    await addToRecentModels(successfulModels);
  }
}

// Main menu with arrow key navigation
async function showMainMenu() {
  const menuOptions = [
    { id: 1, text: 'Set Model', action: () => showModelMenu() },
    { id: 2, text: 'Run Benchmark (REST API)', action: async () => {
      const selectedModels = await selectModelsCircular();
      if (selectedModels.length > 0) {
        await runRestApiBenchmark(selectedModels);
      }
    }},
    { id: 3, text: 'Run Benchmark (AI SDK - Legacy)', action: async () => {
      const selectedModels = await selectModelsCircular();
      if (selectedModels.length > 0) {
        await runStreamingBenchmark(selectedModels);
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
    // Build screen content in memory (double buffering)
    let screenContent = '';
    
    // Add header
    screenContent += colorText('Ai-speedometer', 'cyan') + '\n';
    screenContent += colorText('=============================', 'cyan') + '\n';
    screenContent += '\n';
    
    screenContent += colorText('Main Menu:', 'cyan') + '\n';
    screenContent += colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan') + '\n';
    screenContent += colorText('Navigation is circular', 'dim') + '\n';
    screenContent += '\n';
    
    // Display menu options
    menuOptions.forEach((option, index) => {
      const isCurrent = index === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const optionText = isCurrent ? colorText(option.text, 'bright') : colorText(option.text, 'yellow');
      
      screenContent += `${indicator} ${optionText}\n`;
    });
    
    // Clear screen and output entire buffer at once
    clearScreen();
    console.log(screenContent);
    
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
    { id: 1, text: 'Add Verified Provider', action: () => addVerifiedProvider() },
    { id: 2, text: 'Add Custom Models', action: () => addCustomModelsMenu() },
    { id: 3, text: 'List Existing Providers', action: () => listProviders() },
    { id: 4, text: 'Debug Info', action: () => showDebugInfo() },
    { id: 5, text: 'Back to Main Menu', action: () => 'back' }
  ];
  
  let currentIndex = 0;
  
  while (true) {
    // Build screen content in memory (double buffering)
    let screenContent = '';
    
    // Add header
    screenContent += colorText('Ai-speedometer', 'cyan') + '\n';
    screenContent += colorText('=============================', 'cyan') + '\n';
    screenContent += '\n';
    
    screenContent += colorText('Model Management:', 'cyan') + '\n';
    screenContent += colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan') + '\n';
    screenContent += colorText('Navigation is circular', 'dim') + '\n';
    screenContent += '\n';
    
    // Display menu options
    menuOptions.forEach((option, index) => {
      const isCurrent = index === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const optionText = isCurrent ? colorText(option.text, 'bright') : colorText(option.text, 'yellow');
      
      screenContent += `${indicator} ${optionText}\n`;
    });
    
    // Clear screen and output entire buffer at once
    clearScreen();
    console.log(screenContent);
    
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

// Headless benchmark mode
async function runHeadlessBenchmark(benchSpec, apiKey, useAiSdk) {
  try {
    // Parse provider:model format
    const [providerSpec, modelName] = benchSpec.split(':');
    
    if (!providerSpec || !modelName) {
      console.error(colorText('Error: Invalid --bench format. Use: provider:model', 'red'));
      console.error(colorText('Example: --bench zai-code-anth:glm-4.6', 'yellow'));
      process.exit(1);
    }

    // Load all available providers (include all models.dev providers for headless mode)
    const config = await loadConfig(true);
    
    // Find the provider (case-insensitive search)
    const provider = config.providers.find(p => 
      p.id?.toLowerCase() === providerSpec.toLowerCase() || 
      p.name?.toLowerCase() === providerSpec.toLowerCase()
    );
    
    if (!provider) {
      console.error(colorText(`Error: Provider '${providerSpec}' not found`, 'red'));
      console.error(colorText('Available providers:', 'yellow'));
      config.providers.forEach(p => {
        console.error(colorText(`  - ${p.id || p.name}`, 'cyan'));
      });
      process.exit(1);
    }

    // Find the model
    // Model IDs are prefixed with provider name (e.g., "zai-code-anth_glm-4.6")
    // So we need to check:
    // 1. Full ID match: "zai-code-anth_glm-4.6"
    // 2. ID without provider prefix: "glm-4.6"
    // 3. Name match: "GLM-4.6-anth"
    const model = provider.models.find(m => {
      const modelIdLower = m.id?.toLowerCase() || '';
      const modelNameLower = m.name?.toLowerCase() || '';
      const searchLower = modelName.toLowerCase();
      
      // Check full ID match
      if (modelIdLower === searchLower) return true;
      
      // Check ID without provider prefix (strip "provider_" prefix)
      const idWithoutPrefix = modelIdLower.includes('_') 
        ? modelIdLower.split('_').slice(1).join('_') 
        : modelIdLower;
      if (idWithoutPrefix === searchLower) return true;
      
      // Check name match
      if (modelNameLower === searchLower) return true;
      
      return false;
    });
    
    if (!model) {
      console.error(colorText(`Error: Model '${modelName}' not found in provider '${provider.name}'`, 'red'));
      console.error(colorText('Available models:', 'yellow'));
      provider.models.forEach(m => {
        // Show both name and ID (without provider prefix) for clarity
        const idWithoutPrefix = m.id?.includes('_') 
          ? m.id.split('_').slice(1).join('_') 
          : m.id;
        console.error(colorText(`  - ${m.name} (id: ${idWithoutPrefix})`, 'cyan'));
      });
      process.exit(1);
    }

    // If API key provided via flag, use it; otherwise use existing config
    let finalApiKey = apiKey || provider.apiKey;
    
    if (!finalApiKey) {
      console.error(colorText(`Error: No API key found for provider '${provider.name}'`, 'red'));
      console.error(colorText('Please provide --api-key flag or configure the provider first', 'yellow'));
      process.exit(1);
    }

    // Create model object with all required config
    const modelConfig = {
      ...model,
      providerName: provider.name,
      providerType: provider.type,
      providerId: provider.id,
      providerConfig: {
        ...provider,
        apiKey: finalApiKey,
        baseUrl: provider.baseUrl || ''
      },
      selected: true
    };

    // Run benchmark silently and get results
    let result;
    if (useAiSdk) {
      // TODO: Implement AI SDK silent benchmark
      console.error(colorText('AI SDK headless mode not yet implemented', 'red'));
      process.exit(1);
    } else {
      result = await benchmarkSingleModelRest(modelConfig);
    }

    // Output JSON to stdout
    const jsonOutput = {
      provider: provider.name,
      providerId: provider.id,
      model: model.name,
      modelId: model.id,
      method: useAiSdk ? 'ai-sdk' : 'rest-api',
      success: result.success,
      totalTime: result.totalTime,
      totalTimeSeconds: result.totalTime / 1000,
      timeToFirstToken: result.timeToFirstToken,
      timeToFirstTokenSeconds: result.timeToFirstToken / 1000,
      tokensPerSecond: result.tokensPerSecond,
      outputTokens: result.tokenCount,
      promptTokens: result.promptTokens,
      totalTokens: result.totalTokens,
      is_estimated: !!(result.usedEstimateForOutput || result.usedEstimateForInput),
      error: result.error || null
    };

    console.log(JSON.stringify(jsonOutput, null, cliArgs.formatted ? 2 : 0));
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(colorText('Error: ' + error.message, 'red'));
    if (debugMode) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Start the CLI
if (require.main === module) {
  // Check if help flag
  if (cliArgs.help) {
    showHelp();
    process.exit(0);
  }
  
  // Check if headless benchmark mode
  if (cliArgs.bench) {
    runHeadlessBenchmark(cliArgs.bench, cliArgs.apiKey, cliArgs.useAiSdk);
  } else {
    // Interactive mode
    cleanupRecentModelsFromConfig().then(() => {
      showMainMenu();
    }).catch(() => {
      showMainMenu();
    });
  }
}

export { showMainMenu, listProviders, selectModelsCircular, runStreamingBenchmark, loadConfig, saveConfig };