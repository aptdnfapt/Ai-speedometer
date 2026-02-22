import { createCliRenderer } from '@opentui/core'
import { createRoot } from '@opentui/react'
import { App } from './App.tsx'

export async function startTui(): Promise<void> {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false
  })

  createRoot(renderer).render(<App />)
}
