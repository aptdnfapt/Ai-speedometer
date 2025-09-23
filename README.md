# Ai-speedometer

A CLI tool for benchmarking AI models across multiple providers with parallel execution and performance metrics.

## Install

```bash
npm install -g ai-speedometer
```

## What It Measures

- **TTFT** (Time to First Token) - How fast the first response token arrives
- **Total Time** - Complete request duration  
- **Tokens/Second** - Real-time throughput
- **Token Counts** - Input, output, and total tokens used

## Quick Setup

1. **Set Model**
   ```bash
   ai-speedometer
   # Select "Set Model" → "Add Verified Provider" → Choose provider (OpenAI, Anthropic, etc.)
   # Enter your API key when prompted
   ```

2. **Choose Model Provider**
   - Verified providers (OpenAI, Anthropic, Google) - auto-configured
   - Custom providers (Ollama, local models) - add your base URL

3. **Add API Key**
   - Get API keys from your provider's dashboard
   - Enter when prompted - stored securely

4. **Run Benchmark**
   ```bash
   ai-speedometer
   # Select "Run Benchmark (AI SDK)" → Choose models → Press ENTER
   ```

## Usage

```bash
# Start CLI
ai-speedometer

# Or use short alias  
aispeed

# Debug mode
ai-speedometer --debug
```

## Requirements

- Node.js 18+
- API keys for AI providers
- Terminal with arrow keys and ANSI colors
