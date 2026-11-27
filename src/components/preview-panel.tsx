import { memo, useId } from "react"

import { Panel, PanelHeader, PanelTitle } from "@/components/panel"
import { PreviewTable } from "@/components/preview-table"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { formatCount, type ParsedTable } from "@/core"
import { cn } from "@/lib/utils"

interface PreviewPanelProps {
  table: ParsedTable | null
  hasHeader: boolean
  onHeaderChange: (hasHeader: boolean) => void
  stale: boolean
  className?: string
}

export const PreviewPanel = memo(function PreviewPanel({
  table,
  hasHeader,
  onHeaderChange,
  stale,
  className,
}: PreviewPanelProps) {
  const id = useId()
  const rows = table ? table.rows.length - (hasHeader ? 1 : 0) : 0

  return (
    <Panel aria-label="Preview" className={className}>
      <PanelHeader>
        <PanelTitle>Preview</PanelTitle>
        {table && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {formatCount(rows)} {rows === 1 ? "row" : "rows"} × {formatCount(table.columnCount)}{" "}
            {table.columnCount === 1 ? "column" : "columns"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <Switch
            id={id}
            size="sm"
            checked={table !== null && hasHeader}
            disabled={table === null || table.rows.length === 0}
            onCheckedChange={onHeaderChange}
          />
          <Label htmlFor={id} className="text-xs font-normal">
            First row is headers
          </Label>
        </div>
      </PanelHeader>
      {table ? (
        <div
          className={cn("flex min-h-0 flex-1 flex-col transition-opacity", stale && "opacity-60 delay-300")}
        >
          <PreviewTable table={table} hasHeader={hasHeader} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
          The table you paste or open shows up here.
        </div>
      )}
    </Panel>
  )
})
