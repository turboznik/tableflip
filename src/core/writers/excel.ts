import { allRows, type TableView } from "../table"
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

/** Marks tableflip's own copies, so pasting one back reads its HTML, which keeps every cell exactly. */
export const GENERATOR_META = '<meta name="generator" content="tableflip">'

/**
 * Tab-separated text, the way Excel itself copies cells: only cells with line
 * breaks are quoted, so an inch mark like 12" stays as it is. Cells with tabs
 * are quoted too, since a tab would start a new cell.
 */
export function writeExcelText(view: TableView): string {
  const cell = (text: string) => (/[\t\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text)
  return allRows(view)
    .map((row) => row.map(cell).join("\t"))
    .join("\r\n")
}

/**
 * What "Copy for Excel" puts on the clipboard. Excel prefers the HTML,
 * which is where the keep-as-text formatting lives; other apps get the
 * tab-separated text.
 */
export function excelClipboard(view: TableView, options: ExcelOptions): ClipboardPayload {
  const html = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">',
    `<head><meta charset="utf-8">${GENERATOR_META}</head>`,
    `<body><table>${excelHtmlRows(view, options.keepText)}</table></body>`,
    "</html>",
  ].join("")
  return { text: writeExcelText(view), html }
}
