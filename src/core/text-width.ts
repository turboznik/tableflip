const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null

const ZERO_WIDTH = /^[\p{Mn}\p{Me}\p{Cf}\p{Cc}]+$/u
const EMOJI = /\p{Emoji_Presentation}|\uFE0F/u

function isWideCodePoint(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe4f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x3fffd)
  )
}

function graphemeWidth(grapheme: string): number {
  if (ZERO_WIDTH.test(grapheme)) return 0
  if (EMOJI.test(grapheme)) return 2
  return isWideCodePoint(grapheme.codePointAt(0) ?? 0) ? 2 : 1
}

const ASCII_ONLY = /^[\x20-\x7e]*$/

/** How many monospace columns a string takes up. */
export function textWidth(text: string): number {
  if (ASCII_ONLY.test(text)) return text.length
  let width = 0
  if (segmenter) {
    for (const { segment } of segmenter.segment(text)) width += graphemeWidth(segment)
  } else {
    for (const char of text) width += graphemeWidth(char)
  }
  return width
}

export function padEnd(text: string, width: number): string {
  return text + " ".repeat(Math.max(0, width - textWidth(text)))
}

export function padStart(text: string, width: number): string {
  return " ".repeat(Math.max(0, width - textWidth(text))) + text
}
