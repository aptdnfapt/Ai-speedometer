export interface TuiTheme {
  background:  string
  surface:     string
  border:      string
  dim:         string
  text:        string
  primary:     string
  accent:      string
  secondary:   string
  success:     string
  error:       string
  warning:     string
}

export const THEMES: Record<string, TuiTheme> = {
  tokyonight: {
    background: "#1a1b26",
    surface:    "#1e2030",
    border:     "#292e42",
    dim:        "#565f89",
    text:       "#c0caf5",
    primary:    "#7aa2f7",
    accent:     "#7dcfff",
    secondary:  "#bb9af7",
    success:    "#9ece6a",
    error:      "#f7768e",
    warning:    "#ff9e64",
  },
  dracula: {
    background: "#282a36",
    surface:    "#21222c",
    border:     "#44475a",
    dim:        "#6272a4",
    text:       "#f8f8f2",
    primary:    "#bd93f9",
    accent:     "#8be9fd",
    secondary:  "#ff79c6",
    success:    "#50fa7b",
    error:      "#ff5555",
    warning:    "#f1fa8c",
  },
  catppuccin: {
    background: "#1e1e2e",
    surface:    "#181825",
    border:     "#313244",
    dim:        "#585b70",
    text:       "#cdd6f4",
    primary:    "#89b4fa",
    accent:     "#89dceb",
    secondary:  "#cba6f7",
    success:    "#a6e3a1",
    error:      "#f38ba8",
    warning:    "#fab387",
  },
  kanagawa: {
    background: "#1F1F28",
    surface:    "#2A2A37",
    border:     "#54546D",
    dim:        "#727169",
    text:       "#DCD7BA",
    primary:    "#7E9CD8",
    accent:     "#7FB4CA",
    secondary:  "#957FB8",
    success:    "#98BB6C",
    error:      "#E82424",
    warning:    "#D7A657",
  },
  rosepine: {
    background: "#191724",
    surface:    "#1f1d2e",
    border:     "#403d52",
    dim:        "#6e6a86",
    text:       "#e0def4",
    primary:    "#9ccfd8",
    accent:     "#ebbcba",
    secondary:  "#c4a7e7",
    success:    "#31748f",
    error:      "#eb6f92",
    warning:    "#f6c177",
  },
  nord: {
    background: "#2E3440",
    surface:    "#3B4252",
    border:     "#434C5E",
    dim:        "#8B95A7",
    text:       "#ECEFF4",
    primary:    "#88C0D0",
    accent:     "#8FBCBB",
    secondary:  "#81A1C1",
    success:    "#A3BE8C",
    error:      "#BF616A",
    warning:    "#D08770",
  },
  github: {
    background: "#ffffff",
    surface:    "#f6f8fa",
    border:     "#d0d7de",
    dim:        "#57606a",
    text:       "#24292f",
    primary:    "#0969da",
    accent:     "#1b7c83",
    secondary:  "#8250df",
    success:    "#1a7f37",
    error:      "#cf222e",
    warning:    "#9a6700",
  },
  everforest: {
    background: "#fdf6e3",
    surface:    "#efebd4",
    border:     "#939f91",
    dim:        "#a6b0a0",
    text:       "#5c6a72",
    primary:    "#8da101",
    accent:     "#3a94c5",
    secondary:  "#df69ba",
    success:    "#8da101",
    error:      "#f85552",
    warning:    "#f57d26",
  },
  solarized: {
    background: "#fdf6e3",
    surface:    "#eee8d5",
    border:     "#cdc8b1",
    dim:        "#93a1a1",
    text:       "#657b83",
    primary:    "#268bd2",
    accent:     "#2aa198",
    secondary:  "#6c71c4",
    success:    "#859900",
    error:      "#dc322f",
    warning:    "#b58900",
  },
}

export const DEFAULT_THEME = 'tokyonight'

export function getTheme(name: string): TuiTheme {
  return THEMES[name] ?? THEMES[DEFAULT_THEME]!
}

export const THEME_NAMES = Object.keys(THEMES)
