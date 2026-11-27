import { assertCellCount } from "../limits"
import { makeTable, TableReadError, type ParsedTable } from "../table"

const DELIMITER_CELL = /^\s*:?-+:?\s*$/
const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/

/**
 * Splits a table row on unescaped pipes, as GitHub does (even in code spans).
 * Backslash escapes like \| and \* become the character they escape.
 */
export function splitMarkdownRow(line: string): string[] {
  let text = line.trim()
  if (text.startsWith("|")) text = text.slice(1)

  const cells: string[] = []
  let current = ""
  let endsWithPipe = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    endsWithPipe = false
    if (char === "\\" && ASCII_PUNCTUATION.test(text[i + 1] ?? "")) {
      current += text[++i]
    } else if (char === "|") {
      cells.push(current)
      current = ""
      endsWithPipe = true
    } else {
      current += char
    }
  }
  // A pipe at the end closes the row rather than starting another cell.
  if (!endsWithPipe) cells.push(current)
  return cells.map((cell) => cell.trim().replace(/<br\s*\/?>/gi, "\n"))
}

function isDelimiterRow(line: string): boolean {
  if (!line.includes("-")) return false
  const cells = splitMarkdownRow(line)
  return cells.length > 0 && cells.every((cell) => DELIMITER_CELL.test(cell))
}

function isTableLine(line: string): boolean {
  return line.includes("|") && line.trim() !== ""
}

/** Reads the first Markdown pipe table in the text. */
export function readMarkdown(text: string): ParsedTable {
  const lines = text.split(/\r?\n/)
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].includes("|") || !isTableLine(lines[i - 1])) continue
    if (!isDelimiterRow(lines[i])) continue

    let end = i + 1
    while (end < lines.length && isTableLine(lines[end])) end++

    const header = splitMarkdownRow(lines[i - 1])
    assertCellCount(end - i, header.length)
    const rows = [header]
    for (let j = i + 1; j < end; j++) {
      rows.push(splitMarkdownRow(lines[j]).slice(0, header.length))
    }
    return makeTable(rows, true)
  }
  throw new TableReadError(
    "No Markdown table found. A table needs a header row, then a row like | --- | --- |."
  )
}
