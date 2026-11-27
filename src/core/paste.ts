import { MAX_INPUT_BYTES } from "./limits"
import type { InputFormat } from "./read"
import { readHtml } from "./readers/html"
import { toView } from "./table"
import { writeDelimited } from "./writers/delimited"

export interface PastedInput {
  text: string
  /** The format to read the text as, or "auto" to detect it. */
  format: InputFormat | "auto"
  /** Whether a rich table was turned into tab-separated text. */
  fromRichTable: boolean
}

/** Spreadsheets put good tab-separated text on the clipboard; use it as is. */
const SPREADSHEET_SOURCE =
  /urn:schemas-microsoft-com:office:excel|google-sheets-html-origin|LibreOffice|ProgId content=Excel/i

/**
 * Picks what to use from a paste. Tables copied from web pages, Word or
 * Outlook arrive as HTML with poor plain text, so those become tab-separated
 * text. Spreadsheets and plain text are used as they are.
 */
export function choosePaste(html: string, plain: string): PastedInput {
  const usable =
    html !== "" &&
    html.length <= MAX_INPUT_BYTES * 4 &&
    /<table[\s>]/i.test(html) &&
    !SPREADSHEET_SOURCE.test(html.slice(0, 4000))

  if (usable) {
    try {
      const table = readHtml(html)
      if (table.rows.length > 0) {
        return {
          text: writeDelimited(toView(table, false), "\t", "\n"),
          format: "delimited",
          fromRichTable: true,
        }
      }
    } catch {
      // Fall back to the plain text below.
    }
  }
  return { text: plain, format: "auto", fromRichTable: false }
}
