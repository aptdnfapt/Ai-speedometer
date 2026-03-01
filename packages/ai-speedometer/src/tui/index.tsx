import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App.tsx'

const ENABLE_BRACKETED_PASTE  = '\x1b[?2004h'
const DISABLE_BRACKETED_PASTE = '\x1b[?2004l'

export async function startTui(logMode = false): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false
  })

  process.stdout.write(ENABLE_BRACKETED_PASTE)

  const cleanup = () => {
    process.stdout.write(DISABLE_BRACKETED_PASTE)
  }

  renderer.on('destroy', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    renderer.destroy()
    process.exit(0)
  })

  createRoot(renderer).render(<App logMode={logMode} />)
}
