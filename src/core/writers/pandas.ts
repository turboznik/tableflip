import { columnNames, type TableView } from "../table"
import { columnKinds, isNumericKind, type ColumnKind } from "../values"

export interface PandasOptions {
  variable: string
  /** Writes numbers and True/False as Python values instead of strings. */
  detectTypes: boolean
}

const PYTHON_KEYWORDS = new Set([
  "False", "None", "True", "and", "as", "assert", "async", "await", "break",
  "class", "continue", "def", "del", "elif", "else", "except", "finally", "for",
  "from", "global", "if", "import", "in", "is", "lambda", "nonlocal", "not", "or",
  "pass", "raise", "return", "try", "while", "with", "yield",
])

function variableName(name: string): string {
  const trimmed = name.trim()
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed) && !PYTHON_KEYWORDS.has(trimmed)
    ? trimmed
    : "df"
}

/** JSON string syntax is also a valid Python string literal. */
function pythonString(text: string): string {
  return JSON.stringify(text)
}

function pythonValue(value: string, kind: ColumnKind | null): string {
  if (kind && kind !== "string") {
    const trimmed = value.trim()
    if (trimmed === "") return "None"
    if (isNumericKind(kind)) return trimmed
    if (kind === "boolean") return trimmed.toLowerCase() === "true" ? "True" : "False"
  }
  return pythonString(value)
}

/** Python code that builds the table as a pandas DataFrame. */
export function writePandas(view: TableView, options: PandasOptions): string {
  const kinds = options.detectTypes
    ? columnKinds(view.body, view.columnCount)
    : new Array<null>(view.columnCount).fill(null)
  const variable = variableName(options.variable)
  const lines = ["import pandas as pd", ""]

  if (view.header) {
    lines.push(`${variable} = pd.DataFrame({`)
    columnNames(view).forEach((name, i) => {
      const values = view.body.map((row) => pythonValue(row[i], kinds[i]))
      lines.push(`    ${pythonString(name)}: [${values.join(", ")}],`)
    })
    lines.push("})")
  } else {
    lines.push(`${variable} = pd.DataFrame([`)
    for (const row of view.body) {
      lines.push(`    [${row.map((cell, i) => pythonValue(cell, kinds[i])).join(", ")}],`)
    }
    lines.push("])")
  }
  return lines.join("\n")
}
