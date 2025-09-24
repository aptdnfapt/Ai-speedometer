# Custom Verified Providers Guide

## Overview

Custom Verified Providers are pre-configured AI providers that are not part of the main models.dev ecosystem but are treated as "verified" within the AI Speedometer system. These providers have predefined configurations and models that users can access with their own API keys.

This guide explains how custom verified providers work, their configuration structure, and how to add or modify them.

## What are Custom Verified Providers?

Custom Verified Providers bridge the gap between:

1. **Official Verified Providers** (from models.dev) - OpenAI, Anthropic, Google, etc.
2. **User-Defined Custom Providers** - Completely user-configured endpoints

Custom Verified Providers are:
- **Pre-configured** by the AI Speedometer team
- **Curated** for quality and reliability
- **Structured** with specific models and endpoints
- **Treated as verified** in the user interface

## Configuration Structure

The custom verified providers are stored in `custom-verified-providers.json` in the project root. Here's the complete structure:

### Root Structure
```json
{
  "custom-verified-providers": {
    "provider-id": {
      // Provider configuration
    },
    "another-provider": {
      // Provider configuration
    }
  }
}
```

### Provider Configuration

Each provider has the following structure:

#### Basic Provider
```json
{
  "id": "provider-id",
  "name": "Provider Display Name",
  "baseUrl": "https://api.provider.com/v1",
  "type": "openai-compatible",
  "models": {
    "model-id": {
      "id": "model-id",
      "name": "Model Display Name"
    }
  }
}
```

#### Provider Types

The `type` field determines which SDK and authentication method to use:

| Type | SDK Package | Authentication | Base URL Pattern |
|------|-------------|----------------|------------------|
| `openai-compatible` | `@ai-sdk/openai-compatible` | Bearer token | `https://api.example.com/v1` |
| `anthropic` | `@ai-sdk/anthropic` | x-api-key header | `https://api.anthropic.com` |
| `google` | `@ai-sdk/google` | x-goog-api-key header | `https://generativelanguage.googleapis.com` |

### Models Configuration

Models are nested objects within each provider:

```json
"models": {
  "model-unique-id": {
    "id": "model-api-id",
    "name": "Human-Readable Model Name"
  },
  "another-model": {
    "id": "another-model-api-id", 
    "name": "Another Model Name"
  }
}
```

**Key Points:**
- **Object Key**: Used internally for identification (should be unique)
- **id**: The actual model ID passed to the API
- **name**: Display name shown in the CLI interface

## Complete Example

Here's a complete example from the current configuration:

```json
{
  "custom-verified-providers": {
    "zai-code-anth": {
      "id": "zai-code-anth",
      "name": "zai-code-anth",
      "baseUrl": "https://api.z.ai/api/anthropic/v1",
      "type": "anthropic",
      "models": {
        "glm-4-5": {
          "id": "glm-4.5",
          "name": "GLM-4.5-anth"
        },
        "glm-4-5-air": {
          "id": "glm-4.5-air",
          "name": "GLM-4.5-air-anth"
        }
      }
    },
    "nanogpt-plan": {
      "id": "nanogpt-plan",
      "name": "nanogpt-plan",
      "baseUrl": "https://nano-gpt.com/api/v1",
      "type": "openai-compatible",
      "models": {
        "deepseek-ai/DeepSeek-V3.1-Terminus": {
          "id": "deepseek-ai/DeepSeek-V3.1-Terminus",
          "name": "DeepSeek V3.1 Terminus"
        },
        "zai-org/GLM-4.5-FP8": {
          "id": "zai-org/GLM-4.5-FP8",
          "name": "GLM 4.5 FP8"
        }
      }
    }
  }
}
```

## How Custom Verified Providers Work

### Integration Flow

1. **Loading**: The system reads `custom-verified-providers.json` on startup
2. **Merging**: Custom verified providers are merged with models.dev providers
3. **Authentication**: Users add API keys through the CLI interface
4. **Availability**: Providers appear in the model selection interface

### User Experience

Users see custom verified providers alongside official models.dev providers:

```
Available Providers:
├── OpenAI (models.dev)
├── Anthropic (models.dev)  
├── zai-code-anth (custom verified)
├── nanogpt-plan (custom verified)
└── [Add Custom Provider]
```

### Authentication Storage

