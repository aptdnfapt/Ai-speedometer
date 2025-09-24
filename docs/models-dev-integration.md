# Models.dev Integration Guide

## Overview

This document provides a comprehensive explanation of how the AI benchmark CLI integrates with models.dev to provide a rich, up-to-date provider and model ecosystem. The integration enables users to easily access verified AI providers and their models without manual configuration, while also supporting custom providers for complete flexibility.

## What is Models.dev?

Models.dev is a centralized registry of AI model providers and their models. It serves as a comprehensive source of truth for:

- **Provider Information:** Names, base URLs, API endpoints, and provider types
- **Model Catalogs:** Available models for each provider with their names and IDs
- **Provider Classification:** Categorization by provider type (OpenAI-compatible, Anthropic, Google, etc.)

**Note:** For information about custom verified providers (pre-configured providers not in models.dev), see [Custom Verified Providers](custom-verified-providers.md).

## Integration Architecture

### Core Components

#### 1. `models-dev.js` - Models.dev API Client
This module handles all communication with the models.dev API and provides caching functionality.

**Key Functions:**
- `getAllProviders()` - Fetch all providers from models.dev
- `searchProviders(query)` - Search providers by name or ID
- `getModelsForProvider(providerId)` - Get models for a specific provider
- `refreshData()` - Force refresh from API (bypassing cache)

#### 2. `opencode-integration.js` - Verified Provider Management
This module handles **verified providers only** from models.dev and manages their authentication.

**Key Functions:**
- `getAuthenticatedProviders()` - Get verified providers with valid API keys from auth.json
- `addApiKey(providerId, apiKey)` - Store API keys securely in auth.json
- `getAllAvailableProviders()` - Combine verified providers with custom providers
- `migrateFromOldConfig()` - Migrate data from old config format

#### 3. `ai-config.js` - Custom Provider Management
This module handles **user-defined custom providers** and their models.

**Key Functions:**
- `addCustomProvider()` - Add new custom providers
- `addModelToCustomProvider()` - Add models to existing custom providers
- `getCustomProvidersFromConfig()` - Retrieve custom providers from config
- `readAIConfig()` / `writeAIConfig()` - Manage ai-benchmark-config.json

#### 4. `cli.js` - User Interface
The main CLI interface uses both provider systems for model selection and benchmarking.

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

### 2. Dual Provider System Flow

The system now manages three distinct provider types:

#### Verified Providers (models.dev integration)
```
Provider Selection → API Key Input → auth.json Storage → Provider Activation
```

**Authentication Process:**

1. **Provider Selection:** User selects a provider from models.dev list
2. **API Key Input:** User enters their API key for the provider
3. **Secure Storage:** Key is stored in `~/.local/share/opencode/auth.json`
4. **Provider Activation:** Provider becomes available in model selection

#### Custom Verified Providers (pre-configured)
```
Pre-configured Definition → custom-verified-providers.json → API Key Input → Integration
```

**Custom Verified Provider Process:**

1. **Pre-configured Definition:** Providers defined in `custom-verified-providers.json`
2. **API Key Input:** User enters API key for the pre-configured provider
3. **Authentication Storage:** Key stored in auth.json alongside verified providers
4. **Integration:** Available immediately in model selection interface

#### Custom Providers (user-defined)
```
Custom Provider Setup → ai-benchmark-config.json Storage → Direct Integration
```

**Custom Provider Process:**

1. **Provider Definition:** User defines custom provider with base URL and models
2. **Config Storage:** Provider stored in `~/.config/ai-speedometer/ai-benchmark-config.json`
3. **Model Management:** Users can add/remove models from custom providers
4. **Direct Integration:** Available immediately in model selection

### 3. Model Loading and Filtering

```
Verified Providers → Custom Providers → Combine → Present to User
```

**Model Assembly Process:**

1. **Verified Models:** Load models from authenticated providers in auth.json
2. **Custom Verified Models:** Load models from custom-verified-providers.json with API keys
3. **Custom Models:** Load user-defined models from ai-benchmark-config.json
4. **Deduplication:** Ensure no duplicate models in final list
5. **Presentation:** Display combined list in model selection interface

## Configuration Files and Locations

### File Locations

#### OpenCode Integration (Verified Providers)
- **auth.json:** `~/.local/share/opencode/auth.json` (API keys for verified providers)
- **opencode.json:** `~/.config/opencode/opencode.json` (deprecated, no longer used)

#### AI Speedometer Config (Custom Providers)
- **ai-benchmark-config.json:** `~/.config/ai-speedometer/ai-benchmark-config.json` (custom providers)
- **Cache:** `~/.cache/ai-speedometer/models.json` (models.dev API cache)

#### Custom Verified Providers
- **custom-verified-providers.json:** `./custom-verified-providers.json` (pre-configured provider definitions)
- **Authentication:** Same as verified providers (stored in auth.json)

### Configuration Structures

#### Verified Providers (auth.json)
```json
{
  "openai": {
    "type": "api",
    "key": "sk-..."
  },
  "anthropic": {
    "type": "api", 
    "key": "sk-ant-..."
  }
}
```

#### Custom Providers (ai-benchmark-config.json)
```json
{
  "verifiedProviders": {},
  "customProviders": [
    {
      "id": "my-custom-provider",
      "name": "My Custom Provider",
      "type": "openai-compatible",
      "baseUrl": "https://api.custom.com/v1",
      "apiKey": "custom-api-key",
      "models": [
        {
          "name": "Custom Model 1",
          "id": "custom-model-1"
        }
      ]
    }
  ]
}
```

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

## User Interface Improvements

