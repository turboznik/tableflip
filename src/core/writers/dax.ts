import { columnNames, type TableView } from "../table"
import { columnKinds, type ColumnKind } from "../values"

export interface DaxOptions {
  tableName: string
  /** Uses INTEGER, DOUBLE and BOOLEAN columns where every value fits. */
  detectTypes: boolean
}

type DaxType = "INTEGER" | "DOUBLE" | "BOOLEAN" | "STRING"

const INT64_MAX = 9223372036854775807n

function fitsInt64(value: string): boolean {
  const n = BigInt(value.trim())
  return n <= INT64_MAX && n >= -INT64_MAX - 1n
}

function daxType(kind: ColumnKind, values: string[]): DaxType {
  switch (kind) {
    case "integer":
      return values.every((value) => value.trim() === "" || fitsInt64(value)) ? "INTEGER" : "STRING"
    case "decimal":
      return "DOUBLE"
    case "boolean":
      return "BOOLEAN"
    default:
      // DATATABLE has no syntax for exponents like 1e5, so those stay text.
      return "STRING"
  }
}

function daxString(text: string): string {
  return `"${text.replace(/"/g, '""')}"`
}

function daxValue(value: string, type: DaxType): string {
  const trimmed = value.trim()
  if (trimmed === "") return "BLANK()"
  if (type === "INTEGER" || type === "DOUBLE") return trimmed
  if (type === "BOOLEAN") return trimmed.toUpperCase()
  return daxString(value)
}

/** A Power BI calculated table using DATATABLE. */
export function writeDax(view: TableView, options: DaxOptions): string {
  const names = columnNames(view)
  const types: DaxType[] = options.detectTypes
    ? columnKinds(view.body, view.columnCount).map((kind, i) =>
        daxType(kind, view.body.map((row) => row[i]))
      )
    : names.map(() => "STRING")

  const name = options.tableName.replace(/[\r\n]+/g, " ").trim() || "Table"
  const columns = names.map((column, i) => `    ${daxString(column)}, ${types[i]},`)
  const rows = view.body.map(
    (row) => `        {${row.map((cell, i) => daxValue(cell, types[i])).join(", ")}}`
  )
  const data = rows.length > 0 ? ["    {", rows.join(",\n"), "    }"] : ["    {}"]
  return [`${name} = DATATABLE(`, ...columns, ...data, ")"].join("\n")
}
