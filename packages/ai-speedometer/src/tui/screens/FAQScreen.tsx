import { useAppKeyboard as useKeyboard } from '../hooks/useAppKeyboard.ts'
import { useNavigate } from '../context/AppContext.tsx'
import { useTheme } from '../theme/ThemeContext.tsx'

export function FAQScreen() {
  const navigate = useNavigate()
  const theme = useTheme()

  useKeyboard((key) => {
    if (key.name === 'escape' || key.name === 'q') {
      navigate('main-menu')
    }
  })

  return (
    <box flexDirection="column" flexGrow={1} alignItems="center" padding={1}>
      <box flexDirection="column" width={70}>
        <box marginBottom={1}>
          <text fg={theme.primary} bold>FAQ / Learn</text>
        </box>
        <scrollbox focused flexGrow={1}>
          <box flexDirection="column">
            <box flexDirection="column" border borderStyle="rounded" borderColor={theme.border} padding={1} marginBottom={1}>
              <text fg={theme.accent} bold>METRICS EXPLAINED</text>
              <text fg={theme.text}> </text>
              
              <text fg={theme.secondary} bold>TPS (Tokens Per Second)</text>
              <text fg={theme.text}>  How fast a model generates tokens after the first one.</text>
              <text fg={theme.dim}>  Formula: output_tokens / generation_time</text>
              <text fg={theme.success}>  → Higher is better (faster streaming)</text>
              <text fg={theme.text}> </text>
              
              <text fg={theme.secondary} bold>TTFT (Time To First Token)</text>
              <text fg={theme.text}>  Time from request to receiving the first token.</text>
              <text fg={theme.dim}>  Formula: first_token_time - request_start_time</text>
              <text fg={theme.success}>  → Lower is better (less waiting)</text>
              <text fg={theme.text}> </text>
              
              <text fg={theme.secondary} bold>F1000 (First to 1000)</text>
              <text fg={theme.text}>  Time to complete 1000 agentic requests (~300 tokens each).</text>
              <text fg={theme.dim}>  Formula: 1000 × (TTFT + 300/TPS) = hours</text>
              <text fg={theme.success}>  → Lower is better</text>
              <text fg={theme.text}> </text>
              <text fg={theme.text}>  Why it matters: In agentic coding (Cursor, Copilot, OpenCode),</text>
              <text fg={theme.text}>  models make hundreds of tool calls — TTFT adds up massively.</text>
              <text fg={theme.text}>  A 30 tok/s + 1s TTFT model can match a 60 tok/s + 6s TTFT model.</text>
              <text fg={theme.text}> </text>
              
              <text fg={theme.secondary} bold>Total Time</text>
              <text fg={theme.text}>  Complete request duration from start to finish.</text>
              <text fg={theme.dim}>  Includes: connection, TTFT, and generation time</text>
            </box>
            
            <box flexDirection="column" border borderStyle="rounded" borderColor={theme.border} padding={1} marginBottom={1}>
              <text fg={theme.accent} bold>LINKS</text>
              <text fg={theme.text}> </text>
              
              <text fg={theme.secondary} bold>Discord Community</text>
              <text fg={theme.text}>  https://discord.gg/6S7HwCxbMy</text>
              <text fg={theme.dim}>  Join for help, updates, and discussions</text>
              <text fg={theme.text}> </text>
              
              <text fg={theme.secondary} bold>Website & Leaderboard</text>
              <text fg={theme.text}>  https://ai-speedometer.oliveowl.xyz/</text>
              <text fg={theme.dim}>  Track OSS model speeds over time</text>
              <text fg={theme.text}> </text>
              
              <text fg={theme.secondary} bold>GitHub</text>
              <text fg={theme.text}>  https://github.com/anomaly/ai-speedometer</text>
              <text fg={theme.dim}>  Source code, issues, contributions</text>
            </box>
            
            <box flexDirection="column" border borderStyle="rounded" borderColor={theme.border} padding={1} marginBottom={1}>
              <text fg={theme.accent} bold>TIPS</text>
              <text fg={theme.text}> </text>
              
              <text fg={theme.text}>  • Press [T] anytime to open the theme picker</text>
              <text fg={theme.text}>  • Use --log flag to save raw SSE data for debugging</text>
              <text fg={theme.text}>  • Run headless with ai-speedometer-headless for CI/CD</text>
              <text fg={theme.text}>  • [*] in results means token count was estimated</text>
            </box>
            
            <box flexDirection="row" justifyContent="center" marginTop={1}>
              <text fg={theme.dim}>Press [Q] or [Esc] to return to main menu</text>
            </box>
          </box>
        </scrollbox>
      </box>
    </box>
  )
}
