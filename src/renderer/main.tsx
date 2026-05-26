import { createRoot } from 'react-dom/client'
import '@xterm/xterm/css/xterm.css'
import './styles.css'
import { App } from './App'

const rootEl = document.getElementById('root')
if (!rootEl) {
  throw new Error('Root element #root not found')
}

// NOTE: StrictMode is intentionally omitted. Its dev-only double-invocation of
// effects would double-register the global pty data/exit listeners and disrupt
// the one-shot session-restore flow (which spawns real processes). The effects
// here manage real, non-idempotent resources (live ptys/terminals).
createRoot(rootEl).render(<App />)
