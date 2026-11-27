/**
 * Size limits. tableflip is for everyday tables, so it refuses anything
 * bigger instead of freezing the page.
 */
export const MAX_INPUT_BYTES = 5 * 1024 * 1024
export const MAX_CELLS = 100_000

export class TooMuchDataError extends Error {
  readonly title = "Too much data."

  constructor(message: string) {
    super(message)
    this.name = "TooMuchDataError"
  }
}

const numberFormat = new Intl.NumberFormat("en-US")

export function formatCount(value: number): string {
  return numberFormat.format(value)
}

/** Rounds up when `roundUp` is set, so an oversized input never reads as "5.0 MB". */
export function formatBytes(bytes: number, roundUp = false): string {
  const round = (value: number) => (roundUp ? (Math.ceil(value * 10) / 10).toFixed(1) : value.toFixed(1))
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${round(bytes / 1024)} KB`
  const mb = bytes / (1024 * 1024)
  return `${Number.isInteger(mb) ? mb : round(mb)} MB`
}

/** UTF-8 size of a string, without allocating an encoded copy. */
export function utf8ByteLength(text: string): number {
  let bytes = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80) bytes += 1
    else if (code < 0x800) bytes += 2
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4
        i++
      } else {
        bytes += 3
      }
    } else bytes += 3
  }
  return bytes
}

export function assertInputSize(bytes: number): void {
  if (bytes > MAX_INPUT_BYTES) {
    throw new TooMuchDataError(
      `tableflip accepts up to ${formatBytes(MAX_INPUT_BYTES)} of text. This is ${formatBytes(bytes, true)}.`
    )
  }
}

/** Checks text length cheaply first; only counts bytes when it could matter. */
export function assertTextSize(text: string): void {
  // Every UTF-16 code unit is at least one UTF-8 byte, so this is a safe shortcut.
  if (text.length > MAX_INPUT_BYTES) {
    assertInputSize(utf8ByteLength(text))
    return
  }
  if (text.length * 3 > MAX_INPUT_BYTES) assertInputSize(utf8ByteLength(text))
}

export function assertCellCount(rows: number, columns: number): void {
  const cells = rows * columns
  if (cells > MAX_CELLS) {
    throw new TooMuchDataError(
      `tableflip handles up to ${formatCount(MAX_CELLS)} cells. This table has ${formatCount(cells)} (${formatCount(rows)} ${rows === 1 ? "row" : "rows"} × ${formatCount(columns)} ${columns === 1 ? "column" : "columns"}).`
    )
  }
}
