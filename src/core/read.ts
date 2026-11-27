import { assertTextSize } from "./limits"
import { readDelimited, type Delimiter } from "./readers/delimited"
import { readHtml } from "./readers/html"
import { readJson } from "./readers/json"
import { readJsonLines } from "./readers/jsonl"
import { readMarkdown } from "./readers/markdown"
import { TableReadError, type ParsedTable } from "./table"

export type InputFormat = "delimited" | "html" | "json" | "jsonl" | "markdown"

export const INPUT_FORMATS: { id: InputFormat; label: string }[] = [
  { id: "delimited", label: "CSV / TSV" },
  { id: "html", label: "HTML" },
  { id: "json", label: "JSON" },
  { id: "jsonl", label: "JSON Lines" },
  { id: "markdown", label: "Markdown" },
]

/** What's known about where the text came from, used instead of guessing. */
export interface ReadHint {
  /** From a file's extension. */
  format?: InputFormat
  /** For spreadsheet pastes and .tsv files. */
  delimiter?: Delimiter
  /** Text that Excel or Google Sheets put on the clipboard. */
  spreadsheet?: boolean
  /** Whether the source marked the first row as headers, like an HTML table's <th> cells. */
  header?: boolean
}

export interface ReadResult {
  table: ParsedTable
  format: InputFormat
  /** Set for delimited text: the separator that was used. */
  delimiter?: Delimiter
}

const MARKDOWN_DELIMITER_ROW = /^[ \t]*\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/gm
const HTML_TABLE = /<table[\s>]/i
const HTML_DOCUMENT = /^<(?:!doctype|html|head|body)[\s>]/i

function parsesAsJson(text: string): boolean {
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

/** Guesses the input format from the text itself. */
export function detectFormat(text: string): InputFormat {
  const trimmed = text.trim()
  const start = trimmed[0]

  if (start === "{" || start === "[") {
    // JSON Lines: the first line is a complete value and more lines follow.
    const lineEnd = trimmed.indexOf("\n")
    if (lineEnd !== -1 && parsesAsJson(trimmed.slice(0, lineEnd).trim())) {
      return "jsonl"
    }
    return "json"
  }

  // A page without a table is still HTML, so it gets HTML's "no table" message.
  if (start === "<" && (HTML_TABLE.test(trimmed) || HTML_DOCUMENT.test(trimmed))) return "html"

  // Lines of dashes without a "|" are headings or rules, not a table's delimiter row.
  for (const match of trimmed.matchAll(MARKDOWN_DELIMITER_ROW)) {
    if (match[0].includes("|")) return "markdown"
  }

  if (HTML_TABLE.test(trimmed) && /<\/t[dh]>/i.test(trimmed)) return "html"

  return "delimited"
}

/**
 * Reads input text as a table. Throws TooMuchDataError or TableReadError
 * with a message meant for people.
 */
export function readTable(text: string, format: InputFormat | "auto", hint: ReadHint = {}): ReadResult {
  assertTextSize(text)
  const result = readAs(text, format === "auto" ? (hint.format ?? detectFormat(text)) : format, hint)
  if (result.table.rows.length === 0 || result.table.columnCount === 0) {
    throw new TableReadError("This table is empty.")
  }
  return result
}

function readAs(text: string, used: InputFormat, hint: ReadHint): ReadResult {
  switch (used) {
    case "delimited": {
      const { delimiter, ...table } = readDelimited(text, hint)
      if (hint.header !== undefined) table.headerSuggested = hint.header
      return { table, format: used, delimiter }
    }
    case "html":
      return { table: readHtml(text), format: used }
    case "json":
      return { table: readJson(text), format: used }
    case "jsonl":
      return { table: readJsonLines(text), format: used }
    case "markdown":
      return { table: readMarkdown(text), format: used }
  }
}
