# 🚀 AI Speed Benchmark CLI

A comprehensive, modern CLI tool for benchmarking AI models across multiple providers with **parallel execution**, **professional tables**, **arrow key navigation**, and **advanced metrics**.

## 🚀 Quick Start

```bash
git clone https://github.com/aptdnfapt/Ai-speedometer
# Install dependencies
npm install
# Start the CLI
npm run cli
```

## 🎮 Usage Examples

### Main Menu (Modern Arrow Navigation)
```
🚀 AI Speed Benchmark CLI
=============================

Use ↑↓ arrows to navigate, ENTER to select
Navigation is circular

● Set Model
○ Run Benchmark  
○ Exit
```

### Model Selection (Circle-Based UI)
```
🎯 Select Models for Benchmark

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
📋 Available Providers

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
📊 BENCHMARK RESULTS
=========================

📈 COMPREHENSIVE PERFORMANCE SUMMARY
┌─────────────────────────┬─────────────────────┬─────────────────┬────────────┬─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Model                  │ Provider            │ Total Time(s)   │ TTFT(s)    │ Tokens/Sec     │ Output Tokens   │ Prompt Tokens   │ Total Tokens    │
├─────────────────────────┼─────────────────────┼─────────────────┼────────────┼─────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ zai-org/GLM-4.5-turbo  │ chutes              │ 11.47           │ 1.00       │ 81.5           │ 935             │ 14              │ 1205            │
│ deepseek-ai/DeepSeek-V3 │ chutes              │ 5.21            │ 0.83       │ 178.6          │ 930             │ 14              │ 742             │
│ glm-4.5                │ zai                 │ 11.30           │ 5.30       │ 72.9           │ 824             │ 14              │ 1087            │
└─────────────────────────┴─────────────────────┴─────────────────┴────────────┴─────────────────┴─────────────────┴─────────────────┴─────────────────┘

📊 PERFORMANCE COMPARISON CHARTS
──────────────────────────────────────────────────────────────────────────────────────────

⏱️  TOTAL TIME COMPARISON (lower is better)
   5.21s |     178.6 tok/s | deepseek-ai/DeepSeek-V3.1-turbo | ████████████████████████████████████████████████
  11.30s |      72.9 tok/s | glm-4.5                                | ████████████████████████████████████░░░░░░░░░
  11.47s |      81.5 tok/s | zai-org/GLM-4.5-turbo                   | ████████████████████████████████████░░░░░░░░░

⚡ TOKENS PER SECOND COMPARISON (higher is better)
     178.6 tok/s |    5.21s | deepseek-ai/DeepSeek-V3.1-turbo | █████████████████████████████████████████████████████
      81.5 tok/s |   11.47s | zai-org/GLM-4.5-turbo                   | ████████████████████████████████░░░░░░░░░░░░░░░░
      72.9 tok/s |   11.30s | glm-4.5                                | ████████████████████████████████░░░░░░░░░░░░░░░░

🎉 Benchmark completed!
```

## 🔧 Configuration

### Adding Providers (Arrow Key Navigation)

#### OpenAI-Compatible Providers
```
➕ Add New Provider

Use ↑↓ arrows to navigate, ENTER to select
Navigation is circular

Select provider type:

● OpenAI Compatible
○ Anthropic
○ Back to main menu
```

#### Anthropic Providers (Now Supports baseUrl)
```
Enter provider name (e.g., MyAnthropic):
Enter base URL (e.g., https://api.anthropic.com):
Enter Anthropic API key: [your-key]
Enter model name (e.g., claude-3-sonnet-20240229):
```


## ⚡ Performance Metrics Explained

### Core Metrics
- **Total Time**: Complete request duration (seconds)
- **Time to First Token (TTFT)**: Latency until first streaming token arrives
- **Tokens per Second**: Real-time throughput calculation
- **Output Tokens**: Number of tokens in the AI response
- **Prompt Tokens**: Number of tokens in the input prompt
- **Total Tokens**: Combined prompt + output tokens

### Chart Features
- **Dual Comparison Charts**: Both time and performance perspectives
- **Left-Side Metrics**: Shows actual values alongside bar charts
- **Color Coding**: Red bars for time (lower is better), green for performance (higher is better)
- **Dynamic Scaling**: Bars scale proportionally to the best/worst performers

## 🛠️ Tech Stack

- **AI SDK**: Vercel AI SDK with streaming support ( opencode uses it too)
- **Table Rendering**: `cli-table3` for professional tables
- **Providers**: OpenAI-compatible and Anthropic APIs with custom baseUrl support
- **Navigation**: Circular arrow key navigation throughout
- **Colors**: ANSI escape codes for terminal styling
- **Configuration**: JSON-based persistent storage
- **Security**: .gitignore protection for sensitive files

## 🎯 Requirements

- Node.js 18+
- API keys for AI providers
- Terminal that supports ANSI colors and arrow keys
- Git (for security configuration)


## 📝 Advanced Features

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

