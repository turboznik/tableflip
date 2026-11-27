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

/** Spaces that HTML would collapse: runs of them, and any at the start or end of a line. */
const COLLAPSED_SPACES = / {2,}|^ | $|(?<=[\r\n]) | (?=[\r\n])/g

/**
 * A cell's text as HTML. With `keepSpaces`, spaces HTML would collapse are
 * marked the way Office does, so Excel, Word and Outlook keep them.
 */
function cellHtml(text: string, lineBreak: string, keepSpaces = false): string {
  let html = escapeHtml(text)
  if (keepSpaces) html = html.replace(COLLAPSED_SPACES, (spaces) => `<span style='mso-spacerun:yes'>${spaces}</span>`)
  return html.replace(/\r\n|\r|\n/g, lineBreak)
}

function row(cells: string[], tag: "th" | "td", style: string | null, keepSpaces: boolean): string {
  const open = style ? `<${tag} style="${style}">` : `<${tag}>`
  return `<tr>${cells.map((cell) => `${open}${cellHtml(cell, "<br>", keepSpaces)}</${tag}>`).join("")}</tr>`
}

function tableHtml(view: TableView, inlineStyles: boolean, keepSpaces: boolean): string {
  const cellStyle = inlineStyles ? CELL_STYLE : null
  const headerStyle = inlineStyles ? HEADER_STYLE : null
  const lines = [inlineStyles ? `<table style="${TABLE_STYLE}">` : "<table>"]
  if (view.header) {
    lines.push("  <thead>", `    ${row(view.header, "th", headerStyle, keepSpaces)}`, "  </thead>")
  }
  lines.push("  <tbody>")
  for (const cells of view.body) lines.push(`    ${row(cells, "td", cellStyle, keepSpaces)}`)
  lines.push("  </tbody>", "</table>")
  return lines.join("\n")
}

/** The table as readable HTML code, one row per line. */
export function writeHtml(view: TableView, options: HtmlOptions): string {
  return tableHtml(view, options.inlineStyles, false)
}

/** A styled table for pasting into Word, Outlook and other rich editors. */
export function writeRichHtml(view: TableView): string {
  return tableHtml(view, true, true)
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
        `<tr>${cells.map((cell) => `${open}${cellHtml(cell, lineBreak, true)}</td>`).join("")}</tr>`
    )
    .join("")
}
