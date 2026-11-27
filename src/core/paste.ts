import { MAX_INPUT_BYTES, TooMuchDataError } from "./limits"
import type { ReadHint } from "./read"
import { readHtml } from "./readers/html"
import { toView } from "./table"
import { writeDelimited } from "./writers/delimited"

export interface PastedInput {
  text: string
  hint: ReadHint
  /** Whether a rich table was turned into tab-separated text. */
  fromRichTable: boolean
}

/**
 * Spreadsheets put good tab-separated text on the clipboard; use it as is.
 * Excel writes `<meta name=ProgId content=Excel.Sheet>`; browsers that clean
 * up pasted HTML may add quotes or drop the Office namespaces.
 */
const SPREADSHEET_SOURCE =
  /urn:schemas-microsoft-com:office:excel|google-sheets-html-origin|LibreOffice|ProgId["']?\s+content=["']?Excel/i

/**
 * Picks what to use from a paste. Tables copied from web pages, Word or
 * Outlook arrive as HTML with poor plain text, so those become tab-separated
 * text. Spreadsheets and plain text are used as they are.
 */
export function choosePaste(html: string, plain: string): PastedInput {
  if (html !== "" && SPREADSHEET_SOURCE.test(html.slice(0, 4000))) {
    return {
      text: plain,
      hint: { format: "delimited", delimiter: "\t", spreadsheet: true },
      fromRichTable: false,
    }
  }

  if (html !== "" && html.length <= MAX_INPUT_BYTES * 4 && /<table[\s>]/i.test(html)) {
    try {
      const table = readHtml(html)
      if (table.rows.length > 0) {
        return {
          text: writeDelimited(toView(table, false), "\t", "\n"),
          hint: { format: "delimited", delimiter: "\t", header: table.headerSuggested },
          fromRichTable: true,
        }
      }
    } catch (error) {
      if (error instanceof TooMuchDataError) throw error
      // Otherwise fall back to the plain text below.
    }
  }
  return { text: plain, hint: {}, fromRichTable: false }
}
