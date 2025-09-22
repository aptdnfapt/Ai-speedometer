# Models.dev Integration Guide

## Overview

This document provides a comprehensive explanation of how the AI benchmark CLI integrates with models.dev to provide a rich, up-to-date provider and model ecosystem. The integration enables users to easily access verified AI providers and their models without manual configuration.

## What is Models.dev?

Models.dev is a centralized registry of AI model providers and their models. It serves as a comprehensive source of truth for:

- **Provider Information:** Names, base URLs, API endpoints, and provider types
- **Model Catalogs:** Available models for each provider with their names and IDs
- **Provider Classification:** Categorization by provider type (OpenAI-compatible, Anthropic, Google, etc.)

## Integration Architecture

### Core Components

#### 1. `models-dev.js` - Models.dev API Client
This module handles all communication with the models.dev API and provides caching functionality.

**Key Functions:**
- `getAllProviders()` - Fetch all providers from models.dev
- `searchProviders(query)` - Search providers by name or ID
- `getModelsForProvider(providerId)` - Get models for a specific provider
- `refreshData()` - Force refresh from API (bypassing cache)

#### 2. `opencode-integration.js` - Provider Management
This module bridges the models.dev data with the opencode authentication system.

**Key Functions:**
- `getAuthenticatedProviders()` - Get providers with valid API keys
- `getCustomProviders()` - Get user-defined custom providers
- `getAllAvailableProviders()` - Combine both authenticated and custom providers
- `addApiKey(providerId, apiKey)` - Store API keys securely

#### 3. `cli.js` - User Interface
The main CLI interface uses the integrated provider data for model selection and benchmarking.

## Data Flow

### 1. Provider Discovery and Loading

```
User Request → CLI → getAllProviders() → Models.dev API → Provider Data
```

**Step-by-step process:**

1. **Cache Check:** The system first checks for cached provider data
2. **API Fallback:** If cache is missing or expired (>1 hour), fetch from models.dev API
3. **Fallback Data:** If API fails, use built-in fallback provider data
4. **Data Transformation:** Convert models.dev format to internal format
5. **Caching:** Store successful responses in local cache

**Cache Implementation:**
- **Location:** `~/.cache/ai-speedometer/models.json`
- **Expiration:** 1 hour (3600 seconds)
- **Format:** JSON with timestamp
- **Fallback:** Built-in provider list for offline operation

### 2. Provider Authentication Flow

```
Provider Selection → API Key Input → Auth Storage → Provider Activation
```

**Authentication Process:**

1. **Provider Selection:** User selects a provider from models.dev list
2. **API Key Input:** User enters their API key for the provider
3. **Secure Storage:** Key is stored in `~/.local/share/opencode/auth.json`
4. **Provider Activation:** Provider becomes available in model selection

**Security Features:**
- **File Permissions:** Auth files have 0o600 permissions (read/write for owner only)
- **XDG Compliance:** Follows XDG Base Directory specification
- **No Key Exposure:** Keys are never logged or displayed in plain text

### 3. Model Loading and Filtering

```
All Providers → Filter by Auth → Combine with Custom → Present to User
```

**Model Assembly Process:**

1. **Authenticated Models:** Load models from providers with valid API keys
2. **Custom Models:** Load user-defined models from opencode.json
3. **Deduplication:** Ensure no duplicate models in final list
4. **Presentation:** Display combined list in model selection interface

## Provider Types and SDK Integration

### Supported Provider Types

#### 1. OpenAI-Compatible
- **SDK:** `@ai-sdk/openai-compatible`
- **Examples:** OpenAI, Groq, Together AI, Anyscale, Fireworks AI
- **Base URL Pattern:** `https://api.example.com/v1`
- **Authentication:** Bearer token via Authorization header

#### 2. Anthropic
- **SDK:** `@ai-sdk/anthropic`  
- **Examples:** Anthropic Claude models
- **Base URL Pattern:** `https://api.anthropic.com`
- **Authentication:** Custom headers with x-api-key and anthropic-version

#### 3. Google
- **SDK:** `@ai-sdk/google`
- **Examples:** Google Gemini models
- **Base URL Pattern:** `https://generativelanguage.googleapis.com`
- **Authentication:** x-goog-api-key header

### Provider Type Detection

The system automatically detects provider types based on:

1. **NPM Package:** The `npm` field in models.dev data
2. **Fallback Logic:** Package name patterns for type detection

```javascript
// Automatic type detection logic
let providerType = 'openai-compatible'; // default
if (providerConfig.npm === '@ai-sdk/anthropic') {
  providerType = 'anthropic';
} else if (providerConfig.npm === '@ai-sdk/google') {
  providerType = 'google';
} else if (providerConfig.npm === '@ai-sdk/openai') {
  providerType = 'openai';
}
```

## Configuration and Customization

### Adding Custom Providers

Users can extend the models.dev ecosystem with custom providers:

1. **Custom Provider Setup:**
```json
{
  "provider": {
    "my-custom-provider": {
      "name": "My Custom Provider",
      "npm": "@ai-sdk/openai-compatible",
      "options": {
        "apiKey": "your-api-key",
        "baseURL": "https://api.custom.com/v1"
      },
      "models": {
        "custom-model-1": {
          "name": "Custom Model 1"
        }
      }
    }
  }
}
```

