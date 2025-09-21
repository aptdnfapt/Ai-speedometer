#!/usr/bin/env node

import readline from 'readline';
import fs from 'fs';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';  // Changed from streamText to generateText
import { testPrompt } from './test-prompt.js';
import { LLMBenchmark } from './benchmark-rest.js';
import { getAllProviders, searchProviders, getModelsForProvider } from './models-dev.js';
import { 
  getAllAvailableProviders, 
  addApiKey, 
  getCustomProviders, 
  migrateFromOldConfig,
  getDebugInfo 
} from './opencode-integration.js';
import 'dotenv/config';
import Table from 'cli-table3';

// Check for debug flag
const debugMode = process.argv.includes('--debug');
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
  
  // Ensure base URL ends with /v1 for AI SDK compatibility
  let normalizedBaseUrl = baseUrl;
  if (!baseUrl.endsWith('/v1')) {
    normalizedBaseUrl = baseUrl.endsWith('/') ? `${baseUrl}v1` : `${baseUrl}/v1`;
    log(`Normalized base URL to: ${normalizedBaseUrl}`);
  }
  
  // Try with baseURL parameter (correct according to docs)
  const provider = createAnthropic({
    apiKey: apiKey,
    baseURL: normalizedBaseUrl,
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
  console.log(colorText('Note: opencode uses ai-sdk', 'dim'));
  console.log('');
}

// Configuration management - now using opencode files
async function loadConfig() {
  try {
    // Check if we need to migrate from old config
    const oldConfigFile = 'ai-benchmark-config.json';
    if (fs.existsSync(oldConfigFile)) {
      console.log(colorText('Migrating from old config format to opencode format...', 'yellow'));
      
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
    
    // Load providers from opencode integration
    const providers = await getAllAvailableProviders();
    
    return {
      providers,
      verifiedProviders: {} // Keep for compatibility but no longer used
    };
  } catch (error) {
    console.log(colorText('Error loading config, starting fresh: ', 'yellow') + error.message);
    return { providers: [], verifiedProviders: {} };
  }
}

// Save config - now using opencode files
async function saveConfig(config) {
  // Note: This function is kept for compatibility but the actual saving
  // is handled by the opencode integration functions (addApiKey, etc.)
  console.log(colorText('Note: Configuration is now automatically saved to opencode files', 'cyan'));
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
  
  let currentIndex = 0;
  let currentPage = 0;
  let searchQuery = '';
  let filteredModels = [...allModels];
  
  while (true) {
    clearScreen();
    showHeader();
    console.log(colorText('Select Models for Benchmark', 'magenta'));
    console.log(colorText('Use ↑↓ arrows to navigate, SPACE to select/deselect, ENTER to confirm', 'cyan'));
    console.log(colorText('Type to search (real-time filtering)', 'cyan'));
    console.log(colorText('Press "A" to select all models, "N" to deselect all', 'cyan'));
    console.log(colorText('Circle states: ●=Current+Selected  ○=Current+Unselected  ●=Selected  ○=Unselected', 'dim'));
    console.log('');
    
    // Search interface - always visible
    console.log(colorText('Search: ', 'yellow') + colorText(searchQuery + '_', 'bright'));
    console.log('');
    
    // Calculate pagination
    const visibleItemsCount = getVisibleItemsCount(12); // Extra space for search bar
    const totalPages = Math.ceil(filteredModels.length / visibleItemsCount);
    
    // Ensure current page is valid
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;
    
    const startIndex = currentPage * visibleItemsCount;
    const endIndex = Math.min(startIndex + visibleItemsCount, filteredModels.length);
    
    // Display models in a vertical layout with pagination
    console.log(colorText('Available Models:', 'yellow'));
    console.log('');
    
    for (let i = startIndex; i < endIndex; i++) {
      const model = filteredModels[i];
      const isCurrent = i === currentIndex;
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
    }
    
    console.log('');
    console.log(colorText(`Selected: ${allModels.filter(m => m.selected).length} models`, 'yellow'));
    
    // Show pagination info
    if (totalPages > 1) {
      const pageInfo = colorText(`Page ${currentPage + 1}/${totalPages}`, 'cyan');
      const navHint = colorText('Use Page Up/Down to navigate pages', 'dim');
      console.log(`${pageInfo} ${navHint}`);
      
      if (currentPage < totalPages - 1) {
        console.log(colorText('↓ More models below', 'dim'));
      }
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
    } else if (key === '\u001b[B') {
      // Down arrow - circular navigation within current page
      const pageStartIndex = currentPage * visibleItemsCount;
      const pageEndIndex = Math.min(pageStartIndex + visibleItemsCount, filteredModels.length);
      
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
    } else if (key === ' ') {
      // Spacebar
      const actualModelIndex = allModels.indexOf(filteredModels[currentIndex]);
      if (actualModelIndex !== -1) {
        allModels[actualModelIndex].selected = !allModels[actualModelIndex].selected;
      }
    } else if (key === '\r') {
      // Enter
      break;
    } else if (key === '\u0003') {
      // Ctrl+C
      process.exit(0);
    } else if (key === '\b' || key === '\x7f') {
      // Backspace - delete character from search
      if (searchQuery.length > 0) {
        searchQuery = searchQuery.slice(0, -1);
        // Filter models based on search query
        const lowercaseQuery = searchQuery.toLowerCase();
        filteredModels = allModels.filter(model => {
          const modelNameMatch = model.name.toLowerCase().includes(lowercaseQuery);
          const providerNameMatch = model.providerName.toLowerCase().includes(lowercaseQuery);
          const providerIdMatch = model.providerId.toLowerCase().includes(lowercaseQuery);
          const providerTypeMatch = model.providerType.toLowerCase().includes(lowercaseQuery);
          
          return modelNameMatch || providerNameMatch || providerIdMatch || providerTypeMatch;
        });
        currentIndex = 0;
        currentPage = 0;
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
      } else {
        // If search is active, add 'A' to search query
        searchQuery += key;
        const lowercaseQuery = searchQuery.toLowerCase();
        filteredModels = allModels.filter(model => 
          model.name.toLowerCase().includes(lowercaseQuery) ||
          model.providerName.toLowerCase().includes(lowercaseQuery)
        );
        currentIndex = 0;
        currentPage = 0;
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
      } else {
        // If search is active, add 'N' to search query
        searchQuery += key;
        const lowercaseQuery = searchQuery.toLowerCase();
        filteredModels = allModels.filter(model => 
          model.name.toLowerCase().includes(lowercaseQuery) ||
          model.providerName.toLowerCase().includes(lowercaseQuery)
        );
        currentIndex = 0;
        currentPage = 0;
      }
    } else if (key === 'a' || key === 'n') {
      // Lowercase 'a' and 'n' go to search field (not select all/none)
      searchQuery += key;
      const lowercaseQuery = searchQuery.toLowerCase();
      filteredModels = allModels.filter(model => 
        model.name.toLowerCase().includes(lowercaseQuery) ||
        model.providerName.toLowerCase().includes(lowercaseQuery)
      );
      currentIndex = 0;
      currentPage = 0;
    } else if (key.length === 1) {
      // Regular character - add to search query
      searchQuery += key;
      // Filter models based on search query
      const lowercaseQuery = searchQuery.toLowerCase();
      filteredModels = allModels.filter(model => 
        model.name.toLowerCase().includes(lowercaseQuery) ||
        model.providerName.toLowerCase().includes(lowercaseQuery)
      );
      currentIndex = 0;
      currentPage = 0;
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
  
  // Sort results by tokens per second (descending) for table ranking
  const sortedResults = [...successfulResults].sort((a, b) => b.tokensPerSecond - a.tokensPerSecond);
  
  // Add data rows (already ranked by sort order)
  sortedResults.forEach((result) => {
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
  
  console.log(colorText('Benchmark completed!', 'green'));
  await question(colorText('Press Enter to continue...', 'yellow'));
}

// Helper function to calculate visible items based on terminal height
function getVisibleItemsCount(headerHeight = 8) {
  const terminalHeight = process.stdout.rows || 24;
  return Math.max(5, terminalHeight - headerHeight);
}

// Provider management with models.dev integration and pagination
async function addProvider() {
  clearScreen();
  showHeader();
  console.log(colorText('Add Provider', 'magenta'));
  console.log('');
  
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
    console.log(colorText('Error loading providers: ', 'red') + error.message);
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  while (true) {
    clearScreen();
    showHeader();
    console.log(colorText('Add Provider', 'magenta'));
    console.log(colorText('Use ↑↓ arrows to navigate, ENTER to select', 'cyan'));
    console.log(colorText('Type to search (real-time filtering)', 'cyan'));
    console.log(colorText('Navigation is circular', 'dim'));
    console.log('');
    
    // Search interface - always visible
    console.log(colorText('Search: ', 'yellow') + colorText(searchQuery + '_', 'bright'));
    console.log('');
    
    // Calculate pagination
    const visibleItemsCount = getVisibleItemsCount();
    const totalItems = filteredProviders.length + 1; // +1 for custom provider option
    const totalPages = Math.ceil(totalItems / visibleItemsCount);
    
    // Ensure current page is valid
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;
    
    const startIndex = currentPage * visibleItemsCount;
    const endIndex = Math.min(startIndex + visibleItemsCount, totalItems);
    
    // Display providers with pagination
    console.log(colorText('Available Providers:', 'cyan'));
    console.log('');
    
    // Show current page of providers
    for (let i = startIndex; i < endIndex && i < filteredProviders.length; i++) {
      const provider = filteredProviders[i];
      const isCurrent = i === currentIndex;
      const indicator = isCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const providerName = isCurrent ? colorText(provider.name, 'bright') : colorText(provider.name, 'white');
      const providerType = isCurrent ? colorText(`(${provider.type})`, 'cyan') : colorText(`(${provider.type})`, 'dim');
      
      console.log(`${indicator} ${providerName} ${providerType}`);
    }
    
    // Show "Add Custom Provider" option if it's on current page
    const customIndex = filteredProviders.length;
    if (customIndex >= startIndex && customIndex < endIndex) {
      const isCustomCurrent = customIndex === currentIndex;
      const customIndicator = isCustomCurrent ? colorText('●', 'green') : colorText('○', 'dim');
      const customText = isCustomCurrent ? colorText('Add Custom Provider', 'bright') : colorText('Add Custom Provider', 'yellow');
      
      console.log(`${customIndicator} ${customText}`);
    }
    
    // Show pagination info
    console.log('');
    if (totalPages > 1) {
      const pageInfo = colorText(`Page ${currentPage + 1}/${totalPages}`, 'cyan');
      const navHint = colorText('Use Page Up/Down to navigate pages', 'dim');
      console.log(`${pageInfo} ${navHint}`);
      
      if (currentPage < totalPages - 1) {
        console.log(colorText('↓ More items below', 'dim'));
      }
    }
    
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
      // Enter - select current option
      if (currentIndex === filteredProviders.length) {
        // Custom provider selected
        await addCustomProvider();
      } else {
        // Verified provider selected - auto-add all models
        await addVerifiedProviderAuto(filteredProviders[currentIndex]);
      }
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
  
  // Add API key to opencode auth.json
  const success = await addApiKey(provider.id, apiKey);
  
  if (!success) {
    console.log(colorText('Failed to save API key to opencode auth.json', 'red'));
    await question(colorText('Press Enter to continue...', 'yellow'));
    return;
  }
  
  console.log('');
  console.log(colorText('Provider added successfully!', 'green'));
  console.log(colorText(`API key saved to opencode auth.json`, 'cyan'));
  console.log(colorText(`Models will be loaded dynamically from ${provider.name}`, 'cyan'));
  console.log(colorText(`Found ${models.length} available models`, 'cyan'));
  
  await question(colorText('\nPress Enter to continue...', 'yellow'));
}



// Add a custom provider (now integrated with opencode.json)
async function addCustomProvider() {
  clearScreen();
  showHeader();
  console.log(colorText('Add Custom Provider', 'magenta'));
  console.log('');
  console.log(colorText('Note: Custom providers are saved to opencode.json', 'cyan'));
  console.log('');
  
  const providerOptions = [
    { id: 1, text: 'OpenAI Compatible', type: 'openai-compatible' },
    { id: 2, text: 'Anthropic', type: 'anthropic' },
    { id: 3, text: 'Back to provider selection', action: 'back' }
  ];
  
  let currentIndex = 0;
  let selectedChoice = null;
  
  while (true) {
    clearScreen();
    showHeader();
    console.log(colorText('Add Custom Provider', 'magenta'));
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
  
  if (selectedChoice.type === 'openai-compatible') {
    // OpenAI Compatible
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
    
    let models = {};
    
    if (modelChoice === '2') {
      // Multiple models mode
      console.log('');
      console.log(colorText('Enter model names (one per line, empty line to finish):', 'cyan'));
      console.log(colorText('Examples: gpt-4, gpt-4-turbo, gpt-3.5-turbo', 'dim'));
      console.log('');
      
      while (true) {
        const modelName = await question(colorText('Model name: ', 'cyan'));
        if (!modelName.trim()) break;
        
        const modelId = modelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
        models[modelId] = {
          name: modelName.trim()
        };
      }
    } else {
      // Single model mode
      const modelName = await question(colorText('Enter model name (e.g., gpt-4): ', 'cyan'));
      const modelId = modelName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      models[modelId] = {
        name: modelName
      };
    }
    
    if (Object.keys(models).length === 0) {
      console.log(colorText('At least one model is required.', 'red'));
      await question(colorText('Press Enter to continue...', 'yellow'));
      return;
    }
    
    // Create opencode.json format
    const { readOpencodeConfig } = await import('./opencode-integration.js');
    const config = await readOpencodeConfig();
    
    config.provider = config.provider || {};
    config.provider[providerId] = {
      name,
      options: {
        apiKey,
        baseURL: baseUrl
      },
      models
    };
    
    // Save to opencode.json using the integration module
    const { writeOpencodeConfig } = await import('./opencode-integration.js');
    const success = await writeOpencodeConfig(config);
    
    if (!success) {
      console.log(colorText('Warning: Could not save to opencode.json', 'yellow'));
    }
    
    console.log(colorText('Provider added successfully!', 'green'));
    console.log(colorText(`Added ${Object.keys(models).length} model(s)`, 'cyan'));
    console.log(colorText(`Saved to opencode.json`, 'cyan'));
    
  } else if (selectedChoice.type === 'anthropic') {
    // Anthropic
    const providerId = await question(colorText('Enter provider ID (e.g., my-anthropic): ', 'cyan'));
    const name = await question(colorText('Enter provider name (e.g., MyAnthropic): ', 'cyan'));
    const baseUrl = await question(colorText('Enter base URL (e.g., https://api.anthropic.com): ', 'cyan'));
    const apiKey = await question(colorText('Enter Anthropic API key: ', 'cyan'));
    
    // Ask if user wants to add multiple models
    console.log('');
    console.log(colorText('Do you want to add multiple models?', 'cyan'));
    console.log(colorText('1. Add single model', 'yellow'));
    console.log(colorText('2. Add multiple models', 'yellow'));
    
    const modelChoice = await question(colorText('Enter choice (1 or 2): ', 'cyan'));
    
    let models = {};
    
    if (modelChoice === '2') {
      // Multiple models mode
      console.log('');
      console.log(colorText('Enter model names (one per line, empty line to finish):', 'cyan'));
      console.log(colorText('Examples: claude-3-sonnet-20240229, claude-3-haiku-20240307', 'dim'));
      console.log('');
      
      while (true) {
        const modelName = await question(colorText('Model name: ', 'cyan'));
        if (!modelName.trim()) break;
        
        const modelId = modelName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
        models[modelId] = {
          name: modelName.trim()
        };
      }
    } else {
      // Single model mode
      const modelName = await question(colorText('Enter model name (e.g., claude-3-sonnet-20240229): ', 'cyan'));
      const modelId = modelName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      models[modelId] = {
        name: modelName
      };
    }
    
    if (Object.keys(models).length === 0) {
      console.log(colorText('At least one model is required.', 'red'));
      await question(colorText('Press Enter to continue...', 'yellow'));
      return;
    }
    
    // Create opencode.json format
    const { readOpencodeConfig } = await import('./opencode-integration.js');
    const config = await readOpencodeConfig();
    
    config.provider = config.provider || {};
    config.provider[providerId] = {
      name,
      options: {
        apiKey,
        baseURL: baseUrl
      },
      models
    };
    
    // Save to opencode.json using the integration module
    const { writeOpencodeConfig } = await import('./opencode-integration.js');
    const success = await writeOpencodeConfig(config);
    
    if (!success) {
      console.log(colorText('Warning: Could not save to opencode.json', 'yellow'));
    }
    
    console.log(colorText('Provider added successfully!', 'green'));
    console.log(colorText(`Added ${Object.keys(models).length} model(s)`, 'cyan'));
    console.log(colorText(`Saved to opencode.json`, 'cyan'));
  }
  
  await question(colorText('\nPress Enter to continue...', 'yellow'));
}

// Show debug information about opencode integration
async function showDebugInfo() {
  clearScreen();
  showHeader();
  console.log(colorText('OpenCode Integration Debug Info', 'magenta'));
  console.log('');
  
  const debugInfo = await getDebugInfo();
  
  console.log(colorText('File Paths:', 'cyan'));
  console.log(colorText(`  auth.json: ${debugInfo.paths.authJson}`, 'white'));
  console.log(colorText(`  opencode.json: ${debugInfo.paths.opencodeJson}`, 'white'));
  console.log('');
  
  console.log(colorText('File Status:', 'cyan'));
  console.log(colorText(`  auth.json exists: ${debugInfo.authExists ? 'Yes' : 'No'}`, 'white'));
  console.log(colorText(`  opencode.json exists: ${debugInfo.configExists ? 'Yes' : 'No'}`, 'white'));
  console.log('');
  
  console.log(colorText('Authenticated Providers:', 'cyan'));
  if (debugInfo.authData.length === 0) {
    console.log(colorText('  None', 'dim'));
  } else {
    debugInfo.authData.forEach(provider => {
      console.log(colorText(`  - ${provider}`, 'white'));
    });
  }
  console.log('');
  
  console.log(colorText('Custom Providers:', 'cyan'));
  if (debugInfo.configProviders.length === 0) {
    console.log(colorText('  None', 'dim'));
  } else {
    debugInfo.configProviders.forEach(provider => {
      console.log(colorText(`  - ${provider}`, 'white'));
    });
  }
  console.log('');
  
  console.log(colorText('XDG Paths:', 'cyan'));
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
  
  const config = await loadConfig();
  
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
  
  // Find the provider in customProviders and add the model
  const customProvider = config.customProviders.find(p => p.id === provider.id);
  if (customProvider) {
    customProvider.models.push({
      name: modelName,
      id: Date.now().toString() + '_model'
    });
  } else {
    // If it's a verified provider, we need to convert it to custom
    provider.models.push({
      name: modelName,
      id: Date.now().toString() + '_model'
    });
    // Remove from verifiedProviders and add to customProviders
    if (config.verifiedProviders && config.verifiedProviders[provider.id]) {
      delete config.verifiedProviders[provider.id];
    }
    config.customProviders.push(provider);
  }
  
  await saveConfig(config);
  console.log(colorText('Model added successfully!', 'green'));
  await question(colorText('\nPress Enter to continue...', 'yellow'));
}

// REST API benchmark function using direct API calls
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
      // Validate required configuration
      if (!model.providerConfig || !model.providerConfig.apiKey) {
        throw new Error(`Missing API key for provider ${model.providerName}`);
      }
      
      if (!model.providerConfig.baseUrl) {
        throw new Error(`Missing base URL for provider ${model.providerName}`);
      }
      
      const startTime = Date.now();
      
      // Use correct endpoint based on provider type
      let endpoint;
      if (model.providerType === 'anthropic') {
        endpoint = '/messages';
      } else if (model.providerType === 'google') {
        endpoint = '/models/' + actualModelId + ':generateContent';
      } else {
        endpoint = '/chat/completions';
      }
      
      // Ensure baseUrl doesn't end with slash and endpoint doesn't start with slash
      const baseUrl = model.providerConfig.baseUrl.replace(/\/$/, '');
      const url = `${baseUrl}${endpoint}`;
      
      // Extract the actual model ID for API calls
      let actualModelId = model.name;
      if (model.id && model.id.includes('_')) {
        // For models with provider prefix, extract the actual model ID
        actualModelId = model.id.split('_')[1];
        console.log(colorText(`  Using extracted model ID: ${actualModelId}`, 'cyan'));
      }
      
      // Trim any trailing spaces from model names
      actualModelId = actualModelId.trim();
      console.log(colorText(`  Using final model ID: "${actualModelId}"`, 'cyan'));
      
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.providerConfig.apiKey}`
      };

      // Add provider-specific headers
      if (model.providerType === 'anthropic') {
        headers['x-api-key'] = model.providerConfig.apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else if (model.providerType === 'google') {
        // Google uses different auth
        delete headers['Authorization'];
        headers['x-goog-api-key'] = model.providerConfig.apiKey;
      }

      const body = {
        model: actualModelId,
        messages: [
          { role: 'user', content: testPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      };

      // Adjust for provider-specific formats
      if (model.providerType === 'anthropic') {
        body.max_tokens = 500;
      } else if (model.providerType === 'google') {
        // Google format is slightly different
        body.contents = [{ parts: [{ text: testPrompt }] }];
        body.generationConfig = {
          maxOutputTokens: 500,
          temperature: 0.7
        };
        delete body.messages;
        delete body.max_tokens;
      }

      console.log(colorText(`  Making request to: ${url}`, 'cyan'));
      console.log(colorText(`  Using model: ${actualModelId}`, 'cyan'));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });

      console.log(colorText(`  Response status: ${response.status}`, 'cyan'));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log(colorText(`  Error: ${errorText.slice(0, 200)}...`, 'red'));
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Calculate tokens based on provider type
      let inputTokens, outputTokens;
      
      if (model.providerType === 'anthropic') {
        inputTokens = data.usage?.input_tokens || Math.round(testPrompt.length / 4);
        outputTokens = data.usage?.output_tokens || Math.round(data.content?.[0]?.text?.length / 4 || 0);
      } else if (model.providerType === 'google') {
        inputTokens = data.usageMetadata?.promptTokenCount || Math.round(testPrompt.length / 4);
        outputTokens = data.usageMetadata?.candidatesTokenCount || Math.round(data.candidates?.[0]?.content?.parts?.[0]?.text?.length / 4 || 0);
      } else {
        inputTokens = data.usage?.prompt_tokens || Math.round(testPrompt.length / 4);
        outputTokens = data.usage?.completion_tokens || Math.round(data.choices?.[0]?.message?.content?.length / 4 || 0);
      }
      
      const totalTokens = inputTokens + outputTokens;
      const tokensPerSecond = totalTime > 0 ? (totalTokens / totalTime) * 1000 : 0;

      console.log(colorText('Completed!', 'green'));
      console.log(colorText(`  Total Time: ${(totalTime / 1000).toFixed(2)}s`, 'cyan'));
      console.log(colorText(`  Tokens/Sec: ${tokensPerSecond.toFixed(1)}`, 'cyan'));
      console.log(colorText(`  Input Tokens: ${inputTokens}`, 'cyan'));
      console.log(colorText(`  Output Tokens: ${outputTokens}`, 'cyan'));
      console.log(colorText(`  Total Tokens: ${totalTokens}`, 'cyan'));
      
      return {
        model: model.name,
        provider: model.providerName,
        totalTime: totalTime,
        timeToFirstToken: 0, // REST API doesn't track TTFT
        tokenCount: outputTokens,
        tokensPerSecond: tokensPerSecond,
        promptTokens: inputTokens,
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
    { id: 2, text: 'List Existing Providers', action: () => listProviders() },
    { id: 3, text: 'Add Model to Provider', action: () => addModelToProvider() },
    { id: 4, text: 'Debug Info', action: () => showDebugInfo() },
    { id: 5, text: 'Back to Main Menu', action: () => 'back' }
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

export { showMainMenu, addProvider, listProviders, selectModelsCircular, runStreamingBenchmark, loadConfig, saveConfig };