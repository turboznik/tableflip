import { DownloadIcon } from "lucide-react"
import { memo, useDeferredValue, useMemo } from "react"
import { toast } from "sonner"

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
  type ClipboardPayload,
  type OutputFormat,
  type OutputOptions,
  type TableView,
} from "@/core"
import { downloadText } from "@/lib/download"
import { shortcut } from "@/lib/platform"
import { cn } from "@/lib/utils"

/**
 * Longer output is cut off on screen, because laying out a huge textarea is
 * slow. Copy and Download still use all of it.
 */
const MAX_DISPLAY_CHARS = 100_000
/** Outputs up to this length are kept, so switching back to a tab is instant. */
const MAX_CACHED_CHARS = 2_000_000

interface OutputPanelProps {
  /** The table on screen. */
  view: TableView | null
  /** The newest table, read right away if the input changed since `view`. Throws if it can't be read. */
  getView: () => TableView | null
  format: OutputFormat
  options: OutputOptions
  onFormatChange: (format: OutputFormat) => void
  setOptions: <F extends OutputFormat>(format: F, patch: Partial<OutputOptions[F]>) => void
  /** The input changed and is still being read. */
  stale: boolean
  className?: string
}

type Output = { text: string; error: null } | { text: null; error: string }

const outputCache = new WeakMap<TableView, Map<OutputFormat, { options: unknown; output: Output }>>()

function write<F extends OutputFormat>(view: TableView, format: F, options: OutputOptions[F]): Output {
  let cached = outputCache.get(view)
  const hit = cached?.get(format)
  if (hit && hit.options === options) return hit.output

  let output: Output
  try {
    output = { text: writeTable(view, format, options), error: null }
  } catch (error) {
    output = { text: null, error: error instanceof Error ? error.message : String(error) }
  }
  if ((output.text?.length ?? 0) <= MAX_CACHED_CHARS) {
    if (!cached) outputCache.set(view, (cached = new Map()))
    cached.set(format, { options, output })
  }
  return output
}

export const OutputPanel = memo(function OutputPanel({
  view,
  getView,
  format,
  options,
  onFormatChange,
  setOptions,
  stale,
  className,
}: OutputPanelProps) {
  // Deferred, so typing a table name stays quick with big tables. Only this format's options
  // matter, so changing another format's settings doesn't rewrite the output.
  const shownOptions = useDeferredValue(options)
  const formatOptions = shownOptions[format]
  const output = useMemo(
    () => (view ? write(view, format, formatOptions) : null),
    [view, format, formatOptions]
  )
  const behind = stale || formatOptions !== options[format]

  const info = OUTPUT_FORMATS.find((item) => item.id === format)!
  const text = output?.text ?? null
  const shown = text !== null && text.length > MAX_DISPLAY_CHARS ? text.slice(0, MAX_DISPLAY_CHARS) : text
  const stats = useMemo(() => {
    if (text === null) return null
    let lines = text === "" ? 0 : 1
    for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) lines++
    return { lines, bytes: utf8ByteLength(text) }
  }, [text])

  // Copy and Download use the newest table and options, even if the screen is a moment behind.
  const latest = (build: (view: TableView) => ClipboardPayload) => () => {
    const fresh = getView()
    if (!fresh) throw new Error("There's no table to copy.")
    return build(fresh)
  }
  const latestText = (fresh: TableView) => {
    const result = write(fresh, format, options[format])
    if (result.error !== null) throw new Error(result.error)
    return result.text
  }

  const tabs = format === "csv" && options.csv.delimiter === "\t"
  const download = () => {
    if (!info.extension) return
    try {
      const fresh = getView()
      if (!fresh) return
      const content = format === "html" ? writeHtmlDocument(fresh, options.html) : latestText(fresh)
      // Excel only splits a .csv file at commas (or the system's list separator).
      const [extension, mimeType] = tabs
        ? ["tsv", "text/tab-separated-values"]
        : [info.extension, info.mimeType]
      downloadText(content, `table.${extension}`, mimeType, format === "csv")
    } catch (error) {
      toast.error("Couldn't download", {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const ready = view !== null && text !== null

  return (
    <Panel aria-label="Output" className={className}>
      <Tabs value={format} onValueChange={(value) => onFormatChange(value as OutputFormat)} className="gap-0">
        <PanelHeader className="[scrollbar-width:none] flex-nowrap overflow-x-auto px-2 max-xl:mask-r-from-[calc(100%-2rem)]">
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
              getPayload={latest((fresh) => excelClipboard(fresh, options.excel))}
            />
          )}
          {format === "html" && (
            <>
              <CopyButton
                label="Copy table"
                variant="default"
                disabled={!ready}
                getPayload={latest((fresh) => ({
                  text: writeTable(fresh, "excel", options.excel),
                  html: writeRichHtml(fresh),
                }))}
              />
              <CopyButton
                label="Copy code"
                disabled={!ready}
                getPayload={latest((fresh) => ({ text: latestText(fresh) }))}
              />
            </>
          )}
          {format !== "excel" && format !== "html" && (
            // Keyed so a "Copied" from one format doesn't show on the next.
            <CopyButton
              key={format}
              label="Copy"
              variant="default"
              disabled={!ready}
              getPayload={latest((fresh) => ({ text: latestText(fresh) }))}
            />
          )}
          {info.extension && (
            <Button variant="outline" disabled={!ready} onClick={download}>
              <DownloadIcon data-icon="inline-start" />
              Download
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "relative flex min-h-64 flex-1 flex-col transition-opacity",
          behind && "opacity-60 delay-300"
        )}
      >
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
            onCopy={(event) => {
              // Selecting all of a shortened output copies all of it, not just what's shown.
              const field = event.currentTarget
              if (text === null || shown === text) return
              if (field.selectionStart !== 0 || field.selectionEnd !== field.value.length) return
              event.preventDefault()
              event.clipboardData.setData("text/plain", text)
            }}
            className={cn(
              "min-h-64 flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset",
              // Box-drawing lines only join up at the font's own line height.
              format === "ascii" && "leading-[1.3]"
            )}
          />
        )}
      </div>

      {stats && (
        <div className="flex shrink-0 items-center gap-3 border-t px-3 py-1.5 text-[11px] text-muted-foreground tabular-nums">
          <span>
            {stats.lines.toLocaleString("en-US")} {stats.lines === 1 ? "line" : "lines"} ·{" "}
            {formatBytes(stats.bytes)}
          </span>
          {format === "excel" && <span>Paste into Excel with {shortcut("V")} after copying.</span>}
          {text !== null && shown !== text && (
            <span className="text-amber-600 dark:text-amber-400">
              Showing the start only. Copy and Download include everything.
            </span>
          )}
        </div>
      )}
    </Panel>
  )
})