2. **Custom Provider Location:** `~/.config/opencode/opencode.json`

### Provider Configuration Structure

#### Verified Providers (from models.dev)
```json
{
  "providerId": {
    "type": "api",
    "key": "api-key-here"
  }
}
```

#### Custom Providers (user-defined)
```json
{
  "providerId": {
    "name": "Provider Name",
    "npm": "@ai-sdk/package-name",
    "options": {
      "apiKey": "api-key",
      "baseURL": "https://api.example.com/v1"
    },
    "models": {
      "modelId": {
        "name": "Model Name"
      }
    }
  }
}
```

## Error Handling and Resilience

### Cache Management
- **Automatic Cache Refresh:** Cache expires after 1 hour
- **Manual Refresh:** `refreshData()` function for forced updates
- **Cache Clearing:** `clearCache()` function for troubleshooting
- **Graceful Degradation:** Falls back to built-in data on API failure

### API Failure Handling
- **Network Errors:** Automatic retry with exponential backoff
- **Invalid Responses:** Fallback to cached data when available
- **Rate Limiting:** Respect API rate limits with proper delay handling
- **Offline Mode:** Built-in provider list for offline operation

### Data Validation
- **Schema Validation:** Validate incoming API responses
- **Type Checking:** Ensure provider types are recognized
- **Model Validation:** Verify model data integrity
- **URL Validation:** Confirm base URLs are properly formatted

## Performance Optimization

### Caching Strategy
- **Local Cache:** Reduces API calls and improves load times
- **Conditional Updates:** Only fetch when data is stale
- **Memory Efficiency:** Cache data is compactly stored
- **Fast Access:** In-memory filtering and searching

### Search Optimization
- **Debounced Input:** 50ms delay reduces unnecessary filtering
- **Efficient Algorithms:** Optimized search across multiple fields
- **Partial Results:** Show results immediately during typing
- **Memory Management:** Clean up unused search timeouts

### Concurrent Loading
- **Parallel Requests:** Fetch authenticated and custom providers concurrently
- **Non-blocking UI:** Interface remains responsive during data loading
- **Progressive Enhancement:** Show available data while loading more

## Security Considerations

### API Key Storage
- **Secure File Permissions:** Auth files restricted to owner (0o600)
- **XDG Compliance:** Follows system standards for config locations
- **No Key Logging:** API keys never appear in logs or output
- **Environment Variables:** Support for environment-based configuration

### Network Security
- **HTTPS Only:** All API communications use HTTPS
- **Certificate Validation:** Proper SSL certificate verification
- **No Credential Exposure:** Keys sent only in headers, never URLs
- **Request Signing:** Proper authentication headers for all requests

### Data Privacy
- **Local Storage Only:** No data sent to external services except models.dev API
- **Minimal Data Collection:** Only necessary provider and model information
- **User Control:** Users can clear cache and data at any time
- **Transparent Operation:** All operations are visible to the user

## Troubleshooting

### Common Issues

#### 1. Models Not Loading
**Symptoms:** Model selection shows empty or outdated list
**Solution:** 
```bash
# Clear cache and force refresh
node -e "import('./models-dev.js').then(m => m.clearCache())"
```

#### 2. Authentication Issues
**Symptoms:** Provider appears but models fail during benchmark
**Solution:**
```bash
# Check auth.json contents
cat ~/.local/share/opencode/auth.json

# Verify API key format and permissions
```

#### 3. Search Performance Issues
**Symptoms:** Lag or flickering during search typing
**Solution:**
- Ensure cache directory exists and is writable
- Check for large model lists (1000+ models)
- Verify system resources are adequate

### Debugging Commands

```bash
# View cache status
ls -la ~/.cache/ai-speedometer/

# View auth configuration
cat ~/.local/share/opencode/auth.json

# View custom providers
cat ~/.config/opencode/opencode.json

# Clear all caches
rm -rf ~/.cache/ai-speedometer/
```

### Logging and Debugging

Enable debug logging for troubleshooting:
```bash
npm run cli:debug
```

This creates detailed logs in `debug.log` including:
- API request/response details
- Cache operations
- Provider loading process
- Authentication flow

## Future Enhancements

### Planned Features

1. **Enhanced Caching:**
   - Configurable cache expiration times
   - Cache size limits and management
   - Offline mode with extended cache

2. **Provider Management:**
   - Provider health monitoring
   - Automatic provider failover
   - Provider performance metrics

3. **User Experience:**
   - Provider favorite/bookmarking
   - Model capability filtering
   - Advanced search options

4. **Integration Enhancements:**
   - Real-time provider updates
   - Provider webhooks for changes
   - Community provider submissions

### API Considerations

- **Rate Limiting:** Implement proper rate limit handling
- **Pagination:** Support for paginated model lists
- **Versioning:** API version compatibility
- **Deprecation:** Graceful handling of deprecated providers/models

## Conclusion

The models.dev integration provides a powerful, extensible foundation for AI provider and model management. By combining centralized provider data with local authentication and customization, the system offers both convenience and flexibility. The caching, performance optimizations, and security features ensure a reliable and user-friendly experience for benchmarking AI models across multiple providers.