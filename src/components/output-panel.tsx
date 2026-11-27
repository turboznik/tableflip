import { DownloadIcon } from "lucide-react"
import { useMemo } from "react"

import { CopyButton } from "@/components/copy-button"
import { ErrorMessage } from "@/components/message"
import { OutputOptionsBar } from "@/components/output-options"
import { Panel, PanelHeader } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  excelClipboard,
  formatBytes,
  OUTPUT_FORMATS,
  utf8ByteLength,
  writeHtmlDocument,
  writeRichHtml,
  writeTable,
  type OutputFormat,
  type OutputOptions,
  type TableView,
} from "@/core"
import { downloadText } from "@/lib/download"
import { cn } from "@/lib/utils"

/** Longer output is cut off on screen; Copy and Download still use all of it. */
const MAX_DISPLAY_CHARS = 400_000

interface OutputPanelProps {
  view: TableView | null
  format: OutputFormat
  options: OutputOptions
  onFormatChange: (format: OutputFormat) => void
  setOptions: <F extends OutputFormat>(format: F, patch: Partial<OutputOptions[F]>) => void
  /** The input changed and is still being read. */
  stale: boolean
  className?: string
}

type Output = { text: string; error: null } | { text: null; error: string }

export function OutputPanel({ view, format, options, onFormatChange, setOptions, stale, className }: OutputPanelProps) {
  // Only this format's options matter, so changing another format's settings doesn't rewrite the output.
  const formatOptions = options[format]
  const output = useMemo<Output | null>(() => {
    if (!view) return null
    try {
      return { text: writeTable(view, format, formatOptions), error: null }
    } catch (error) {
      return { text: null, error: error instanceof Error ? error.message : String(error) }
    }
  }, [view, format, formatOptions])

  const info = OUTPUT_FORMATS.find((item) => item.id === format)!
  const text = output?.text ?? null
  const shown = text !== null && text.length > MAX_DISPLAY_CHARS ? text.slice(0, MAX_DISPLAY_CHARS) : text
  const stats = useMemo(() => {
    if (text === null) return null
    let lines = text === "" ? 0 : 1
    for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) lines++
    return { lines, bytes: utf8ByteLength(text) }
  }, [text])

  const download = () => {
    if (!view || text === null || !info.extension) return
    const content = format === "html" ? writeHtmlDocument(view, options.html) : text
    downloadText(content, `table.${info.extension}`, info.mimeType, format === "csv")
  }

  const ready = view !== null && text !== null

  return (
    <Panel aria-label="Output" className={className}>
      <Tabs value={format} onValueChange={(value) => onFormatChange(value as OutputFormat)} className="gap-0">
        <PanelHeader className="flex-nowrap overflow-x-auto px-2 [scrollbar-width:none] max-lg:mask-r-from-[calc(100%-2rem)]">
          <TabsList variant="line" aria-label="Output format" className="h-7">
            {OUTPUT_FORMATS.map((item) => (
              <TabsTrigger key={item.id} value={item.id} className="px-2">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </PanelHeader>
      </Tabs>

      <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b px-3 py-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <OutputOptionsBar format={format} options={options} setOptions={setOptions} />
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {format === "excel" && (
            <CopyButton
              label="Copy for Excel"
              variant="default"
              disabled={!ready}
              getPayload={() => excelClipboard(view!, options.excel)}
            />
          )}
          {format === "html" && (
            <>
              <CopyButton
                label="Copy table"
                variant="default"
                disabled={!ready}
                getPayload={() => ({ text: writeTable(view!, "excel", options.excel), html: writeRichHtml(view!) })}
              />
              <CopyButton label="Copy code" disabled={!ready} getPayload={() => ({ text: text! })} />
            </>
          )}
          {format !== "excel" && format !== "html" && (
            <CopyButton label="Copy" variant="default" disabled={!ready} getPayload={() => ({ text: text! })} />
          )}
          {info.extension && (
            <Button variant="outline" disabled={!ready} onClick={download}>
              <DownloadIcon data-icon="inline-start" />
              Download
            </Button>
          )}
        </div>
      </div>

      <div className={cn("relative flex min-h-64 flex-1 flex-col transition-opacity", stale && "opacity-60 delay-300")}>
        {output?.error && (
          <ErrorMessage className="m-3" title="Couldn't write this format.">
            {output.error}
          </ErrorMessage>
        )}
        {!view && (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted-foreground">
            The converted table appears here.
          </div>
        )}
        {shown !== null && (
          <textarea
            readOnly
            value={shown}
            wrap="off"
            spellCheck={false}
            aria-label={`${info.label} output`}
            className="min-h-64 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset"
          />
        )}
      </div>

      {stats && (
        <div className="flex shrink-0 items-center gap-3 border-t px-3 py-1.5 text-[11px] text-muted-foreground tabular-nums">
          <span>
            {stats.lines.toLocaleString("en-US")} {stats.lines === 1 ? "line" : "lines"} · {formatBytes(stats.bytes)}
          </span>
          {format === "excel" && <span>Paste into Excel with Ctrl+V after copying.</span>}
          {text !== null && shown !== text && (
            <span className="text-amber-600 dark:text-amber-400">
              Showing the start only. Copy and Download include everything.
            </span>
          )}
        </div>
      )}
    </Panel>
  )
}
