import { useKeyboard } from '@opentui/react'
import type { KeyEvent } from '@opentui/core'
import { useModal } from '../context/ModalContext.tsx'

export function useAppKeyboard(handler: (key: KeyEvent) => void) {
  const { modalOpen } = useModal()
  useKeyboard((key) => {
    if (modalOpen) return
    handler(key)
  })
}
