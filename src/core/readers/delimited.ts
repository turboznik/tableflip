import Papa from "papaparse"

import { assertCellCount, MAX_CELLS } from "../limits"
import { looksLikeHeader, makeTable, type ParsedTable } from "../table"

export type Delimiter = "," | "\t" | ";" | "|"

export interface DelimitedTable extends ParsedTable {
  delimiter: Delimiter
}

/** In order of preference when two delimiters fit equally well. */
const GUESSABLE: Delimiter[] = ["\t", ",", ";", "|"]
const SAMPLE_CHARS = 64 * 1024
const SAMPLE_ROWS = 50

/**
 * Picks the delimiter that splits the first rows most consistently into two
 * or more columns. Blank lines are ignored; Excel ends every copy with one.
 * Returns null when no delimiter splits the text, meaning one column.
 */
export function guessDelimiter(text: string): Delimiter | null {
  let sample = text.slice(0, SAMPLE_CHARS)
  if (text.length > SAMPLE_CHARS) {
    sample = sample.slice(0, Math.max(sample.lastIndexOf("\n"), 0)) || sample
  }
  let best: { delimiter: Delimiter; consistency: number } | null = null
  for (const delimiter of GUESSABLE) {
    const { data } = Papa.parse<string[]>(sample, {
      delimiter,
      skipEmptyLines: true,
      preview: SAMPLE_ROWS,
    })
    if (data.length === 0) continue
    const counts = new Map<number, number>()
    for (const row of data) counts.set(row.length, (counts.get(row.length) ?? 0) + 1)
    let columns = 0
    let rows = 0
    for (const [width, count] of counts) {
      if (count > rows || (count === rows && width > columns)) {
        columns = width
        rows = count
      }
    }
    if (columns < 2) continue
    const consistency = rows / data.length
    if (!best || consistency > best.consistency) best = { delimiter, consistency }
  }
  return best?.delimiter ?? null
}

const TAB = 9
const LF = 10
const CR = 13
const QUOTE = 34

/**
 * Where a quoted spreadsheet cell ends, or -1 when the opening quote is part
 * of the value. Spreadsheets only quote cells that hold line breaks, so a cell
 * like `"` (a ditto mark) or `"A" phase` is copied as it is.
 */
function quotedCellEnd(text: string, start: number): number {
  let lineBreak = false
  for (let i = start + 1; i < text.length; i++) {
    const code = text.charCodeAt(i)
    // Cells can't hold tabs, so the quote didn't open a quoted cell.
    if (code === TAB) return -1
    if (code === LF || code === CR) lineBreak = true
    if (code !== QUOTE) continue
    if (text.charCodeAt(i + 1) === QUOTE) {
      i++
      continue
    }
    const next = text.charCodeAt(i + 1)
    const atCellEnd = i + 1 === text.length || next === TAB || next === LF || next === CR
    return atCellEnd && lineBreak ? i : -1
  }
  return -1
}

/** Splits the tab-separated text that Excel and Google Sheets put on the clipboard. */
function eachSpreadsheetRow(text: string, visit: (row: string[]) => void): void {
  let row: string[] = []
  let i = 0
  for (;;) {
    const close = text.charCodeAt(i) === QUOTE ? quotedCellEnd(text, i) : -1
    if (close !== -1) {
      row.push(text.slice(i + 1, close).replaceAll('""', '"'))
      i = close + 1
    } else {
      let end = i
      while (end < text.length) {
        const code = text.charCodeAt(end)
        if (code === TAB || code === LF || code === CR) break
        end++
      }
      row.push(text.slice(i, end))
      i = end
    }
    if (i >= text.length) break
    const code = text.charCodeAt(i)
    if (code === TAB) {
      i++
      continue
    }
    i += code === CR && text.charCodeAt(i + 1) === LF ? 2 : 1
    visit(row)
    row = []
    if (i >= text.length) return
  }
  visit(row)
}

const SEP_LINE = /^sep=([,;|\t])[ \t]*(?:\r\n|\r|\n)/i

export interface DelimitedOptions {
  /** Leave out to detect it. */
  delimiter?: Delimiter
  /** Text from a spreadsheet's clipboard, which quotes cells its own way. */
  spreadsheet?: boolean
}

/**
 * Reads CSV, TSV and other delimited text, including what Excel and Google
 * Sheets put on the clipboard.
 */
export function readDelimited(
  text: string,
  { delimiter, spreadsheet = false }: DelimitedOptions = {}
): DelimitedTable {
  let source = text.replace(/^\uFEFF/, "")
  // Excel's "sep=;" first line says which delimiter the file uses.
  const declared = SEP_LINE.exec(source)
  if (declared) source = source.slice(declared[0].length)
  const rows: string[][] = []
  let rowCount = 0
  let widest = 0
  let lastFilledRow = -1
  let storing = true
  // Text that no delimiter splits is one column; tab is the least likely to appear in it.
  const used = delimiter ?? (declared?.[1] as Delimiter | undefined) ?? guessDelimiter(source) ?? "\t"

  // Streams rows so a huge paste is counted without keeping every row around.
  const visit = (row: string[]) => {
    const index = rowCount++
    // Empty cells at the end of a row, like those from a trailing comma, aren't columns.
    let width = row.length
    while (width > 0 && row[width - 1] === "") width--
    if (width === 0) {
      if (storing) rows.push(row)
      return
    }
    lastFilledRow = index
    widest = Math.max(widest, width)
    if (storing) {
      rows.push(row)
      if (rows.length * widest > MAX_CELLS) storing = false
    }
  }
  if (spreadsheet && used === "\t") {
    eachSpreadsheetRow(source, visit)
  } else {
    Papa.parse<string[]>(source, {
      delimiter: used,
      skipEmptyLines: false,
      step: (step) => visit(step.data),
    })
  }

  assertCellCount(lastFilledRow + 1, widest)
  const table = makeTable(rows, false)
  return {
    ...table,
    headerSuggested: looksLikeHeader(table.rows),
    delimiter: used,
  }
}
