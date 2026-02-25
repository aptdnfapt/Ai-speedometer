import { useEffect, useRef } from 'react'
import { useRenderer } from '@opentui/react'

export function usePaste(onPaste: (text: string) => void) {
  const renderer = useRenderer()
  const callbackRef = useRef(onPaste)
  callbackRef.current = onPaste

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (event: any) => callbackRef.current(event.text as string)
    renderer.keyInput.on('paste', handler)
    return () => { renderer.keyInput.off('paste', handler) }
  }, [renderer])
}
