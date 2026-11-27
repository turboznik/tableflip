import { assertCellCount } from "../limits"
import { looksLikeHeader, makeTable, TableReadError, type ParsedTable } from "../table"

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "BLOCKQUOTE",
  "DD",
  "DIV",
  "DL",
  "DT",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "HR",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "UL",
])
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "HEAD"])
const MAX_SPAN = 1000

/** The visible text of a cell: whitespace collapsed, line breaks kept. */
export function cellText(cell: Element): string {
  const lines: string[] = []
  let line = ""

  const breakLine = () => {
    lines.push(line)
    line = ""
  }

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      line += (node.nodeValue ?? "").replace(/[\t\n\r\f ]+/g, " ")
      return
    }
    if (node.nodeType !== 1) return
    const element = node as Element
    const tag = element.tagName.toUpperCase()
    if (SKIPPED_TAGS.has(tag)) return
    if (tag === "BR") {
      breakLine()
      return
    }
    const block = BLOCK_TAGS.has(tag)
    if (block && line.trim() !== "") breakLine()
    for (const child of element.childNodes) walk(child)
    if (block && line.trim() !== "") breakLine()
  }

  for (const child of cell.childNodes) walk(child)
  if (line !== "" || lines.length === 0) lines.push(line)

  return lines
    .map((text) => text.trim().replace(/\u00a0/g, " "))
    .join("\n")
    .replace(/^\n+|\n+$/g, "")
}

/** Rows of a table, not counting rows of tables nested inside its cells. */
function ownRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return Array.from(table.rows).filter((row) => row.closest("table") === table)
}

function cellCount(table: HTMLTableElement): number {
  let count = 0
  for (const row of ownRows(table)) count += row.cells.length
  return count
}

/** The table to read: the one with the most cells, so layout tables lose. */
function pickTable(doc: Document): HTMLTableElement | null {
  let best: HTMLTableElement | null = null
  let bestCount = -1
  for (const table of Array.from(doc.querySelectorAll("table"))) {
    const count = cellCount(table)
    if (count > bestCount) {
      best = table
      bestCount = count
    }
  }
  return best
}

function span(value: number): number {
  return Number.isFinite(value) && value > 1 ? Math.min(value, MAX_SPAN) : 1
}

/** Reads the biggest HTML table. Merged cells keep their text in the first slot. */
export function readHtml(html: string): ParsedTable {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const table = pickTable(doc)
  if (!table) throw new TableReadError("No table found in this HTML.")

  const rows = ownRows(table)
  let width = 0
  for (const row of rows) {
    let rowWidth = 0
    for (const cell of Array.from(row.cells)) rowWidth += span(cell.colSpan)
    width = Math.max(width, rowWidth)
  }
  assertCellCount(rows.length, width)

  const grid: string[][] = rows.map(() => [])
  rows.forEach((row, r) => {
    let c = 0
    for (const cell of Array.from(row.cells)) {
      while (grid[r][c] !== undefined) c++
      const text = cellText(cell)
      const colSpan = span(cell.colSpan)
      // rowSpan 0 means "to the end of the section".
      const rowSpan = cell.rowSpan === 0 ? rows.length - r : span(cell.rowSpan)
      for (let dr = 0; dr < rowSpan && r + dr < rows.length; dr++) {
        for (let dc = 0; dc < colSpan; dc++) {
          grid[r + dr][c + dc] = dr === 0 && dc === 0 ? text : ""
        }
      }
      c += colSpan
    }
  })

  const dense = grid.map((row) => Array.from(row, (cell) => cell ?? ""))
  if (dense.length === 0) throw new TableReadError("This HTML table has no rows.")

  const firstRow = rows[0]
  const headerMarked =
    firstRow.parentElement?.tagName === "THEAD" ||
    (firstRow.cells.length > 0 && Array.from(firstRow.cells).every((cell) => cell.tagName === "TH"))
  return makeTable(dense, headerMarked || looksLikeHeader(dense))
}