API keys for custom verified providers are stored in **both locations** for redundancy:

```json
// Primary storage: ~/.local/share/opencode/auth.json
{
  "zai-code-anth": {
    "type": "api",
    "key": "user-api-key-here"
  }
}

// Backup storage: ~/.config/ai-speedometer/ai-benchmark-config.json  
{
  "verifiedProviders": {
    "zai-code-anth": "user-api-key-here"
  }
}
```

```json
{
  "zai-code-anth": {
    "type": "api",
    "key": "user-api-key-here"
  },
  "nanogpt-plan": {
    "type": "api", 
    "key": "another-api-key"
  }
}
```

## Adding New Custom Verified Providers

### Step-by-Step Process

1. **Research the Provider**
   - Determine the provider type (OpenAI-compatible, Anthropic, Google)
   - Find the base API endpoint URL
   - Identify available models and their API IDs

2. **Create Provider Configuration**
   ```json
   {
     "id": "unique-provider-id",
     "name": "Human Readable Name",
     "baseUrl": "https://api.provider.com/v1",
     "type": "openai-compatible",
     "models": {
       "model-key-1": {
         "id": "actual-model-id-1",
         "name": "Model 1 Display Name"
       }
     }
   }
   ```

3. **Add to custom-verified-providers.json**
   - Add your provider configuration to the file
   - Ensure the provider ID is unique
   - Test the configuration

4. **Test the Provider**
   ```bash
   # Start CLI
   ai-speedometer
   
   # Add your API key for the new provider
   # Select "Set Model" → "Add Verified Provider"
   # Choose your new provider from the list
   ```

### Validation Checklist

Before adding a new provider, verify:

- [ ] **Base URL Accessibility**: The endpoint is reachable and responds to HTTPS requests
- [ ] **Authentication**: The correct authentication method is configured
- [ ] **Model Availability**: Models exist and are accessible with the API
- [ ] **Rate Limits**: Provider allows reasonable request rates for benchmarking
- [ ] **API Compatibility**: Endpoint follows the expected SDK format

### Best Practices

1. **Provider ID Naming**
   - Use lowercase letters, numbers, and hyphens
   - Make it descriptive and unique
   - Example: `my-provider-name` not `MyProviderName`

2. **Model Naming**
   - Use clear, human-readable names
   - Include provider context if helpful
   - Example: `GPT-4 via MyProvider` not just `GPT-4`

3. **Base URL Configuration**
   - Include the full API path
   - Use HTTPS only
   - Ensure trailing slash consistency

4. **Type Selection**
   - Choose the most specific type available
   - When in doubt, use `openai-compatible`
   - Test with the actual SDK if possible

## Configuration Options Reference

### Provider Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | Yes | String | Unique identifier for the provider |
| `name` | Yes | String | Display name shown in the CLI |
| `baseUrl` | Yes | String | API endpoint URL |
| `type` | Yes | String | Provider type (SDK to use) |
| `models` | Yes | Object | Models available for this provider |

### Model Fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `id` | Yes | String | API model identifier |
| `name` | Yes | String | Display name for the model |

### Supported Provider Types

#### openai-compatible
- **SDK**: `@ai-sdk/openai-compatible`
- **Authentication**: Bearer token in Authorization header
- **Base URL Format**: `https://api.example.com/v1`
- **Model Format**: Standard OpenAI model IDs
- **Examples**: Groq, Together AI, Fireworks AI

#### anthropic
- **SDK**: `@ai-sdk/anthropic`
- **Authentication**: x-api-key and x-api-version headers
- **Base URL Format**: `https://api.anthropic.com`
- **Model Format**: Claude model IDs (claude-3-sonnet-20240229, etc.)
- **Examples**: Anthropic Claude API, Anthropic-compatible endpoints

#### google
- **SDK**: `@ai-sdk/google`
- **Authentication**: x-goog-api-key header
- **Base URL Format**: `https://generativelanguage.googleapis.com`
- **Model Format**: Gemini model IDs (gemini-pro, etc.)
- **Examples**: Google Gemini API

## Troubleshooting

### Common Issues

#### 1. Provider Not Showing in List
**Symptoms**: Custom verified provider doesn't appear in provider selection

**Solutions**:
- Check JSON syntax in `custom-verified-providers.json`
- Verify provider ID is unique
- Ensure file is in the correct project root directory
- Restart the CLI application

