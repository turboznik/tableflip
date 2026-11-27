import type { TableView } from "../table"
import { writeDelimited } from "./delimited"
import { excelHtmlRows } from "./html"

export interface ExcelOptions {
  /**
   * Marks every cell as text so Excel doesn't turn "1-2" into a date,
   * drop leading zeros, or treat "+24V" as a formula.
   */
  keepText: boolean
}

export interface ClipboardPayload {
  text: string
  html?: string
}

/** Tab-separated text, the way Excel itself copies cells. */
export function writeExcelText(view: TableView): string {
  return writeDelimited(view, "\t")
}

/**
 * What "Copy for Excel" puts on the clipboard. Excel prefers the HTML,
 * which is where the keep-as-text formatting lives; other apps get the
 * tab-separated text.
 */
export function excelClipboard(view: TableView, options: ExcelOptions): ClipboardPayload {
  const html = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">',
    '<head><meta charset="utf-8"></head>',
    `<body><table>${excelHtmlRows(view, options.keepText)}</table></body>`,
    "</html>",
  ].join("")
  return { text: writeExcelText(view), html }
}
