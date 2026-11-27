import type { TableView } from "../table"
import { padEnd, padStart, textWidth } from "../text-width"
import { columnKinds, isNumericKind } from "../values"

export interface AsciiOptions {
  style: "classic" | "box"
}

interface Border {
  top: [string, string, string]
  middle: [string, string, string]
  bottom: [string, string, string]
  horizontal: string
  vertical: string
}

const BORDERS: Record<AsciiOptions["style"], Border> = {
  classic: {
    top: ["+", "+", "+"],
    middle: ["+", "+", "+"],
    bottom: ["+", "+", "+"],
    horizontal: "-",
    vertical: "|",
  },
  box: {
    top: ["┌", "┬", "┐"],
    middle: ["├", "┼", "┤"],
    bottom: ["└", "┴", "┘"],
    horizontal: "─",
    vertical: "│",
  },
}

function cellLines(text: string): string[] {
  return text.replace(/\t/g, " ").split(/\r\n|\r|\n/)
}

/** A plain-text table. Numeric columns are right-aligned. */
export function writeAscii(view: TableView, options: AsciiOptions): string {
  if (view.columnCount === 0) return ""
  const border = BORDERS[options.style]
  const numeric = columnKinds(view.body, view.columnCount).map(isNumericKind)

  const rows = [...(view.header ? [view.header] : []), ...view.body].map((row) =>
    row.map(cellLines)
  )
  const widths = new Array<number>(view.columnCount).fill(1)
  for (const row of rows) {
    row.forEach((lines, i) => {
      for (const line of lines) widths[i] = Math.max(widths[i], textWidth(line))
    })
  }

  const rule = ([left, join, right]: [string, string, string]) =>
    left + widths.map((width) => border.horizontal.repeat(width + 2)).join(join) + right

  const renderRow = (row: string[][], isHeader: boolean) => {
    const height = Math.max(...row.map((lines) => lines.length))
    const out: string[] = []
    for (let l = 0; l < height; l++) {
      const cells = row.map((lines, i) => {
        const text = lines[l] ?? ""
        return numeric[i] && !isHeader ? padStart(text, widths[i]) : padEnd(text, widths[i])
      })
      out.push(`${border.vertical} ${cells.join(` ${border.vertical} `)} ${border.vertical}`)
    }
    return out
  }

  const lines = [rule(border.top)]
  rows.forEach((row, index) => {
    const isHeader = view.header !== null && index === 0
    lines.push(...renderRow(row, isHeader))
    if (isHeader && rows.length > 1) lines.push(rule(border.middle))
  })
  lines.push(rule(border.bottom))
  return lines.join("\n")
}
