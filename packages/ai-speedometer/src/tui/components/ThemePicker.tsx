import { useState, useEffect } from 'react'
import { useKeyboard } from '@opentui/react'
import { useThemeCtx } from '../theme/ThemeContext.tsx'
import { THEME_NAMES } from '../theme/themes.ts'

const DARK_THEMES  = ['tokyonight', 'dracula', 'catppuccin', 'kanagawa', 'rosepine', 'nord']
const LIGHT_THEMES = ['github', 'everforest', 'solarized']

interface ThemePickerProps {
  onClose: () => void
}

export function ThemePicker({ onClose }: ThemePickerProps) {
  const { theme, themeName, setTheme } = useThemeCtx()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const filtered = THEME_NAMES.filter(n => n.includes(query.toLowerCase()))

  useEffect(() => { setCursor(0) }, [query])

  useEffect(() => {
    const idx = filtered.indexOf(themeName)
    if (idx >= 0) setCursor(idx)
  }, [])

  function applyAt(idx: number) {
    const name = filtered[idx]
    if (name) setTheme(name)
  }

  useKeyboard((key) => {
    if (key.name === 'escape' || (!key.ctrl && key.sequence === 'T')) { onClose(); return }
    if (key.name === 'up') {
      setCursor(c => { const n = Math.max(0, c - 1); applyAt(n); return n })
      return
    }
    if (key.name === 'down') {
      setCursor(c => { const n = Math.min(filtered.length - 1, c + 1); applyAt(n); return n })
      return
    }
    if (key.name === 'return' || key.name === 'enter') { onClose(); return }
    if (key.name === 'backspace' || key.name === 'delete') { setQuery(q => q.slice(0, -1)); return }
    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta && key.sequence >= ' ') {
      setQuery(q => q + key.sequence)
    }
  })

  const W = 32
  const LIST_H = Math.min(filtered.length || 1, 9)

  return (
    <box
      position="absolute"
      top={3}
      right={3}
      width={W}
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor={theme.primary}
      backgroundColor={theme.surface}
      zIndex={100}
    >
      {/* header */}
      <box height={1} flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1}>
        <text fg={theme.primary}>󰏘 </text>
        <text fg={theme.text}>Themes</text>
        <text fg={theme.dim}>  {themeName}</text>
      </box>

      <box height={1} backgroundColor={theme.border} />

      {/* search */}
      <box height={1} flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
        <text fg={theme.dim}>  </text>
        <text fg={query ? theme.text : theme.dim}>{query || 'search...'}</text>
        {query.length > 0 && <text fg={theme.accent}>_</text>}
      </box>

      <box height={1} backgroundColor={theme.border} />

      {/* list */}
      <scrollbox height={LIST_H} focused={false}>
        {filtered.length === 0 ? (
          <box height={1} paddingLeft={3}>
            <text fg={theme.dim}>no match</text>
          </box>
        ) : (
          filtered.map((name, i) => {
            const isActive  = i === cursor
            const isCurrent = name === themeName
            const isDark    = DARK_THEMES.includes(name)
            const tag       = isDark ? '◆' : '◇'
            const tagColor  = isDark ? theme.secondary : theme.accent
            return (
              <box
                key={name}
                height={1}
                flexDirection="row"
                backgroundColor={isActive ? theme.border : 'transparent'}
                paddingLeft={2}
                paddingRight={2}
              >
                <text fg={isCurrent ? theme.success : theme.dim} width={2}>
                  {isCurrent ? '✓' : ' '}
                </text>
                <text fg={tagColor} width={2}>{tag}</text>
                <text fg={isActive ? theme.text : theme.dim}> {name}</text>
                {isActive && <text fg={theme.primary}>  ›</text>}
              </box>
            )
          })
        )}
      </scrollbox>

      <box height={1} backgroundColor={theme.border} />

      {/* legend */}
      <box height={1} flexDirection="row" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
        <text fg={theme.secondary}>◆</text>
        <text fg={theme.dim}> dark  </text>
        <text fg={theme.accent}>◇</text>
        <text fg={theme.dim}> light  </text>
        <text fg={theme.dim}>  [↑↓] [Esc]</text>
      </box>
    </box>
  )
}
