import { createContext, useContext, useReducer, useEffect, type Dispatch } from 'react'
import type { Provider, Model, BenchmarkResult, ModelBenchState } from '@ai-speedometer/core/types'

export type Screen =
  | 'main-menu'
  | 'model-menu'
  | 'model-select'
  | 'benchmark'
  | 'add-verified'
  | 'add-custom'
  | 'add-models'
  | 'list-providers'
  | 'faq'

export interface AppState {
  screen: Screen
  config: { providers: Provider[] } | null
  selectedModels: Model[]
  benchResults: ModelBenchState[]
  isLoadingConfig: boolean
  logMode: boolean
  logPath: string | null
  runId: string | null
}

export type AppAction =
  | { type: 'NAVIGATE'; screen: Screen }
  | { type: 'SET_CONFIG'; config: { providers: Provider[] } }
  | { type: 'SET_SELECTED_MODELS'; models: Model[] }
  | { type: 'BENCH_START'; models: Model[] }
  | { type: 'BENCH_MODEL_RUNNING'; modelId: string }
  | { type: 'BENCH_MODEL_DONE'; modelId: string; result: BenchmarkResult }
  | { type: 'BENCH_MODEL_ERROR'; modelId: string; error: string }
  | { type: 'BENCH_RESET' }
  | { type: 'SET_LOG_INFO'; logMode: boolean; logPath: string | null; runId: string | null }

const initialState: AppState = {
  screen: 'main-menu',
  config: null,
  selectedModels: [],
  benchResults: [],
  isLoadingConfig: true,
  logMode: false,
  logPath: null,
  runId: null,
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'NAVIGATE':
      return { ...state, screen: action.screen }

    case 'SET_CONFIG':
      return { ...state, config: action.config, isLoadingConfig: false }

    case 'SET_SELECTED_MODELS':
      return { ...state, selectedModels: action.models }

    case 'BENCH_START':
      return {
        ...state,
        benchResults: action.models.map(model => ({
          model,
          status: 'pending' as const,
        })),
      }

    case 'BENCH_MODEL_RUNNING':
      return {
        ...state,
        benchResults: state.benchResults.map(r =>
          r.model.id === action.modelId
            ? { ...r, status: 'running' as const, startedAt: Date.now() }
            : r
        ),
      }

    case 'BENCH_MODEL_DONE':
      return {
        ...state,
        benchResults: state.benchResults.map(r =>
          r.model.id === action.modelId
            ? { ...r, status: 'done' as const, result: action.result }
            : r
        ),
      }

    case 'BENCH_MODEL_ERROR':
      return {
        ...state,
        benchResults: state.benchResults.map(r =>
          r.model.id === action.modelId
            ? { ...r, status: 'error' as const, error: action.error }
            : r
        ),
      }

    case 'BENCH_RESET':
      return { ...state, benchResults: [], selectedModels: [] }

    case 'SET_LOG_INFO':
      return { ...state, logMode: action.logMode, logPath: action.logPath, runId: action.runId }

    default:
      return state
  }
}

const AppContext = createContext<{
  state: AppState
  dispatch: Dispatch<AppAction>
} | null>(null)

export function AppProvider({ children, logMode = false }: { children: React.ReactNode; logMode?: boolean }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    if (logMode) {
      import('@ai-speedometer/core/logger').then(({ createRunId, getLogPath }) => {
        const runId = createRunId()
        const logPath = getLogPath(runId)
        dispatch({ type: 'SET_LOG_INFO', logMode: true, logPath, runId })
      })
    }
  }, [logMode])

  useEffect(() => {
    let cancelled = false
    async function loadConfig() {
      try {
        const { getAllAvailableProviders } = await import('@ai-speedometer/core/opencode-integration')
        const providers = await getAllAvailableProviders(false)
        if (!cancelled) {
          dispatch({ type: 'SET_CONFIG', config: { providers } })
        }
      } catch {
        if (!cancelled) {
          dispatch({ type: 'SET_CONFIG', config: { providers: [] } })
        }
      }
    }
    loadConfig()
    return () => { cancelled = true }
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

export function useNavigate() {
  const { dispatch } = useAppContext()
  return (screen: Screen) => dispatch({ type: 'NAVIGATE', screen })
}