#### 2. Authentication Failures
**Symptoms**: API key accepted but models fail during benchmark

**Solutions**:
- Verify the provider type matches the actual API
- Check base URL format and trailing slashes
- Confirm API key has correct permissions
- Test API endpoint manually with curl

#### 3. Model Not Found Errors
**Symptoms**: Selected model returns "not found" from provider

**Solutions**:
- Verify model ID matches provider's API exactly
- Check model availability in your account/region
- Ensure model object key is different from model ID
- Test with a simple curl request

### Debugging Commands

```bash
# Check custom verified providers configuration
cat custom-verified-providers.json

# Validate JSON syntax
python -m json.tool custom-verified-providers.json > /dev/null

# Test API endpoint accessibility
curl -I https://api.provider.com/v1/models

# Check authentication storage
cat ~/.config/ai-speedometer/ai-benchmark-config.json

# Run CLI in debug mode
ai-speedometer --debug
```

### Testing New Providers

Before adding to the main configuration:

1. **Manual API Test**
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" \
        https://api.provider.com/v1/models
   ```

2. **Single Model Test**
   ```bash
   curl -H "Authorization: Bearer YOUR_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model": "model-id", "messages": [{"role": "user", "content": "Hello"}]}' \
        https://api.provider.com/v1/chat/completions
   ```

3. **CLI Integration Test**
   - Add provider temporarily to local config
   - Test through CLI interface
   - Verify benchmark results

## Security Considerations

### API Key Management
- Custom verified providers never store API keys in the main configuration
- Keys are stored in user-specific config files with proper permissions
- No API keys are logged or transmitted to external services

### Provider Vetting
- Only add providers from trusted sources
- Verify provider privacy policies and data handling practices
- Ensure providers follow security best practices
- Regularly review provider configurations for updates

### Network Security
- All providers must use HTTPS endpoints
- Certificate validation is enforced
- No plaintext authentication is supported
- API keys are transmitted only via headers

## Migration and Updates

### Adding New Providers
1. **Test in Development**: Verify provider works locally
2. **Update Configuration**: Add to `custom-verified-providers.json`
3. **Update Documentation**: Document any special requirements
4. **Communicate Changes**: Inform users of new provider options

### Removing Providers
1. **Deprecation Period**: Keep provider for at least one release cycle
2. **User Communication**: Announce removal in advance
3. **Migration Support**: Help users migrate to alternatives
4. **Clean Removal**: Remove from configuration and documentation

### Configuration Updates
- When provider APIs change, update the configuration
- Maintain backward compatibility when possible
- Document breaking changes clearly
- Test updates thoroughly before deployment

## Contributing

### Adding New Providers
To contribute a new custom verified provider:

1. **Research**: Thoroughly test the provider's API
2. **Documentation**: Include any special setup requirements
3. **Testing**: Verify the provider works with the CLI
4. **Pull Request**: Submit the configuration change

### Provider Requirements
- Must be a reliable AI service provider
- Should have reasonable API rate limits
- Must support standard AI SDK patterns
- Should provide documentation for their API
- Must be accessible via HTTPS

### Code of Conduct
- Only add providers that you personally use and recommend
- Ensure providers have clear privacy policies
- Avoid providers with known security issues
- Respect provider terms of service

## Future Enhancements

### Planned Features
1. **Provider Validation**: Automatic testing of provider configurations
2. **Version Management**: Support for multiple provider API versions
3. **Dynamic Loading**: Load providers from external sources
4. **Provider Metrics**: Performance and reliability tracking
5. **User Feedback**: Allow users to rate and review providers

### Configuration Improvements
1. **Schema Validation**: JSON schema validation for configurations
2. **Default Values**: Support for optional configuration fields
3. **Environment Variables**: Override configurations via environment
4. **Conditional Models**: Model availability based on user account

### Integration Enhancements
1. **Auto-discovery**: Automatically detect provider capabilities
2. **Webhooks**: Real-time provider status updates
3. **Health Checks**: Monitor provider availability
4. **Failover**: Automatic fallback to alternative providers

---

This guide provides comprehensive documentation for custom verified providers in the AI Speedometer system. For additional questions or to contribute new providers, please refer to the main project documentation or create an issue on the GitHub repository.