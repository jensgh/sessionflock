// Maps an agent id to its tab icon. Renderer-only: Vite resolves the bundled
// asset to a URL, so this never crosses into the main process (which has no need
// for icons and can't import images). Unknown ids fall back to Claude's icon.
import claudeIcon from '../../../assets/agents/claude.svg'

const ICONS: Record<string, string> = {
  claude: claudeIcon
}

export function agentIcon(agentId: string): string {
  return ICONS[agentId] ?? claudeIcon
}
