import { assertCellCount } from "./limits"

/** A table as read from the input: a rectangular grid of strings. */
export interface ParsedTable {
  rows: string[][]
  columnCount: number
  /** Whether the reader thinks the first row holds column names. */
  headerSuggested: boolean
}

/** A table ready for writing: an optional header row and the data rows. */
export interface TableView {
  header: string[] | null
  body: string[][]
  columnCount: number
}

export class TableReadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TableReadError"
  }
}

/**
 * Pads ragged rows to the same width and drops trailing empty rows.
 * Checks the cell limit before allocating anything new.
 */
export function makeTable(
  rawRows: string[][],
  headerSuggested: boolean
): ParsedTable {
  let end = rawRows.length
  while (end > 0 && rawRows[end - 1].every((cell) => cell === "")) end--

  let columnCount = 0
  for (let i = 0; i < end; i++) {
    columnCount = Math.max(columnCount, trimmedLength(rawRows[i]))
  }
  assertCellCount(end, columnCount)

  const rows: string[][] = new Array(end)
  for (let i = 0; i < end; i++) {
    const row = rawRows[i]
    if (row.length === columnCount) {
      rows[i] = row
    } else if (row.length > columnCount) {
      rows[i] = row.slice(0, columnCount)
    } else {
      const padded = row.slice()
      while (padded.length < columnCount) padded.push("")
      rows[i] = padded
    }
  }
  return {
    rows,
    columnCount,
    headerSuggested: headerSuggested && rows.length > 0,
  }
}

/** Length of a row ignoring trailing empty cells. */
function trimmedLength(row: string[]): number {
  let length = row.length
  while (length > 0 && row[length - 1] === "") length--
  return length
}

export function toView(table: ParsedTable, hasHeader: boolean): TableView {
  if (hasHeader && table.rows.length > 0) {
    return {
      header: table.rows[0],
      body: table.rows.slice(1),
      columnCount: table.columnCount,
    }
  }
  return { header: null, body: table.rows, columnCount: table.columnCount }
}

/** All rows, header first, for formats that don't treat the header specially. */
export function allRows(view: TableView): string[][] {
  return view.header ? [view.header, ...view.body] : view.body
}

/**
 * Column names that are safe to use as keys: blanks get "Column N" and
 * duplicates get a numeric suffix.
 */
export function columnNames(view: TableView): string[] {
  const names: string[] = []
  const used = new Set<string>()
  for (let i = 0; i < view.columnCount; i++) {
    const base = view.header?.[i]?.trim() || `Column ${i + 1}`
    let name = base
    let suffix = 2
    while (used.has(name)) name = `${base}_${suffix++}`
    used.add(name)
    names.push(name)
  }
  return names
}

const NUMBER_LIKE = /^-?\d+(?:[.,]\d+)*%?$/

/**
 * Guesses whether the first row is a header: every cell filled in, all
 * different, and none of them a number.
 */
export function looksLikeHeader(rows: string[][]): boolean {
  if (rows.length < 2) return false
  const first = rows[0]
  const seen = new Set<string>()
  for (const cell of first) {
    const value = cell.trim()
    if (value === "" || seen.has(value) || NUMBER_LIKE.test(value)) return false
    seen.add(value)
  }
  return first.length > 0
}
