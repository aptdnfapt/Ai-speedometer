import { createContext, useContext, useState, useCallback } from 'react'
import type { TuiTheme } from './themes.ts'
import { getTheme, DEFAULT_THEME } from './themes.ts'

interface ThemeCtx {
  theme: TuiTheme
  themeName: string
  setTheme: (name: string) => void
}

const ThemeContext = createContext<ThemeCtx>({
  theme: getTheme(DEFAULT_THEME),
  themeName: DEFAULT_THEME,
  setTheme: () => {},
})

export function ThemeProvider({ name, children }: { name: string; children: React.ReactNode }) {
  const [themeName, setThemeName] = useState(name)

  const setTheme = useCallback(async (next: string) => {
    setThemeName(next)
    try {
      const { writeThemeToConfig } = await import('@ai-speedometer/core/ai-config')
      await writeThemeToConfig(next)
    } catch { /* silent */ }
  }, [])

  return (
    <ThemeContext.Provider value={{ theme: getTheme(themeName), themeName, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): TuiTheme {
  return useContext(ThemeContext).theme
}

export function useThemeCtx(): ThemeCtx {
  return useContext(ThemeContext)
}