### Search Bar Visibility
- **Enhanced Visibility:** Search bar now includes 🔍 emoji indicator for clear visual identification
- **Proper Sizing:** Header height calculations correctly account for search interface
- **Consistent Implementation:** Search functionality works across all provider selection interfaces

### Screen Rendering Optimization
- **Double Buffering:** Screen content built in memory before display to eliminate flickering
- **Optimized Clearing:** Single screen clear operation per render cycle
- **Smooth Navigation:** Pagination and scrolling work without visual artifacts

### Menu Structure
The CLI now follows the structure defined in `plan/models.md`:

```
Main Menu
├── Set Model
│   ├── Add Verified Provider (models.dev)
│   ├── Add Custom Models
│   │   ├── Add Models to Existing Provider
│   │   ├── Add Custom Provider
│   │   └── Back to Model Management
│   ├── List Existing Providers
│   ├── Debug Info
│   └── Back to Main Menu
├── Run Benchmark (AI SDK)
├── Run Benchmark (REST API)
└── Exit
```

## Adding Custom Providers

### Custom Provider Setup Process

1. **Navigate to Add Custom Models** from Model Management menu
2. **Choose "Add Custom Provider"** option
3. **Select Provider Type:** OpenAI Compatible or Anthropic
4. **Enter Provider Details:**
   - Provider ID (e.g., my-openai)
   - Provider Name (e.g., MyOpenAI)
   - Base URL (e.g., https://api.openai.com/v1)
   - API Key
5. **Add Models:** Choose single or multiple model mode
6. **Automatic Save:** Provider saved to ai-benchmark-config.json

### Example Custom Provider Configuration

```json
{
  "id": "my-custom-openai",
  "name": "My Custom OpenAI",
  "type": "openai-compatible",
  "baseUrl": "https://api.custom.com/v1",
  "apiKey": "your-api-key",
  "models": [
    {
      "name": "gpt-4",
      "id": "gpt-4_1234567890"
    },
    {
      "name": "gpt-3.5-turbo",
      "id": "gpt-3-5-turbo_1234567891"
    }
  ]
}
```

## Migration System

### Automatic Migration
The system includes migration functionality for users transitioning from the old config format:

- **Detection:** Automatically detects old `ai-benchmark-config.json` in current directory
- **Migration:** Splits verified providers to auth.json and custom providers to new config location
- **Backup:** Creates backup of old config file
- **Reporting:** Shows migration results and any errors encountered

### Migration Process
1. **Old Config Detection:** Checks for `./ai-benchmark-config.json`
2. **Data Splitting:** 
   - Verified providers → `~/.local/share/opencode/auth.json`
   - Custom providers → `~/.config/ai-speedometer/ai-benchmark-config.json`
3. **Backup:** Renames old file to `ai-benchmark-config.json.backup`
4. **Confirmation:** Shows migration summary to user

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

## Security Considerations

### API Key Storage
- **Secure File Permissions:** Auth files restricted to owner (0o600)
- **XDG Compliance:** Follows system standards for config locations
- **No Key Logging:** API keys never appear in logs or output
- **Separation of Concerns:** Verified and custom provider keys stored separately

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

#### 1. Search Bar Not Visible
**Symptoms:** Search interface missing from provider selection
**Solution:** 
- This is now fixed with 🔍 emoji indicator and proper header calculations
- Ensure you're using the updated CLI version

#### 2. Screen Flickering During Navigation
**Symptoms:** Visual artifacts during scrolling or pagination
**Solution:** 
- This has been resolved with double buffering implementation
- Update to latest CLI version if experiencing issues

#### 3. Models Not Loading
**Symptoms:** Model selection shows empty or outdated list
**Solution:** 
```bash
# Clear cache and force refresh
node -e "import('./models-dev.js').then(m => m.clearCache())"
```

#### 4. Authentication Issues
**Symptoms:** Provider appears but models fail during benchmark
**Solution:**
```bash
# Check auth.json contents
cat ~/.local/share/opencode/auth.json

# Verify API key format and permissions
```

#### 5. Custom Provider Issues
**Symptoms:** Custom providers not appearing or models not working
**Solution:**
```bash
# Check custom provider config
cat ~/.config/ai-speedometer/ai-benchmark-config.json

# Verify config directory exists
ls -la ~/.config/ai-speedometer/
```

### Debugging Commands

```bash
# View cache status
ls -la ~/.cache/ai-speedometer/

# View verified provider configuration
cat ~/.local/share/opencode/auth.json

# View custom providers
cat ~/.config/ai-speedometer/ai-benchmark-config.json

# View all config locations
node cli.js
# Then select "Debug Info" from the menu

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
- Config system operations

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

### Screen Rendering
- **Double Buffering:** Eliminates screen flickering
- **Optimized Clearing:** Single screen clear per render cycle
- **Memory Efficient:** Screen content built in memory
- **Responsive:** Immediate feedback for user interactions

### Concurrent Loading
- **Parallel Requests:** Fetch verified and custom providers concurrently
- **Non-blocking UI:** Interface remains responsive during data loading
- **Progressive Enhancement:** Show available data while loading more

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
   - Visual provider status indicators

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

The models.dev integration provides a powerful, extensible foundation for AI provider and model management. The new dual-system architecture separates verified providers (from models.dev) from custom providers (user-defined), providing both convenience and flexibility. The recent improvements in search visibility, screen rendering, and configuration management ensure a reliable and user-friendly experience for benchmarking AI models across multiple providers.

The separation of concerns between verified and custom providers, combined with the robust migration system and optimized user interface, makes this integration both powerful and approachable for users at all levels of expertise.