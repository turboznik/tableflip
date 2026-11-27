/** Saves text as a file. `bom` adds a UTF-8 byte order mark, which Excel needs for CSV. */
export function downloadText(text: string, filename: string, mimeType: string, bom = false): void {
  const parts = bom ? ["\uFEFF", text] : [text]
  const blob = new Blob(parts, { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.append(link)
  link.click()
  link.remove()
  // Revoking right away can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
