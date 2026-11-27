import { assertCellCount } from "../limits"
import { looksLikeHeader, makeTable, TableReadError, type ParsedTable } from "../table"
import { JsonSyntaxError, parseOrderedJson, RawNumber, type JsonValue } from "./json-parse"

export function parseJson(text: string): JsonValue {
  const source = text.replace(/^\uFEFF/, "")
  try {
    return parseOrderedJson(source)
  } catch (error) {
    if (!(error instanceof JsonSyntaxError)) throw error
    // The browser's own message says where the problem is, in words people may have seen before.
    try {
      JSON.parse(source)
    } catch (nativeError) {
      throw new TableReadError(`This isn't valid JSON. ${jsonErrorDetail(nativeError)}`)
    }
    // Valid, but more than this reader takes, like nesting deeper than any table.
    throw new TableReadError(error.message)
  }
}

function jsonErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/^JSON\.parse: /, "")
    .replace(/^\w/, (c) => c.toUpperCase())
    .replace(/([^.!?])$/, "$1.")
}

function isObject(value: JsonValue | undefined): value is Map<string, JsonValue> {
  return value instanceof Map
}

/** Turns a JSON value into the text shown in a cell. */
function cellText(value: JsonValue | undefined): string {
  if (value === null || value === undefined) return ""
  if (value instanceof RawNumber) return value.source
  if (typeof value === "string") return value
  if (typeof value === "boolean") return String(value)
  return stringify(value)
}

/** Nested values as compact JSON, with numbers exactly as they appeared in the input. */
function stringify(value: JsonValue): string {
  if (value instanceof RawNumber) return value.source
  if (Array.isArray(value)) return `[${value.map(stringify).join(",")}]`
  if (isObject(value)) {
    const entries = Array.from(value, ([key, inner]) => `${JSON.stringify(key)}:${stringify(inner)}`)
    return `{${entries.join(",")}}`
  }
  return JSON.stringify(value)
}

/** Flattens nested objects into dotted keys: {a: {b: 1}} becomes {"a.b": 1}. */
function flatten(value: Map<string, JsonValue>, prefix: string, into: Map<string, string>): void {
  for (const [key, inner] of value) {
    const path = prefix ? `${prefix}.${key}` : key
    if (isObject(inner) && inner.size > 0) {
      flatten(inner, path, into)
    } else {
      into.set(path, cellText(inner))
    }
  }
}

/** Reads a list of rows: objects, arrays or plain values. */
export function tableFromItems(items: JsonValue[]): ParsedTable {
  if (items.length === 0) throw new TableReadError("There are no rows in this data.")

  if (items.every(Array.isArray)) {
    const rows = items.map((row) => row.map(cellText))
    return makeTable(rows, looksLikeHeader(rows))
  }

  if (items.some(isObject)) {
    const columns = new Map<string, number>()
    const flat: Map<string, string>[] = []
    for (const item of items) {
      const cells = new Map<string, string>()
      if (isObject(item)) flatten(item, "", cells)
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

  return makeTable([["value"], ...items.map((item) => [cellText(item)])], true)
}

/**
 * Reads JSON: a list of objects or arrays, an object of columns, an object
 * wrapping such a list, or a single object (one row).
 */
export function readJson(text: string): ParsedTable {
  const data = parseJson(text)

  if (Array.isArray(data)) return tableFromItems(data)

  if (isObject(data)) {
    // {"columns": [...], "data": [[...]]}: pandas' "split" layout.
    const columns = data.get("columns")
    const body = data.get("data")
    if (
      Array.isArray(columns) &&
      Array.isArray(body) &&
      body.every(Array.isArray) &&
      !columns.some((name) => isObject(name) || Array.isArray(name))
    ) {
      return makeTable([columns.map(cellText), ...body.map((row) => row.map(cellText))], true)
    }

    const values = [...data.values()]
    const lists = values.filter(Array.isArray)
    const rowLists = lists.filter((list) => list.some((item) => isObject(item) || Array.isArray(item)))

    // {"data": [...], "errors": []}: the usual API wrapper around a list of rows.
    if (rowLists.length === 1) return tableFromItems(rowLists[0])

    // {"Tag": [...], "Range": [...]}: one list of plain values per column.
    if (values.length > 0 && lists.length === values.length && rowLists.length === 0) {
      const height = lists.reduce((most, list) => Math.max(most, list.length), 0)
      assertCellCount(height + 1, values.length)
      const header = [...data.keys()]
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
