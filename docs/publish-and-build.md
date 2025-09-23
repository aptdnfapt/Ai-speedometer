# AI Speedometer - Publishing Guide

## Table of Contents
1. [Publishing to npm](#publishing-to-npm)
2. [Building the Binary](#building-the-binary)

## Publishing to npm

### Current Setup
The AI Speedometer CLI is now published as a global npm package with the following configuration:

### Package.json Configuration
```json
{
  "name": "ai-speedometer",
  "version": "1.0.0",
  "bin": {
    "ai-speedometer": "./dist/cli.js",
    "aispeed": "./dist/cli.js"
  },
  "files": ["dist/"],
  "scripts": {
    "build": "esbuild cli.js --bundle --platform=node --outfile=dist/cli.js",
    "prepublishOnly": "npm run build"
  }
}
```

### Publishing Process
1. **Build Step**: Run `npm run build` to bundle the CLI using esbuild
2. **Publish**: Run `npm publish` to publish to npm registry
3. **Global Installation**: Users install with `npm install -g ai-speedometer`
4. **Usage**: Users can run `ai-speedometer` or `aispeed` from anywhere

### Key Files Modified
- `package.json` - Added esbuild config, binary commands, and npm metadata
- `cli.js` - Fixed entry point detection and interactive mode
- `benchmark-rest.js` - Fixed main function execution conflicts
- `.gitignore` - Added `dist/` to exclude bundled binaries

## Building the Binary

### Why Use esbuild?
- **Single File**: Bundles all dependencies into one executable file
- **Performance**: Faster startup time compared to Node.js module resolution
- **Distribution**: Easy to distribute as a global npm binary
- **Compatibility**: Works across different Node.js versions

### Build Configuration
```bash
esbuild cli.js --bundle --platform=node --outfile=dist/cli.js
```

### Build Process
1. **Entry Point**: `cli.js` is the main entry point
2. **Bundling**: All required modules are bundled into `dist/cli.js`
3. **Platform**: Targeted for Node.js platform
4. **Output**: Single executable file in `dist/` directory

### Git Strategy
- `dist/` directory is in `.gitignore`
- Binary is generated during npm build process
- Only source code is tracked in git
- Built binary is distributed via npm



This documentation covers the complete publishing process for the AI Speedometer CLI, including npm configuration, esbuild bundling, and distribution setup.