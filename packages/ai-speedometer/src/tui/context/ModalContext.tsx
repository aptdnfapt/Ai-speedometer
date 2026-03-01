import { createContext, useContext, useState } from 'react'

interface ModalCtx {
  modalOpen: boolean
  setModalOpen: (v: boolean) => void
}

const ModalContext = createContext<ModalCtx>({ modalOpen: false, setModalOpen: () => {} })

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false)
  return (
    <ModalContext.Provider value={{ modalOpen, setModalOpen }}>
      {children}
    </ModalContext.Provider>
  )
}

export function useModal() {
  return useContext(ModalContext)
}
