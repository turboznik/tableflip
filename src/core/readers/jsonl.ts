import { TableReadError, type ParsedTable } from "../table"
import { parseJson, tableFromItems } from "./json"
import type { JsonValue } from "./json-parse"

/** Reads JSON Lines (NDJSON): one JSON value per line. */
export function readJsonLines(text: string): ParsedTable {
  const items: JsonValue[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === "") continue
    try {
      items.push(parseJson(line))
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new TableReadError(`Line ${i + 1}: ${detail}`)
    }
  }
  return tableFromItems(items)
}
