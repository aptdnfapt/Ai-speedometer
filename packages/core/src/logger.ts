import { mkdir, appendFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

function generateRunId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '')
  const rand = Math.random().toString(16).slice(2, 6)
  return `${date}_${time}_${rand}`
}

function redactSecrets(line: string, apiKey: string): string {
  if (!apiKey) return line
  return line.split(apiKey).join('[REDACTED]')
}

export interface BenchLogger {
  logHeader: (modelName: string, providerName: string, apiKey?: string) => Promise<void>
  logRaw: (line: string) => Promise<void>
  flush: () => Promise<void>
  logPath: string
  runId: string
}

export function createRunId(): string {
  return generateRunId()
}

export function getLogPath(runId: string): string {
  return join(homedir(), '.local', 'share', 'ai-speedometer', 'logs', `${runId}.log`)
}

export async function createBenchLogger(runId: string): Promise<BenchLogger> {
  const logPath = getLogPath(runId)
  const logDir = join(homedir(), '.local', 'share', 'ai-speedometer', 'logs')

  await mkdir(logDir, { recursive: true })

  let currentApiKey = ''
  let buffer = ''

  return {
    logPath,
    runId,

    logHeader: async (modelName: string, providerName: string, apiKey = '') => {
      currentApiKey = apiKey
      const ts = new Date().toISOString()
      buffer = `\n=== ${modelName} | ${providerName} | ${ts} ===\n`
    },

    logRaw: async (line: string) => {
      const safe = redactSecrets(line, currentApiKey)
      buffer += safe + '\n'
    },

    flush: async () => {
      buffer += '\n' + '='.repeat(60) + '\n'
      await appendFile(logPath, buffer, 'utf8')
      buffer = ''
    }
  }
}

export type { BenchLogger as Logger }
