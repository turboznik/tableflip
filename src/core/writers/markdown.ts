import { columnNames, type TableView } from "../table"
import { padEnd, textWidth } from "../text-width"

export interface MarkdownOptions {
  /** Pads cells so the columns line up in plain text. */
  align: boolean
}

function escapeCell(text: string): string {
  return text
    .replace(/\|/g, "\\|")
    .replace(/\r\n|\r|\n/g, "<br>")
    .replace(/\t/g, " ")
}

/** A GitHub-flavored Markdown table. Tables without a header get "Column N". */
export function writeMarkdown(view: TableView, options: MarkdownOptions): string {
  const header = (view.header ?? columnNames(view)).map(escapeCell)
  const body = view.body.map((row) => row.map(escapeCell))

  if (!options.align) {
    const line = (cells: string[]) => `| ${cells.join(" | ")} |`
    return [line(header), line(header.map(() => "---")), ...body.map(line)].join("\n")
  }

  const widths = header.map((cell) => Math.max(3, textWidth(cell)))
  for (const row of body) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i], textWidth(cell))
    })
  }
  const line = (cells: string[]) => `| ${cells.map((cell, i) => padEnd(cell, widths[i])).join(" | ")} |`
  const rule = `| ${widths.map((width) => "-".repeat(width)).join(" | ")} |`
  return [line(header), rule, ...body.map(line)].join("\n")
}
