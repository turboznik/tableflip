/** What a whole column holds, for formats that care about types. */
export type ColumnKind = "integer" | "decimal" | "number" | "boolean" | "string"

const INTEGER = /^-?(?:0|[1-9]\d*)$/
const DECIMAL = /^-?(?:0|[1-9]\d*)\.\d+$/
const EXPONENT = /^-?(?:0|[1-9]\d*)(?:\.\d+)?[eE][+-]?\d+$/
const BOOLEAN = /^(?:true|false)$/i

/**
 * Looks at every non-empty value in a column. A column only becomes numeric
 * or boolean when all its values are, so "007" or "1-2" keep a column as text.
 */
export function columnKinds(rows: string[][], columnCount: number): ColumnKind[] {
  const kinds: ColumnKind[] = []
  for (let c = 0; c < columnCount; c++) {
    let integer = true
    let decimal = true
    let number = true
    let boolean = true
    let filled = false
    for (const row of rows) {
      const value = row[c].trim()
      if (value === "") continue
      filled = true
      const isInteger = INTEGER.test(value)
      const isDecimal = isInteger || DECIMAL.test(value)
      integer &&= isInteger
      decimal &&= isDecimal
      number &&= isDecimal || EXPONENT.test(value)
      boolean &&= BOOLEAN.test(value)
      if (!number && !boolean) break
    }
    if (!filled) kinds.push("string")
    else if (integer) kinds.push("integer")
    else if (decimal) kinds.push("decimal")
    else if (number) kinds.push("number")
    else if (boolean) kinds.push("boolean")
    else kinds.push("string")
  }
  return kinds
}

export function isNumericKind(kind: ColumnKind): boolean {
  return kind === "integer" || kind === "decimal" || kind === "number"
}
