# Ai-speedometer

A comprehensive, modern CLI tool for benchmarking AI models across multiple providers with **parallel execution**, **professional tables**, **arrow key navigation**, and **advanced metrics**.

## Quick Start

```bash
git clone https://github.com/aptdnfapt/Ai-speedometer
# Install dependencies
npm install
# Set up your API keys and providers (see Setup Guide below)
# Start the CLI
npm run cli


```
Debug 
```bash
# Start with debug logging (for troubleshooting)
npm run cli:debug
```

## Setup Guide

### Before You Begin

Before running the benchmark, you need to configure your AI providers with API keys and base URLs. The tool supports two types of providers:

1. **OpenAI-Compatible providers** (OpenAI, local models, custom endpoints)
2. **Anthropic providers** (Claude models)

### Step 1: Get Your API Keys

#### OpenAI-Compatible Providers
- **OpenAI**: Get your API key from [OpenAI API Keys](https://platform.openai.com/api-keys)
- **Other providers**: Check your provider's documentation for API key access

#### Anthropic Providers
- **Anthropic**: Get your API key from [Anthropic Console](https://console.anthropic.com/settings/keys)

### Step 2: Configure Providers

You have two ways to configure providers:

#### Method A: Use the Interactive CLI (Recommended)

1. Run the CLI:
   ```bash
   npm run cli
   ```

2. Select "Set Model" from the main menu

3. Choose "Add New Provider"

4. Select the provider type:
   - **OpenAI Compatible**: For OpenAI, local models, or custom endpoints
   - **Anthropic**: For Claude models

5. Enter the required information:
   - **Provider name**: A friendly name (e.g., "My OpenAI", "Local Ollama")
   - **Base URL**: The API endpoint (see examples below)
   - **API Key**: Your secret API key
   - **Model name**: The specific model you want to test

#### Method B: Manual Configuration

1. Copy the template:
   ```bash
   cp ai-benchmark-config.json.template ai-benchmark-config.json
   ```

2. Edit `ai-benchmark-config.json` with your provider details:

   ```json
   {
     "providers": [
       {
         "id": "my_openai",
         "name": "OpenAI",
         "type": "openai-compatible",
         "baseUrl": "https://api.openai.com/v1",
         "apiKey": "sk-your-openai-key-here",
         "models": [
           {
             "name": "gpt-4",
             "id": "gpt4_model"
           }
         ]
       },
       {
         "id": "my_anthropic",
         "name": "Anthropic",
         "type": "anthropic",
         "baseUrl": "https://api.anthropic.com",
         "apiKey": "sk-ant-your-anthropic-key-here",
         "models": [
           {
             "name": "claude-3-sonnet-20240229",
             "id": "claude3_sonnet"
           }
         ]
       }
     ]
   }
   ```

### Step 3: Common Base URL Examples

#### OpenAI-Compatible Providers
- **OpenAI**: `https://api.openai.com/v1`
- **Local Ollama**: `http://localhost:11434/v1`
- **Groq**: `https://api.groq.com/openai/v1`
- **Together AI**: `https://api.together.xyz/v1`
- **Anyscale**: `https://api.endpoints.anyscale.com/v1`
- **Fireworks AI**: `https://api.fireworks.ai/inference/v1`

#### Anthropic Providers
- **Anthropic Official**: `https://api.anthropic.com`
- **Custom Anthropic endpoints**: Check with your provider

### Step 4: Security

Your configuration file contains sensitive API keys. The `.gitignore` file already excludes `ai-benchmark-config.json` to prevent accidental commits.

**Never commit your API keys to version control!**

### Step 5: Verify Configuration

After setting up, run the CLI and check that your providers appear in the model selection menu. If you see your providers and models listed, you're ready to benchmark!

### Troubleshooting

- **"Provider not found"**: Check your base URL and API key
- **"Model not available"**: Verify the model name is correct for your provider
- **"Connection failed"**: Ensure your base URL is accessible and you have internet access
- **"Invalid API key"**: Double-check your API key is correct and has proper permissions
- **Debug Mode**: Use `npm run cli:debug` to enable detailed logging. This creates a `debug.log` file with API request/response details for troubleshooting connection issues.

## Usage Examples

### Main Menu (Modern Arrow Navigation)
```
Ai-speedometer
=============================
Note: opencode uses ai-sdk

Use ↑↓ arrows to navigate, ENTER to select
Navigation is circular

● Set Model
○ Run Benchmark (AI SDK)
○ Run Benchmark (REST API)
○ Exit
```

### Model Selection (Circle-Based UI)
```
Select Models for Benchmark

Use ↑↓ arrows to navigate, SPACE to select/deselect, ENTER to confirm
Navigation is circular - moving past bottom/top wraps around
Press "A" to select all models, "N" to deselect all
Circle states: ●=Current+Selected  ○=Current+Unselected  ●=Selected  ○=Unselected

Available Models:
● gpt-4 (OpenAI)
○ claude-3-sonnet (Anthropic)

Selected: 1 models
```

### Provider Management (Vertical Stacking)
```
Available Providers

1. chutes (openai-compatible)
   Models:
     1. zai-org/GLM-4.5-turbo
     2. deepseek-ai/DeepSeek-V3.1-turbo

2. zai (openai-compatible)
   Models:
     1. glm-4.5

3. zai-anthropic (anthropic)
   Models:
     1. claude-3-sonnet-20240229
```

### Benchmark Results (Professional Tables + Enhanced Charts)
```
BENCHMARK RESULTS
=========================
Method: AI SDK

COMPREHENSIVE PERFORMANCE SUMMARY
Note: AI SDK method does not count thinking tokens as first token. REST API method does not use streaming.
┌─────────────────────────┬─────────────────────┬─────────────────┬────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Model                  │ Provider            │ Total Time(s)   │ TTFT(s)    │ Tokens/Sec     │ Output Tokens   │ Prompt Tokens   │ Total Tokens    │
├─────────────────────────┼─────────────────────┼─────────────────┼────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ zai-org/GLM-4.5-turbo  │ chutes              │ 11.47           │ 1.00       │ 81.5           │ 935             │ 14              │ 1205            │
│ deepseek-ai/DeepSeek-V3 │ chutes              │ 5.21            │ 0.83       │ 178.6          │ 930             │ 14              │ 742             │
│ glm-4.5                │ zai                 │ 11.30           │ 5.30       │ 72.9           │ 824             │ 14              │ 1087            │
└─────────────────────────┴─────────────────────┴─────────────────┴────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘

PERFORMANCE COMPARISON CHARTS
──────────────────────────────────────────────────────────────────────────────────────────

TOTAL TIME COMPARISON (lower is better)
   5.21s |     178.6 tok/s | deepseek-ai/DeepSeek-V3.1-turbo | ████████████████████████████████████████████████
  11.30s |      72.9 tok/s | glm-4.5                                | ████████████████████████████████████░░░░░░░░░
  11.47s |      81.5 tok/s | zai-org/GLM-4.5-turbo                   | ████████████████████████████████████░░░░░░░░░

TOKENS PER SECOND COMPARISON (higher is better)
     178.6 tok/s |    5.21s | deepseek-ai/DeepSeek-V3.1-turbo | █████████████████████████████████████████████████████
      81.5 tok/s |   11.47s | zai-org/GLM-4.5-turbo                   | ████████████████████████████████░░░░░░░░░░░░░░░░
      72.9 tok/s |   11.30s | glm-4.5                                | ████████████████████████████████░░░░░░░░░░░░░░░░

Benchmark completed!
```

## Configuration

### Adding Providers (Arrow Key Navigation)

#### OpenAI-Compatible Providers
```
Add New Provider

Use ↑↓ arrows to navigate, ENTER to select
Navigation is circular

Select provider type:

● OpenAI Compatible
○ Anthropic
○ Back to main menu
```

#### Anthropic Providers (Now Supports Custom Base URLs)
```
Enter provider name (e.g., MyAnthropic):
Enter base URL (e.g., https://api.anthropic.com):
Enter Anthropic API key: [your-key]
Enter model name (e.g., claude-3-sonnet-20240229):
```

**Note**: The system automatically handles `/v1` path requirements for custom Anthropic endpoints. If you encounter issues with custom base URLs, run `npm run cli:debug` to see detailed API request logs.


## Performance Metrics Explained

### Core Metrics
- **Total Time**: Complete request duration (seconds)
- **Time to First Token (TTFT)**: Latency until first streaming token arrives (0 for REST API since it doesn't use streaming)
- **Tokens per Second**: Real-time throughput calculation
- **Output Tokens**: Number of tokens in the AI response
- **Prompt Tokens**: Number of tokens in the input prompt
- **Total Tokens**: Combined prompt + output tokens

### Benchmark Methods
- **AI SDK Method**: Uses streaming with Vercel AI SDK, doesn't count thinking tokens as first token
- **REST API Method**: Uses direct HTTP calls, no streaming, TTFT is always 0

### Chart Features
- **Dual Comparison Charts**: Both time and performance perspectives
- **Left-Side Metrics**: Shows actual values alongside bar charts
- **Color Coding**: Red bars for time (lower is better), green for performance (higher is better)
- **Dynamic Scaling**: Bars scale proportionally to the best/worst performers

## Tech Stack

- **AI SDK**: Vercel AI SDK with streaming support (opencode uses it)
- **Table Rendering**: `cli-table3` for professional tables
- **Providers**: OpenAI-compatible and Anthropic APIs with custom baseUrl support
- **Navigation**: Circular arrow key navigation throughout
- **Colors**: ANSI escape codes for terminal styling
- **Configuration**: JSON-based persistent storage
- **Security**: .gitignore protection for sensitive files
- **Debug Logging**: Built-in debugging system for troubleshooting API connections

## Requirements

- Node.js 18+
- API keys for AI providers
- Terminal that supports ANSI colors and arrow keys
- Git (for security configuration)


## Advanced Features

### Parallel Execution
- **Speed**: Runs all selected models simultaneously
- **Efficiency**: No sequential waiting between models
- **Results**: Comprehensive comparison across all models

### Advanced Navigation
- **Universal Pattern**: All menus use the same arrow key navigation
- **Circular Movement**: Navigation wraps at top/bottom for seamless UX
- **Visual Feedback**: Clear indicators for current selections
- **Keyboard Shortcuts**: Quick actions like select all ('A') and deselect all ('N')

### Professional Output
- **Table Format**: Clean, aligned columns with proper spacing
- **Color Coding**: Different colors for different metric types
- **Comprehensive Data**: All relevant metrics in one view
- **Visual Charts**: Bar charts for quick visual comparison

