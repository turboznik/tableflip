import { ClipboardPasteIcon, FileUpIcon, LoaderCircleIcon, XIcon } from "lucide-react"
import { useRef } from "react"

import { ErrorMessage } from "@/components/message"
import { Panel, PanelHeader, PanelTitle } from "@/components/panel"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatBytes, INPUT_FORMATS, type InputFormat, type ReadResult } from "@/core"
import { ACCEPTED_FILES } from "@/lib/files"
import { isMac } from "@/lib/platform"

export interface InputProblem {
  title?: string
  message: string
}

interface InputPanelProps {
  text: string
  format: InputFormat | "auto"
  /** What the current text was read as, once reading has caught up. */
  result: ReadResult | null
  readError: InputProblem | null
  /** A problem with the last paste, drop or file, shown until dismissed. */
  actionError: InputProblem | null
  note: string | null
  pending: boolean
  bytes: number
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onTextChange: (text: string) => void
  onFormatChange: (format: InputFormat | "auto") => void
  onOpenFiles: (files: FileList) => void
  onExample: () => void
  onClear: () => void
  onDismissActionError: () => void
}

const FORMAT_ITEMS = [{ value: "auto", label: "Auto-detect" }, ...INPUT_FORMATS.map((f) => ({ value: f.id, label: f.label }))]

const DELIMITER_NAMES: Record<string, string> = {
  ",": "comma-separated",
  "\t": "tab-separated",
  ";": "semicolon-separated",
  "|": "pipe-separated",
}

export function InputPanel({
  text,
  format,
  result,
  readError,
  actionError,
  note,
  pending,
  bytes,
  textareaRef,
  onTextChange,
  onFormatChange,
  onOpenFiles,
  onExample,
  onClear,
  onDismissActionError,
}: InputPanelProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const empty = text === ""
  const formatLabel = result && INPUT_FORMATS.find((f) => f.id === result.format)?.label

  return (
    <Panel aria-label="Input" className="min-h-72 xl:min-h-0">
      <PanelHeader>
        <PanelTitle>Input</PanelTitle>
        <Select
          items={FORMAT_ITEMS}
          value={format}
          onValueChange={(value) => value && onFormatChange(value as InputFormat | "auto")}
        >
          <SelectTrigger size="sm" aria-label="Read input as" className="min-w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FORMAT_ITEMS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPTED_FILES}
            className="hidden"
            tabIndex={-1}
            onChange={(event) => {
              if (event.target.files?.length) onOpenFiles(event.target.files)
              // Let the same file be chosen again.
              event.target.value = ""
            }}
          />
          <Button variant="ghost" size="sm" onClick={() => fileInput.current?.click()}>
            <FileUpIcon data-icon="inline-start" />
            Open file
          </Button>
          <Button variant="ghost" size="sm" onClick={onExample}>
            Example
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={empty} aria-label="Clear input">
            <XIcon data-icon="inline-start" />
            Clear
          </Button>
        </div>
      </PanelHeader>

      {actionError && (
        <ErrorMessage className="mx-3 mt-3" title={actionError.title} onDismiss={onDismissActionError}>
          {actionError.message}
        </ErrorMessage>
      )}

      <div className="relative flex min-h-40 flex-1 flex-col xl:min-h-16">
        <textarea
          ref={textareaRef}
          // Not controlled by React: rewriting megabytes of text on every keystroke made typing lag.
          // App sets the value directly when it replaces the input.
          onChange={(event) => onTextChange(event.target.value)}
          wrap="off"
          spellCheck={false}
          autoComplete="off"
          aria-label="Table to convert"
          className="flex-1 resize-none bg-transparent p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset"
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <ClipboardPasteIcon className="size-6 text-muted-foreground/60" aria-hidden />
            <div className="space-y-1">
              <p className="text-sm font-medium pointer-coarse:hidden">
                Paste a table with <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd> <Kbd>V</Kbd>
              </p>
              <p className="hidden text-sm font-medium pointer-coarse:block">Tap here and paste a table</p>
              <p className="max-w-80 text-xs text-pretty text-muted-foreground">
                From Excel, Google Sheets, Word or a web page, or as CSV, JSON, Markdown or HTML. You can also drop a
                file here.
              </p>
            </div>
            <Button variant="outline" size="sm" className="pointer-events-auto" onClick={onExample}>
              Try an example
            </Button>
          </div>
        )}
      </div>

      {readError && (
        <ErrorMessage className="mx-3 mb-3" title={readError.title}>
          {readError.message}
        </ErrorMessage>
      )}

      {!empty && (
        <div className="flex shrink-0 items-center gap-1.5 border-t px-3 py-1.5 text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
          {formatLabel && (
            <span>
              {format === "auto" ? "Detected " : "Read as "}
              <span className="font-medium text-foreground">{formatLabel}</span>
              {result?.delimiter && result.table.columnCount > 1 && `, ${DELIMITER_NAMES[result.delimiter]}`}
            </span>
          )}
          {note && <span className="min-w-0 truncate">{formatLabel && "· "}{note}</span>}
          {pending && (
            <span className="appear-delayed" role="status" aria-label="Reading">
              <LoaderCircleIcon className="size-3 animate-spin" aria-hidden />
            </span>
          )}
          <span className="ml-auto pl-2">{formatBytes(bytes)}</span>
        </div>
      )}
    </Panel>
  )
}
