import Papa from "papaparse"

import { assertCellCount, MAX_CELLS } from "../limits"
import { looksLikeHeader, makeTable, type ParsedTable } from "../table"

export type Delimiter = "," | "\t" | ";" | "|"

export interface DelimitedTable extends ParsedTable {
  delimiter: Delimiter
}

const GUESSABLE: Delimiter[] = ["\t", ",", ";", "|"]

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
  let detected: string | undefined

  // Streams rows so a huge paste is counted without keeping every row around.
  Papa.parse<string[]>(source, {
    delimiter: delimiter ?? "",
    delimitersToGuess: GUESSABLE,
    skipEmptyLines: false,
    step(step) {
      detected ??= step.meta.delimiter
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

  const used = (delimiter ?? detected ?? ",") as Delimiter

  assertCellCount(lastFilledRow + 1, widest)
  const table = makeTable(rows, false)
  return {
    ...table,
    headerSuggested: looksLikeHeader(table.rows),
    delimiter: GUESSABLE.includes(used) ? used : ",",
  }
}
