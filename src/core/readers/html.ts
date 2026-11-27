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
  // Only seen in tables nested inside a cell.
  "CAPTION",
  "TR",
  "TD",
  "TH",
])
const SKIPPED_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "HEAD", "SVG"])
const MAX_SPAN = 1000
/** Stands in for spaces that are kept as they are, until whitespace has been collapsed. HTML parsing drops NUL characters. */
const KEPT_SPACE = "\u0000"
/** Spaces marked by Office ("Copy table" writes these too) and spaces in preformatted text. */
const KEEPS_SPACES = /mso-spacerun:\s*yes/i
const HIDDEN = /display:\s*none/i
/** Word's list markers, like "·" or "1." followed by spacing, in a span it marks to be ignored. */
const LIST_MARKER = /mso-list:\s*ignore/i
const NUMBERED_MARKER = /^[0-9a-z]{1,4}[.)]$/i

/** The visible text of a cell: whitespace collapsed, line breaks kept. */
export function cellText(cell: Element): string {
  const lines: string[] = []
  let line = ""

  const breakLine = () => {
    lines.push(line)
    line = ""
  }

  const addText = (text: string) => {
    // Spaces on both sides of an element boundary show as one.
    line += line.endsWith(" ") && text.startsWith(" ") ? text.slice(1) : text
  }

  const walk = (node: Node, keepSpaces: boolean) => {
    if (node.nodeType === 3) {
      const text = node.nodeValue ?? ""
      if (!keepSpaces) {
        addText(text.replace(/[\t\n\r\f ]+/g, " "))
        return
      }
      text.split(/\r\n|\r|\n/).forEach((part, i) => {
        if (i > 0) breakLine()
        line += part.replace(/[\t \u00a0]/g, KEPT_SPACE)
      })
      return
    }
    if (node.nodeType !== 1) return
    const element = node as Element
    const tag = element.tagName.toUpperCase()
    if (SKIPPED_TAGS.has(tag) || element.hasAttribute("hidden")) return
    if (tag === "BR") {
      breakLine()
      return
    }
    const style = element.getAttribute("style") ?? ""
    if (HIDDEN.test(style)) return
    if (LIST_MARKER.test(style)) {
      const marker = (element.textContent ?? "").replace(/[\s\u00a0]+/g, "")
      addText(`${NUMBERED_MARKER.test(marker) ? marker : "•"} `)
      return
    }
    if (tag === "SELECT") {
      const option = element.querySelector("option[selected]") ?? element.querySelector("option")
      addText(option?.textContent?.trim() ?? "")
      return
    }
    const block = BLOCK_TAGS.has(tag)
    if (block && line.trim() !== "") breakLine()
    const keep = keepSpaces || tag === "PRE" || tag === "TEXTAREA" || KEEPS_SPACES.test(style)
    for (const child of element.childNodes) walk(child, keep)
    if (block && line.trim() !== "") breakLine()
  }

  for (const child of cell.childNodes) walk(child, false)
  if (line !== "" || lines.length === 0) lines.push(line)

  return lines
    .map((text) =>
      text
        .trim()
        .replace(/\u00a0/g, " ")
        .replaceAll(KEPT_SPACE, " ")
    )
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

/** For each row, the index just past the last row of its section (thead, tbody or tfoot). */
function sectionEnds(rows: HTMLTableRowElement[]): number[] {
  const ends = new Array<number>(rows.length)
  for (let r = rows.length - 1; r >= 0; r--) {
    const sameSection = r + 1 < rows.length && rows[r + 1].parentElement === rows[r].parentElement
    ends[r] = sameSection ? ends[r + 1] : r + 1
  }
  return ends
}

/** Reads the biggest HTML table. Merged cells keep their text in the first slot. */
export function readHtml(html: string): ParsedTable {
  const doc = new DOMParser().parseFromString(html, "text/html")
  const table = pickTable(doc)
  if (!table) throw new TableReadError("No table found in this HTML.")

  const rows = ownRows(table)
  const ends = sectionEnds(rows)
  const grid: string[][] = rows.map(() => [])
  let width = 0
  rows.forEach((row, r) => {
    let c = 0
    for (const cell of Array.from(row.cells)) {
      while (grid[r][c] !== undefined) c++
      // Merged cells that would overlap another are cut short, so each slot is filled once
      // and the work stays within the cell limit.
      let colSpan = 1
      while (colSpan < span(cell.colSpan) && grid[r][c + colSpan] === undefined) colSpan++
      if (c + colSpan > width) {
        width = c + colSpan
        assertCellCount(rows.length, width)
      }
      // rowSpan 0 means "to the end of the section".
      const bottom = cell.rowSpan === 0 ? ends[r] : Math.min(r + span(cell.rowSpan), ends[r])
      const text = cellText(cell)
      for (let dc = 0; dc < colSpan; dc++) {
        grid[r][c + dc] = dc === 0 ? text : ""
        for (let below = r + 1; below < bottom && grid[below][c + dc] === undefined; below++) {
          grid[below][c + dc] = ""
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
