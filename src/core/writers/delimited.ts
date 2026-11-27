import { allRows, type TableView } from "../table"

export type CsvDelimiter = "," | ";" | "\t"

export interface CsvOptions {
  delimiter: CsvDelimiter
}

function quote(value: string, delimiter: string): string {
  const needsQuotes =
    value.includes(delimiter) || value.includes('"') || value.includes("\n") || value.includes("\r")
  return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value
}

/** Delimited text with standard quoting, which is also what Excel pastes. */
export function writeDelimited(view: TableView, delimiter: string, newline = "\r\n"): string {
  return allRows(view)
    .map((row) => row.map((cell) => quote(cell, delimiter)).join(delimiter))
    .join(newline)
}

export function writeCsv(view: TableView, options: CsvOptions): string {
  return writeDelimited(view, options.delimiter)
}
