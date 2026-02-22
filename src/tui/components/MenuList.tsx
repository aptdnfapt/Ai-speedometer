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
          <box
            key={i}
            flexDirection="row"
            alignItems="center"
            backgroundColor={isSelected ? '#292e42' : 'transparent'}
            paddingLeft={1}
            paddingRight={1}
          >
            <box flexDirection="column" flexGrow={1}>
              <text fg={isSelected ? '#c0caf5' : '#565f89'}>{item.label}</text>
              {item.description ? (
                <text fg={isSelected ? '#565f89' : '#292e42'}>{item.description}</text>
              ) : null}
            </box>
            {isSelected && <text fg="#7aa2f7">›</text>}
          </box>
        )
      })}
    </box>
  )
}
