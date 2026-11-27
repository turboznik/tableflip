export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)

/** How to write a shortcut with the Ctrl key (⌘ on a Mac), like "Ctrl+V". */
export const shortcut = (key: string) => (isMac ? `⌘${key}` : `Ctrl+${key}`)
