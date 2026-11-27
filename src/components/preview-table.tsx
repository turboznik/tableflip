import { memo } from "react"

import { formatCount, type ParsedTable } from "@/core"
import { cn } from "@/lib/utils"

const MAX_ROWS = 100
const MAX_COLUMNS = 40

interface PreviewTableProps {
  table: ParsedTable
  hasHeader: boolean
}

/** A read-only look at the first rows, so people can check the data was read right. */
export const PreviewTable = memo(function PreviewTable({ table, hasHeader }: PreviewTableProps) {
  const header = hasHeader ? table.rows[0] : null
  const body = hasHeader ? table.rows.slice(1, MAX_ROWS + 1) : table.rows.slice(0, MAX_ROWS)
  const totalBody = table.rows.length - (hasHeader ? 1 : 0)
  const columns = Math.min(table.columnCount, MAX_COLUMNS)
  const hiddenRows = totalBody - body.length
  const hiddenColumns = table.columnCount - columns

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 font-mono text-[11px] leading-5 tabular-nums">
          {header && (
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 z-10 w-px border-r border-b bg-muted px-2 text-right font-normal text-muted-foreground/60" />
                {header.slice(0, columns).map((cell, i) => (
                  <th
                    key={i}
                    className="max-w-60 truncate border-r border-b bg-muted px-2 text-left font-semibold"
                    title={cell}
                  >
                    {cell || <span className="text-muted-foreground/50">(blank)</span>}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {body.map((row, r) => (
              <tr key={r} className="hover:bg-muted/40">
                <td className="sticky left-0 w-px border-r border-b bg-card px-2 text-right text-muted-foreground/60 select-none">
                  {r + 1}
                </td>
                {row.slice(0, columns).map((cell, c) => (
                  <td
                    key={c}
                    className={cn("max-w-60 truncate border-r border-b px-2 whitespace-pre", !cell && "bg-muted/20")}
                    title={cell.length > 30 || cell.includes("\n") ? cell : undefined}
                  >
                    {cell.replace(/\r?\n/g, " ↵ ")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(hiddenRows > 0 || hiddenColumns > 0) && (
        <p className="shrink-0 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          Preview shows{" "}
          {[
            hiddenRows > 0 && `the first ${formatCount(body.length)} of ${formatCount(totalBody)} rows`,
            hiddenColumns > 0 && `the first ${formatCount(columns)} of ${formatCount(table.columnCount)} columns`,
          ]
            .filter(Boolean)
            .join(" and ")}
          . The output includes everything.
        </p>
      )}
    </div>
  )
})
