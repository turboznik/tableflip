import { assertCellCount } from "../limits"
import { looksLikeHeader, makeTable, TableReadError, type ParsedTable } from "../table"

/** A number from the input, kept as written so "1.50" and big IDs survive. */
class RawNumber {
  readonly source: string
  constructor(source: string) {
    this.source = source
  }
}

type Reviver = (
  this: unknown,
  key: string,
  value: unknown,
  context?: { source?: string }
) => unknown

const keepNumberSource: Reviver = (_key, value, context) =>
  typeof value === "number" && context?.source !== undefined
    ? new RawNumber(context.source)
    : value

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text, keepNumberSource as Parameters<typeof JSON.parse>[1])
  } catch (error) {
    throw new TableReadError(`This isn't valid JSON. ${jsonErrorDetail(error)}`)
  }
}

function jsonErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.replace(/^JSON\.parse: /, "").replace(/^\w/, (c) => c.toUpperCase())
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof RawNumber)
  )
}

/** Turns a JSON value into the text shown in a cell. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (value instanceof RawNumber) return value.source
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return stringifyRaw(value)
}

/** JSON.stringify that writes numbers exactly as they appeared in the input. */
function stringifyRaw(value: unknown): string {
  if (value instanceof RawNumber) return value.source
  if (Array.isArray(value)) return `[${value.map(stringifyRaw).join(",")}]`
  if (isPlainObject(value)) {
    const entries = Object.entries(value).map(
      ([key, inner]) => `${JSON.stringify(key)}:${stringifyRaw(inner)}`
    )
    return `{${entries.join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

/** Flattens nested objects into dotted keys: {a: {b: 1}} becomes {"a.b": 1}. */
function flatten(
  value: Record<string, unknown>,
  prefix: string,
  into: Map<string, string>
): void {
  for (const [key, inner] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (isPlainObject(inner) && Object.keys(inner).length > 0) {
      flatten(inner, path, into)
    } else {
      into.set(path, cellText(inner))
    }
  }
}

/** Reads a list of rows: objects, arrays or plain values. */
export function tableFromItems(items: unknown[]): ParsedTable {
  if (items.length === 0) throw new TableReadError("There are no rows in this data.")

  if (items.every(Array.isArray)) {
    const rows = (items as unknown[][]).map((row) => row.map(cellText))
    return makeTable(rows, looksLikeHeader(rows))
  }

  if (items.some(isPlainObject)) {
    const columns = new Map<string, number>()
    const flat: Map<string, string>[] = []
    for (const item of items) {
      const cells = new Map<string, string>()
      if (isPlainObject(item)) flatten(item, "", cells)
      else cells.set("value", cellText(item))
      for (const key of cells.keys()) {
        if (!columns.has(key)) columns.set(key, columns.size)
      }
      flat.push(cells)
    }
    assertCellCount(items.length + 1, columns.size)
    const header = [...columns.keys()]
    const rows = [header]
    for (const cells of flat) {
      rows.push(header.map((key) => cells.get(key) ?? ""))
    }
    return makeTable(rows, true)
  }

  return makeTable(
    [["value"], ...items.map((item) => [cellText(item)])],
    true
  )
}

/**
 * Reads JSON: a list of objects or arrays, an object of columns, an object
 * wrapping such a list, or a single object (one row).
 */
export function readJson(text: string): ParsedTable {
  const data = parseJson(text)

  if (Array.isArray(data)) return tableFromItems(data)

  if (isPlainObject(data)) {
    const values = Object.values(data)
    const lists = values.filter(Array.isArray)

    // {"data": [...]}: the usual API wrapper around a list of rows.
    if (lists.length === 1 && lists[0].some((item) => isPlainObject(item) || Array.isArray(item))) {
      return tableFromItems(lists[0])
    }

    // {"Tag": [...], "Range": [...]}: one list per column.
    if (values.length > 0 && lists.length === values.length) {
      const height = Math.max(...lists.map((list) => list.length))
      assertCellCount(height + 1, values.length)
      const header = Object.keys(data)
      const rows = [header]
      for (let i = 0; i < height; i++) {
        rows.push(lists.map((list) => cellText(list[i])))
      }
      return makeTable(rows, true)
    }

    return tableFromItems([data])
  }

  throw new TableReadError("This JSON is a single value, not a table.")
}
