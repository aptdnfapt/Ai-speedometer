import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App.tsx'

export async function startTui(): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false
  })

  process.on('SIGINT', () => {
    renderer.destroy()
    process.exit(0)
  })

  createRoot(renderer).render(<App />)
}
