import type { ClipboardPayload } from "@/core"

/**
 * Copies text, and optionally HTML, to the clipboard.
 *
 * The copy event writes exactly what we give it, in every browser. The async
 * Clipboard API is the fallback; Chromium rewrites HTML that goes through it,
 * which would drop the Excel formatting hints.
 */
export async function copyToClipboard(payload: ClipboardPayload): Promise<void> {
  if (copyWithEvent(payload)) return

  if (payload.html && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([payload.text], { type: "text/plain" }),
        "text/html": new Blob([payload.html], { type: "text/html" }),
      }),
    ])
    return
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(payload.text)
    return
  }
  throw new Error("This browser doesn't allow copying from web pages.")
}

function copyWithEvent(payload: ClipboardPayload): boolean {
  let written = false
  const onCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return
    event.preventDefault()
    event.stopImmediatePropagation()
    event.clipboardData.setData("text/plain", payload.text)
    if (payload.html) event.clipboardData.setData("text/html", payload.html)
    written = true
  }
  document.addEventListener("copy", onCopy, true)
  try {
    document.execCommand("copy")
  } catch {
    // Some browsers throw instead of returning false.
  } finally {
    document.removeEventListener("copy", onCopy, true)
  }
  return written
}
