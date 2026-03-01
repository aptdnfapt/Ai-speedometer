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
    background: "#1a1b26", surface: "#1e2030", border: "#292e42", dim: "#565f89",
    text: "#c0caf5", primary: "#7aa2f7", accent: "#7dcfff", secondary: "#bb9af7",
    success: "#9ece6a", error: "#f7768e", warning: "#ff9e64",
  },
  dracula: {
    background: "#282a36", surface: "#21222c", border: "#44475a", dim: "#6272a4",
    text: "#f8f8f2", primary: "#bd93f9", accent: "#8be9fd", secondary: "#ff79c6",
    success: "#50fa7b", error: "#ff5555", warning: "#f1fa8c",
  },
  catppuccin: {
    background: "#1e1e2e", surface: "#181825", border: "#313244", dim: "#585b70",
    text: "#cdd6f4", primary: "#89b4fa", accent: "#89dceb", secondary: "#cba6f7",
    success: "#a6e3a1", error: "#f38ba8", warning: "#fab387",
  },
  "catppuccin-frappe": {
    background: "#303446", surface: "#292c3c", border: "#414559", dim: "#b5bfe2",
    text: "#c6d0f5", primary: "#8da4e2", accent: "#f4b8e4", secondary: "#ca9ee6",
    success: "#a6d189", error: "#e78284", warning: "#e5c890",
  },
  "catppuccin-macchiato": {
    background: "#24273a", surface: "#1e2030", border: "#363a4f", dim: "#b8c0e0",
    text: "#cad3f5", primary: "#8aadf4", accent: "#f5bde6", secondary: "#c6a0f6",
    success: "#a6da95", error: "#ed8796", warning: "#eed49f",
  },
  kanagawa: {
    background: "#1F1F28", surface: "#2A2A37", border: "#54546D", dim: "#727169",
    text: "#DCD7BA", primary: "#7E9CD8", accent: "#7FB4CA", secondary: "#957FB8",
    success: "#98BB6C", error: "#E82424", warning: "#D7A657",
  },
  rosepine: {
    background: "#191724", surface: "#1f1d2e", border: "#403d52", dim: "#6e6a86",
    text: "#e0def4", primary: "#9ccfd8", accent: "#ebbcba", secondary: "#c4a7e7",
    success: "#31748f", error: "#eb6f92", warning: "#f6c177",
  },
  nord: {
    background: "#2E3440", surface: "#3B4252", border: "#434C5E", dim: "#8B95A7",
    text: "#ECEFF4", primary: "#88C0D0", accent: "#8FBCBB", secondary: "#81A1C1",
    success: "#A3BE8C", error: "#BF616A", warning: "#D08770",
  },
  aura: {
    background: "#0f0f0f", surface: "#15141b", border: "#2d2d2d", dim: "#6d6d6d",
    text: "#edecee", primary: "#a277ff", accent: "#a277ff", secondary: "#f694ff",
    success: "#61ffca", error: "#ff6767", warning: "#ffca85",
  },
  ayu: {
    background: "#0B0E14", surface: "#0F131A", border: "#6C7380", dim: "#565B66",
    text: "#BFBDB6", primary: "#59C2FF", accent: "#E6B450", secondary: "#D2A6FF",
    success: "#7FD962", error: "#D95757", warning: "#E6B673",
  },
  carbonfox: {
    background: "#161616", surface: "#1a1a1a", border: "#303030", dim: "#7d848f",
    text: "#f2f4f8", primary: "#33b1ff", accent: "#ff7eb6", secondary: "#78a9ff",
    success: "#25be6a", error: "#ee5396", warning: "#f1c21b",
  },
  cobalt2: {
    background: "#193549", surface: "#122738", border: "#1f4662", dim: "#adb7c9",
    text: "#ffffff", primary: "#0088ff", accent: "#2affdf", secondary: "#9a5feb",
    success: "#9eff80", error: "#ff0088", warning: "#ffc600",
  },
  cursor: {
    background: "#181818", surface: "#141414", border: "#333333", dim: "#666666",
    text: "#e4e4e4", primary: "#88c0d0", accent: "#88c0d0", secondary: "#81a1c1",
    success: "#3fa266", error: "#e34671", warning: "#f1b467",
  },
  gruvbox: {
    background: "#282828", surface: "#3c3836", border: "#665c54", dim: "#928374",
    text: "#ebdbb2", primary: "#83a598", accent: "#8ec07c", secondary: "#d3869b",
    success: "#b8bb26", error: "#fb4934", warning: "#fe8019",
  },
  material: {
    background: "#263238", surface: "#1e272c", border: "#37474f", dim: "#546e7a",
    text: "#eeffff", primary: "#82aaff", accent: "#89ddff", secondary: "#c792ea",
    success: "#c3e88d", error: "#f07178", warning: "#ffcb6b",
  },
  matrix: {
    background: "#0a0e0a", surface: "#0e130d", border: "#1e2a1b", dim: "#8ca391",
    text: "#62ff94", primary: "#2eff6a", accent: "#c770ff", secondary: "#00efff",
    success: "#62ff94", error: "#ff4b4b", warning: "#e6ff57",
  },
  monokai: {
    background: "#272822", surface: "#1e1f1c", border: "#3e3d32", dim: "#75715e",
    text: "#f8f8f2", primary: "#66d9ef", accent: "#a6e22e", secondary: "#ae81ff",
    success: "#a6e22e", error: "#f92672", warning: "#e6db74",
  },
  nightowl: {
    background: "#011627", surface: "#0b253a", border: "#5f7e97", dim: "#5f7e97",
    text: "#d6deeb", primary: "#82AAFF", accent: "#c792ea", secondary: "#7fdbca",
    success: "#c5e478", error: "#EF5350", warning: "#ecc48d",
  },
  "one-dark": {
    background: "#282c34", surface: "#21252b", border: "#393f4a", dim: "#5c6370",
    text: "#abb2bf", primary: "#61afef", accent: "#56b6c2", secondary: "#c678dd",
    success: "#98c379", error: "#e06c75", warning: "#e5c07b",
  },
  opencode: {
    background: "#0a0a0a", surface: "#141414", border: "#484848", dim: "#808080",
    text: "#eeeeee", primary: "#fab283", accent: "#9d7cd8", secondary: "#5c9cf5",
    success: "#7fd88f", error: "#e06c75", warning: "#f5a742",
  },
  "osaka-jade": {
    background: "#111c18", surface: "#1a2520", border: "#3d4a44", dim: "#53685B",
    text: "#C1C497", primary: "#2DD5B7", accent: "#549e6a", secondary: "#D2689C",
    success: "#549e6a", error: "#FF5345", warning: "#E5C736",
  },
  palenight: {
    background: "#292d3e", surface: "#1e2132", border: "#32364a", dim: "#676e95",
    text: "#a6accd", primary: "#82aaff", accent: "#89ddff", secondary: "#c792ea",
    success: "#c3e88d", error: "#f07178", warning: "#ffcb6b",
  },
  synthwave84: {
    background: "#262335", surface: "#1e1a29", border: "#495495", dim: "#848bbd",
    text: "#ffffff", primary: "#36f9f6", accent: "#b084eb", secondary: "#ff7edb",
    success: "#72f1b8", error: "#fe4450", warning: "#fede5d",
  },
  vesper: {
    background: "#101010", surface: "#181818", border: "#282828", dim: "#A0A0A0",
    text: "#ffffff", primary: "#FFC799", accent: "#FFC799", secondary: "#99FFE4",
    success: "#99FFE4", error: "#FF8080", warning: "#FFC799",
  },
  zenburn: {
    background: "#3f3f3f", surface: "#4f4f4f", border: "#5f5f5f", dim: "#9f9f9f",
    text: "#dcdccc", primary: "#8cd0d3", accent: "#93e0e3", secondary: "#dc8cc3",
    success: "#7f9f7f", error: "#cc9393", warning: "#f0dfaf",
  },
  orng: {
    background: "#0a0a0a", surface: "#141414", border: "#EC5B2B", dim: "#808080",
    text: "#eeeeee", primary: "#EC5B2B", accent: "#FFF7F1", secondary: "#EE7948",
    success: "#6ba1e6", error: "#e06c75", warning: "#EC5B2B",
  },
  "lucent-orng": {
    background: "#000000", surface: "#0a0a0a", border: "#EC5B2B", dim: "#808080",
    text: "#eeeeee", primary: "#EC5B2B", accent: "#FFF7F1", secondary: "#EE7948",
    success: "#6ba1e6", error: "#e06c75", warning: "#EC5B2B",
  },
  github: {
    background: "#ffffff", surface: "#f6f8fa", border: "#d0d7de", dim: "#57606a",
    text: "#24292f", primary: "#0969da", accent: "#1b7c83", secondary: "#8250df",
    success: "#1a7f37", error: "#cf222e", warning: "#9a6700",
  },
  everforest: {
    background: "#fdf6e3", surface: "#efebd4", border: "#939f91", dim: "#a6b0a0",
    text: "#5c6a72", primary: "#8da101", accent: "#3a94c5", secondary: "#df69ba",
    success: "#8da101", error: "#f85552", warning: "#f57d26",
  },
  solarized: {
    background: "#fdf6e3", surface: "#eee8d5", border: "#cdc8b1", dim: "#93a1a1",
    text: "#657b83", primary: "#268bd2", accent: "#2aa198", secondary: "#6c71c4",
    success: "#859900", error: "#dc322f", warning: "#b58900",
  },
  flexoki: {
    background: "#FFFCF0", surface: "#F2F0E5", border: "#B7B5AC", dim: "#6F6E69",
    text: "#100F0F", primary: "#205EA6", accent: "#BC5215", secondary: "#5E409D",
    success: "#66800B", error: "#AF3029", warning: "#BC5215",
  },
  mercury: {
    background: "#ffffff", surface: "#fbfcfd", border: "#e0e0e8", dim: "#70707d",
    text: "#363644", primary: "#5266eb", accent: "#8da4f5", secondary: "#465bd1",
    success: "#036e43", error: "#b0175f", warning: "#a44200",
  },
  vercel: {
    background: "#FFFFFF", surface: "#FAFAFA", border: "#EAEAEA", dim: "#666666",
    text: "#171717", primary: "#0070F3", accent: "#8E4EC6", secondary: "#0062D1",
    success: "#388E3C", error: "#DC3545", warning: "#FF9500",
  },
}

export const DEFAULT_THEME = 'tokyonight'

export function getTheme(name: string): TuiTheme {
  return THEMES[name] ?? THEMES[DEFAULT_THEME]!
}

export const THEME_NAMES = Object.keys(THEMES)
