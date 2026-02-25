import { runHeadlessBenchmark } from '@ai-speedometer/core/headless'
import type { CliArgs } from '@ai-speedometer/core/types'

const args = process.argv.slice(2)
const parsed: CliArgs = {
  debug: false,
  bench: null,
  benchCustom: null,
  apiKey: null,
  baseUrl: null,
  endpointFormat: null,
  formatted: false,
  help: false
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i]!
  if (arg === '--debug') parsed.debug = true
  else if (arg === '--bench') parsed.bench = args[++i] ?? null
  else if (arg === '--bench-custom') parsed.benchCustom = args[++i] ?? null
  else if (arg === '--api-key') parsed.apiKey = args[++i] ?? null
  else if (arg === '--base-url') parsed.baseUrl = args[++i] ?? null
  else if (arg === '--endpoint-format') parsed.endpointFormat = args[++i] ?? null
  else if (arg === '--formatted') parsed.formatted = true
  else if (arg === '--help' || arg === '-h') {
    console.log('ai-speedometer headless - Benchmark AI models (Node.js/Bun compatible)')
    console.log('')
    console.log('Usage:')
    console.log('  ai-speedometer-headless --bench <provider:model>')
    console.log('  ai-speedometer-headless --bench-custom <provider:model> --base-url <url> --api-key <key>')
    console.log('')
    console.log('Options:')
    console.log('  --bench <provider:model>        Run benchmark in headless mode')
    console.log('  --bench-custom <provider:model> Run custom provider benchmark')
    console.log('  --base-url <url>                Base URL for custom provider')
    console.log('  --api-key <key>                 API key')
    console.log('  --endpoint-format <format>      Endpoint format (default: chat/completions)')
    console.log('  --formatted                     Pretty-print JSON output')
    console.log('  --help, -h                      Show this help message')
    process.exit(0)
  }
}

if (!parsed.bench && !parsed.benchCustom) {
  console.error('Error: --bench or --bench-custom is required')
  console.error('Run with --help for usage')
  process.exit(1)
}

await runHeadlessBenchmark(parsed)
