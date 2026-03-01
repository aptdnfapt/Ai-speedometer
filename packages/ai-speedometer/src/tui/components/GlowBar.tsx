import { useState, useEffect } from 'react'
import { engine, Timeline } from '@opentui/core'
import { useTheme } from '../theme/ThemeContext.tsx'

const BAR_W = 25

function blendHex(hex: string, toward: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)
  ]
  const [r1,g1,b1] = parse(hex.length === 7 ? hex : '#ffffff')
  const [r2,g2,b2] = parse(toward.length === 7 ? toward : '#ffffff')
  const r = Math.round(r1 + (r2-r1)*t)
  const g = Math.round(g1 + (g2-g1)*t)
  const b = Math.round(b1 + (b2-b1)*t)
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`
}

interface GlowBarProps {
  done: number
  total: number
  running: number
}

export function GlowBar({ done, total, running }: GlowBarProps) {
  const theme = useTheme()
  const [pos, setPos] = useState(0)

  useEffect(() => {
    const tl = new Timeline({ loop: true, duration: 2200 })
    const target = { pos: 0 }
    tl.add(target, { pos: 1, duration: 2200, ease: 'linear', onUpdate: (anim) => {
      setPos((anim.targets[0] as { pos: number }).pos)
    } }, 0)
    tl.play()
    engine.register(tl)
    return () => { tl.pause(); engine.unregister(tl) }
  }, [])

  const filled = Math.round((done / (total || 1)) * BAR_W)

  const barChars = Array.from({ length: BAR_W }, (_, i) => {
    if (i >= filled) return { ch: '░', fg: theme.border }
    const phase = pos - (i / BAR_W)
    const intensity = Math.sin(Math.PI * phase * 1.5)
    const fg = intensity >= 0
      ? blendHex(theme.accent, '#ffffff', intensity * 0.55)
      : blendHex(theme.accent, theme.background, Math.abs(intensity) * 0.5)
    return { ch: '█', fg }
  })

  return (
    <box height={1} flexDirection="row" paddingLeft={2}>
      <text fg={theme.dim}>Benchmarking  </text>
      <text fg={theme.accent}>{done}/{total}  </text>
      {barChars.map((b, i) => (
        <text key={i} fg={b.fg}>{b.ch}</text>
      ))}
      <text fg={theme.warning}>  {running} running...</text>
    </box>
  )
}
