import { useOs } from '@mantine/hooks'

/** How the confirm hotkey (mod+Enter) is written on this computer: Cmd on a Mac, Ctrl elsewhere. */
export const useConfirmHotkeyLabel = () => (useOs() === 'macos' ? '⌘+Enter' : 'Ctrl+Enter')
