import { allRows, type TableView } from "../table"

export interface HtmlOptions {
  /** Adds borders and padding as inline styles, which email clients keep. */
  inlineStyles: boolean
}

const TABLE_STYLE = "border-collapse: collapse"
const CELL_STYLE = "border: 1px solid #d4d4d4; padding: 4px 8px; text-align: left; vertical-align: top"
const HEADER_STYLE = `${CELL_STYLE}; background: #f5f5f5; font-weight: bold`

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function cellHtml(text: string, lineBreak: string): string {
  return escapeHtml(text).replace(/\r\n|\r|\n/g, lineBreak)
}

function row(cells: string[], tag: "th" | "td", style: string | null): string {
  const open = style ? `<${tag} style="${style}">` : `<${tag}>`
  return `<tr>${cells.map((cell) => `${open}${cellHtml(cell, "<br>")}</${tag}>`).join("")}</tr>`
}

/** The table as readable HTML code, one row per line. */
export function writeHtml(view: TableView, options: HtmlOptions): string {
  const cellStyle = options.inlineStyles ? CELL_STYLE : null
  const headerStyle = options.inlineStyles ? HEADER_STYLE : null
  const lines = [options.inlineStyles ? `<table style="${TABLE_STYLE}">` : "<table>"]
  if (view.header) {
    lines.push("  <thead>", `    ${row(view.header, "th", headerStyle)}`, "  </thead>")
  }
  lines.push("  <tbody>")
  for (const cells of view.body) lines.push(`    ${row(cells, "td", cellStyle)}`)
  lines.push("  </tbody>", "</table>")
  return lines.join("\n")
}

/** A styled table for pasting into Word, Outlook and other rich editors. */
export function writeRichHtml(view: TableView): string {
  return writeHtml(view, { inlineStyles: true })
}

/** A complete page, so a downloaded file opens properly in a browser. */
export function writeHtmlDocument(view: TableView, options: HtmlOptions): string {
  const table = writeHtml(view, options)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n")
  return [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta charset="utf-8">',
    "    <title>Table</title>",
    "  </head>",
    "  <body>",
    table,
    "  </body>",
    "</html>",
    "",
  ].join("\n")
}

/** All rows as HTML table rows, for the Excel clipboard format. */
export function excelHtmlRows(view: TableView, keepText: boolean): string {
  // Excel splits a cell at <br> unless told to keep the break in the cell.
  const lineBreak = '<br style="mso-data-placement:same-cell">'
  const open = keepText ? `<td style='mso-number-format:"\\@"'>` : "<td>"
  return allRows(view)
    .map(
      (cells) =>
        `<tr>${cells.map((cell) => `${open}${cellHtml(cell, lineBreak)}</td>`).join("")}</tr>`
    )
    .join("")
}
