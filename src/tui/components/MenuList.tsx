import { useState } from 'react'
import { useKeyboard } from '@opentui/react'

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
          <box key={i} flexDirection="row" marginBottom={0}>
            <text fg={isSelected ? '#00FF00' : '#555555'}>
              {isSelected ? '● ' : '○ '}
            </text>
            <text fg={isSelected ? '#00FF00' : '#CCCCCC'}>
              {item.label}
            </text>
            {item.description ? (
              <text fg="#555555">  {item.description}</text>
            ) : null}
          </box>
        )
      })}
    </box>
  )
}
