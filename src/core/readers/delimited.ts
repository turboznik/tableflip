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

/**
 * Reads CSV, TSV and other delimited text, including what Excel and Google
 * Sheets put on the clipboard. Leave `delimiter` out to detect it.
 */
export function readDelimited(
  text: string,
  delimiter?: Delimiter
): DelimitedTable {
  const source = text.replace(/^\uFEFF/, "")
  const rows: string[][] = []
  let rowCount = 0
  let widest = 0
  let lastFilledRow = -1
  let storing = true
  // Text that no delimiter splits is one column; tab is the least likely to appear in it.
  const used = delimiter ?? guessDelimiter(source) ?? "\t"

  // Streams rows so a huge paste is counted without keeping every row around.
  Papa.parse<string[]>(source, {
    delimiter: used,
    skipEmptyLines: false,
    step(step) {
      const row = step.data
      const index = rowCount++
      if (row.length === 1 && row[0] === "") {
        if (storing) rows.push(row)
        return
      }
      lastFilledRow = index
      widest = Math.max(widest, row.length)
      if (storing) {
        rows.push(row)
        if (rows.length * widest > MAX_CELLS) storing = false
      }
    },
  })

  assertCellCount(lastFilledRow + 1, widest)
  const table = makeTable(rows, false)
  return {
    ...table,
    headerSuggested: looksLikeHeader(table.rows),
    delimiter: used,
  }
}
