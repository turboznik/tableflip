import type { TableView } from "../table"

/**
 * A Typst string literal. Strings render as plain text, so markup
 * characters like * and # need no escaping.
 */
function typstString(text: string): string {
  let out = '"'
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (char === "\\") out += "\\\\"
    else if (char === '"') out += '\\"'
    else if (char === "\n") out += "\\n"
    else if (char === "\r") out += "\\r"
    else if (char === "\t") out += "\\t"
    else if (code < 0x20 || code === 0x7f) out += `\\u{${code.toString(16)}}`
    else out += char
  }
  return `${out}"`
}

/** A Typst #table call, one row per line. */
export function writeTypst(view: TableView): string {
  const lines = ["#table(", `  columns: ${Math.max(1, view.columnCount)},`]
  if (view.header) {
    lines.push(`  table.header(${view.header.map(typstString).join(", ")}),`)
  }
  for (const row of view.body) lines.push(`  ${row.map(typstString).join(", ")},`)
  lines.push(")")
  return lines.join("\n")
}
