import { columnNames, type TableView } from "../table"
import { columnKinds, isNumericKind, type ColumnKind } from "../values"

export interface JsonOptions {
  /** "objects" uses column names as keys; "arrays" writes each row as a list. */
  shape: "objects" | "arrays"
  /** Writes numbers and true/false as JSON values instead of strings. */
  detectTypes: boolean
  minify: boolean
}

export type JsonLinesOptions = Omit<JsonOptions, "minify">

/** One cell as a JSON value. Numbers are written exactly as they appear. */
function jsonValue(value: string, kind: ColumnKind | null): string {
  if (kind && kind !== "string") {
    const trimmed = value.trim()
    if (trimmed === "") return "null"
    if (isNumericKind(kind)) return trimmed
    if (kind === "boolean") return trimmed.toLowerCase()
  }
  return JSON.stringify(value)
}

function rowValues(row: string[], kinds: (ColumnKind | null)[]): string[] {
  return row.map((cell, i) => jsonValue(cell, kinds[i]))
}

interface PreparedRows {
  keys: string[] | null
  rows: string[][]
}

/** Every row as JSON value strings, plus keys when writing objects. */
function prepare(view: TableView, options: JsonLinesOptions): PreparedRows {
  const kinds = options.detectTypes
    ? columnKinds(view.body, view.columnCount)
    : new Array<null>(view.columnCount).fill(null)
  const body = view.body.map((row) => rowValues(row, kinds))
  if (options.shape === "objects") {
    return { keys: columnNames(view).map((name) => JSON.stringify(name)), rows: body }
  }
  // In arrays the header is just another row of strings.
  const header = view.header ? [view.header.map((name) => JSON.stringify(name))] : []
  return { keys: null, rows: [...header, ...body] }
}

function objectText(keys: string[], values: string[], indent: string | null): string {
  if (keys.length === 0) return "{}"
  if (indent === null) return `{${keys.map((key, i) => `${key}:${values[i]}`).join(",")}}`
  const inner = keys.map((key, i) => `${indent}  ${key}: ${values[i]}`).join(",\n")
  return `{\n${inner}\n${indent}}`
}

export function writeJson(view: TableView, options: JsonOptions): string {
  const { keys, rows } = prepare(view, options)
  if (rows.length === 0) return "[]"
  if (options.minify) {
    const items = rows.map((values) => (keys ? objectText(keys, values, null) : `[${values.join(",")}]`))
    return `[${items.join(",")}]`
  }
  const items = rows.map((values) =>
    keys ? `  ${objectText(keys, values, "  ")}` : `  [${values.join(", ")}]`
  )
  return `[\n${items.join(",\n")}\n]`
}

export function writeJsonLines(view: TableView, options: JsonLinesOptions): string {
  const { keys, rows } = prepare(view, options)
  return rows
    .map((values) => (keys ? objectText(keys, values, null) : `[${values.join(",")}]`))
    .join("\n")
}
