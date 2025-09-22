# AI Speedometer Documentation

Welcome to the documentation for the AI Speedometer benchmark CLI. This documentation covers everything you need to know about using, configuring, and understanding the system.

## Quick Start

- [User Guide](README.md) - Main README with installation and usage
- [Bug Fixes v1.0](bug-fixes-v1.md) - Critical issues resolved in latest version
- [Models.dev Integration](models-dev-integration.md) - How provider and model loading works

## Documentation Structure

### 📚 User Documentation

#### Getting Started
- [Main README](../README.md) - Installation, setup, and basic usage
- [Configuration Guide](../README.md#setup-guide) - Setting up providers and API keys

#### Features
- **Parallel Benchmarking** - Run multiple models simultaneously
- **Provider Management** - Add verified and custom providers
- **Model Selection** - Interactive search and selection interface
- **Performance Metrics** - Comprehensive benchmark results and charts

### 🔧 Technical Documentation

#### Architecture
- [Models.dev Integration](models-dev-integration.md) - Provider ecosystem and API integration
- [Bug Fixes](bug-fixes-v1.md) - Critical issues and their solutions

#### Configuration
- **Provider Configuration** - Setting up different AI providers
- **Authentication** - API key management and security
- **Custom Providers** - Adding your own AI providers

#### Development
- **Code Structure** - Organization of modules and components
- **Testing Guide** - Running and writing tests
- **Contributing** - How to contribute to the project

## Key Concepts

### Providers and Models

The system supports two types of providers:

1. **Verified Providers** - From models.dev ecosystem
   - OpenAI, Anthropic, Google, and other major providers
   - Automatically updated with latest models
   - Pre-configured endpoints and authentication

2. **Custom Providers** - User-defined providers
   - Your own AI endpoints or local models
   - Full configuration flexibility
   - Support for OpenAI-compatible APIs

### Benchmarking Methods

- **AI SDK Method** - Uses Vercel AI SDK with streaming
  - Real-time token counting
  - Time to First Token (TTFT) metrics
  - Streaming response analysis

- **REST API Method** - Direct HTTP API calls
  - No streaming, complete response timing
  - Consistent across all providers
  - Fallback for compatibility

### Performance Metrics

- **Total Time** - Complete request duration
- **TTFT** - Time to First Token (streaming only)
- **Tokens/Second** - Real-time throughput calculation
- **Token Counts** - Input, output, and total tokens
- **Provider Rankings** - Performance comparison across providers

## Recent Updates

### Version 1.0 Bug Fixes

The latest release includes critical fixes for:

- ✅ **Parallel Model Execution** - Multi-model selection now works correctly
- ✅ **AI SDK Model Support** - Verified providers work in benchmarks  
- ✅ **Search Performance** - Reduced lag and flickering in search
- ✅ **Screen Rendering** - Fixed text overlapping issues

See [Bug Fixes v1.0](bug-fixes-v1.md) for detailed technical information.

### Models.dev Integration Enhancement

- **Improved Caching** - Better performance with 1-hour cache expiration
- **Enhanced Search** - Debounced filtering with 50ms delay
- **Provider Type Detection** - Automatic SDK selection based on provider
- **Error Handling** - Graceful degradation and fallback mechanisms

See [Models.dev Integration](models-dev-integration.md) for complete architectural details.

## Getting Help

### Troubleshooting

#### Common Issues
1. **Models Not Showing** - Check API key configuration and provider authentication
2. **Search Lag** - Clear cache and ensure proper file permissions
3. **Benchmark Failures** - Verify API keys and network connectivity

#### Debug Mode
Enable detailed logging for troubleshooting:
```bash
npm run cli:debug
```

This creates `debug.log` with API request/response details.

### Community Support

- **GitHub Issues** - Report bugs and request features
- **Documentation** - Check these docs for common questions
- **Debug Logs** - Include debug logs when reporting issues

### Contributing

We welcome contributions! See the main project README for guidelines on:
- Reporting bugs
- Requesting features  
- Submitting pull requests
- Improving documentation

## Documentation Index

| Document | Description | Audience |
|----------|-------------|----------|
| [Main README](../README.md) | Installation, setup, and basic usage | Users |
| [Bug Fixes v1.0](bug-fixes-v1.md) | Critical issues and solutions | Developers/Users |
| [Models.dev Integration](models-dev-integration.md) | Provider ecosystem architecture | Developers |

## Quick Links

- **Project Home:** [GitHub Repository](https://github.com/aptdnfapt/Ai-speedometer)
- **Issues:** [GitHub Issues](https://github.com/aptdnfapt/Ai-speedometer/issues)
- **Models.dev:** [Provider Registry](https://models.dev)

---

*Documentation last updated: September 2025*  
*Version: 1.0.0*