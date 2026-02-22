import type { CliArgs } from './types.ts'

function parseCliArgs(): CliArgs {
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
    else if (arg === '--help' || arg === '-h') parsed.help = true
  }

  return parsed
}

function showHelp(): void {
  console.log('ai-speedometer - Benchmark AI models')
  console.log('')
  console.log('Usage:')
  console.log('  ai-speedometer                                  # Interactive mode')
  console.log('  ai-speedometer --bench <provider:model>         # Headless benchmark')
  console.log('  ai-speedometer --bench-custom <provider:model>  # Custom provider benchmark')
  console.log('')
  console.log('Options:')
  console.log('  --bench <provider:model>        Run benchmark in headless mode')
  console.log('  --bench-custom <provider:model> Run custom provider benchmark')
  console.log('  --base-url <url>                Base URL for custom provider')
  console.log('  --api-key <key>                 API key for custom provider')
  console.log('  --endpoint-format <format>      Endpoint format (default: chat/completions)')
  console.log('  --formatted                     Format JSON output for human readability')
  console.log('  --debug                         Enable debug logging')
  console.log('  --help, -h                      Show this help message')
  console.log('')
  console.log('Examples:')
  console.log('  ai-speedometer --bench openai:gpt-4')
  console.log('  ai-speedometer --bench anthropic:claude-3-opus --api-key "sk-..."')
  console.log('  ai-speedometer --bench-custom openai:gpt-4 --base-url "https://api.openai.com/v1" --api-key "sk-..."')
}

const cliArgs = parseCliArgs()

if (cliArgs.help) {
  showHelp()
  process.exit(0)
} else if (cliArgs.bench || cliArgs.benchCustom) {
  const { runHeadlessBenchmark } = await import('./headless.ts')
  await runHeadlessBenchmark(cliArgs)
} else {
  const { startTui } = await import('./tui/index.tsx')
  await startTui()
}
