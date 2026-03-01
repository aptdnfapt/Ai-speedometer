import { useState } from 'react'
import { useAppKeyboard as useKeyboard } from '../hooks/useAppKeyboard.ts'
import { useTheme } from '../theme/ThemeContext.tsx'

interface MenuItem {
  label: string
  description?: string
}

interface MenuListProps {
  items: MenuItem[]
  selectedIndex?: number
  onSelect: (index: number) => void
  onNavigate?: (index: number) => void
}

export function MenuList({ items, selectedIndex: initialIndex = 0, onSelect, onNavigate }: MenuListProps) {
  const theme = useTheme()
  const [cursor, setCursor] = useState(initialIndex)

  useKeyboard((key) => {
    if (key.name === 'up') {
      const next = (cursor - 1 + items.length) % items.length
      setCursor(next)
      onNavigate?.(next)
    } else if (key.name === 'down') {
      const next = (cursor + 1) % items.length
      setCursor(next)
      onNavigate?.(next)
    } else if (key.name === 'enter' || key.name === 'return') {
      onSelect(cursor)
    }
  })

  return (
    <box flexDirection="column">
      {items.map((item, i) => {
        const isSelected = i === cursor
        return (
          <box
            key={i}
            flexDirection="row"
            alignItems="center"
            backgroundColor={isSelected ? theme.border : 'transparent'}
            paddingLeft={1}
            paddingRight={1}
          >
            <box flexDirection="column" flexGrow={1}>
              <text fg={isSelected ? theme.text : theme.dim}>{item.label}</text>
              {item.description ? (
                <text fg={isSelected ? theme.dim : theme.border}>{item.description}</text>
              ) : null}
            </box>
            {isSelected && <text fg={theme.primary}>›</text>}
          </box>
        )
      })}
    </box>
  )
}
