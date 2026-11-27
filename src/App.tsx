import { FileDownIcon, MoonIcon, SunIcon } from "lucide-react"
import { useCallback, useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from "react"

import { InputPanel, type InputProblem } from "@/components/input-panel"
import { OutputPanel } from "@/components/output-panel"
import { PreviewPanel } from "@/components/preview-panel"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  assertTextSize,
  choosePaste,
  readTable,
  TableReadError,
  toView,
  TooMuchDataError,
  utf8ByteLength,
  type InputFormat,
  type OutputFormat,
  type OutputOptions,
  type ReadResult,
} from "@/core"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { EXAMPLE_TABLE } from "@/lib/example"
import { FileOpenError, formatForFile, readTextFile } from "@/lib/files"
import { loadSettings, saveSettings } from "@/lib/settings"

interface InputState {
  text: string
  format: InputFormat | "auto"
  /** Goes up each time the whole input is replaced, so choices about the old table don't carry over. */
  revision: number
  /** Typing into large text waits for a pause before reading; everything else reads right away. */
  typed: boolean
  note: string | null
}

type ReadOutcome = { result: ReadResult; error: null } | { result: null; error: InputProblem } | null

const DEBOUNCE_ABOVE_CHARS = 50_000
const DEBOUNCE_MS = 250

function describe(error: unknown): InputProblem {
  if (error instanceof TooMuchDataError) return { title: error.title, message: error.message }
  if (error instanceof TableReadError || error instanceof FileOpenError) return { message: error.message }
  return { title: "Something went wrong.", message: error instanceof Error ? error.message : String(error) }
}

function read(text: string, format: InputFormat | "auto"): ReadOutcome {
  if (text.trim() === "") return null
  try {
    return { result: readTable(text, format), error: null }
  } catch (error) {
    return { result: null, error: describe(error) }
  }
}

/** Other fields (like the DAX table name) keep normal paste behavior. */
function isOtherField(target: EventTarget | null, main: HTMLElement | null): boolean {
  if (!(target instanceof HTMLElement) || target === main) return false
  if (target.isContentEditable) return true
  return (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) && !target.readOnly
}

export function App() {
  const [input, setInput] = useState<InputState>({ text: "", format: "auto", revision: 0, typed: false, note: null })
  const [actionError, setActionError] = useState<InputProblem | null>(null)
  const [headerOverride, setHeaderOverride] = useState<{ revision: number; value: boolean } | null>(null)
  const [settings, setSettings] = useState(loadSettings)
  const [dragging, setDragging] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  /** Counts input changes, so a slow file read can't overwrite something newer. */
  const latestAction = useRef(0)

  useEffect(() => saveSettings(settings), [settings])

  // Reading happens in a deferred render, so typing stays responsive with big tables.
  const debounced = useDebouncedValue(
    input,
    input.typed && input.text.length > DEBOUNCE_ABOVE_CHARS ? DEBOUNCE_MS : 0
  )
  const current = useDeferredValue(debounced)
  const pending = current !== input
  const outcome = useMemo(() => read(current.text, current.format), [current.text, current.format])
  const bytes = useMemo(() => utf8ByteLength(current.text), [current.text])

  const table = outcome?.result?.table ?? null
  const hasHeader =
    table !== null &&
    (headerOverride?.revision === current.revision ? headerOverride.value : table.headerSuggested)
  const view = useMemo(() => (table ? toView(table, hasHeader) : null), [table, hasHeader])

  const replaceInput = (text: string, format: InputFormat | "auto", note: string | null = null) => {
    latestAction.current++
    setActionError(null)
    const textarea = textareaRef.current
    if (textarea) {
      textarea.value = text
      textarea.setSelectionRange(0, 0)
      textarea.scrollTo(0, 0)
    }
    setInput((prev) => ({ text, format, revision: prev.revision + 1, typed: false, note }))
  }

  const showActionError = (error: unknown) => {
    latestAction.current++
    setActionError(describe(error))
  }

  const openFiles = async (files: FileList) => {
    const file = files[0]
    const action = ++latestAction.current
    try {
      const text = await readTextFile(file)
      if (action !== latestAction.current) return
      replaceInput(text, formatForFile(file.name), files.length > 1 ? `Opened ${file.name} only` : `Opened ${file.name}`)
    } catch (error) {
      if (action === latestAction.current) showActionError(error)
    }
  }

  const takeText = (html: string, plain: string) => {
    try {
      const pasted = choosePaste(html, plain)
      assertTextSize(pasted.text)
      replaceInput(pasted.text, pasted.format, pasted.fromRichTable ? "Converted from a copied table" : null)
    } catch (error) {
      showActionError(error)
    }
  }

  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    const data = event.clipboardData
    const textarea = textareaRef.current
    if (!data || isOtherField(event.target, textarea)) return

    const plain = data.getData("text/plain")
    // Pasting into part of the input edits it as normal text.
    if (event.target === textarea && textarea && textarea.value !== "") {
      const { selectionStart: start, selectionEnd: end, value } = textarea
      if (start !== 0 || end !== value.length) {
        try {
          assertTextSize(value.slice(0, start) + plain + value.slice(end))
        } catch (error) {
          event.preventDefault()
          showActionError(error)
        }
        return
      }
    }

    event.preventDefault()
    const html = data.getData("text/html")
    // Spreadsheet apps can add a picture of the cells; only use files when there's no text.
    if (plain === "" && html === "") {
      if (data.files.length > 0) void openFiles(data.files)
      return
    }
    takeText(html, plain)
  })

  const onDrop = useEffectEvent((data: DataTransfer) => {
    if (data.files.length > 0) void openFiles(data.files)
    else takeText(data.getData("text/html"), data.getData("text/plain"))
  })

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => onPaste(event)
    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [])

  useEffect(() => {
    // Counts enters and leaves, since dragenter on the next element fires before dragleave on the last.
    let depth = 0
    let fallback: ReturnType<typeof setTimeout> | undefined
    // Drags that start on the page (like moving selected text) keep their normal behavior.
    let internal = false
    const accepts = (event: DragEvent) =>
      !internal &&
      event.dataTransfer !== null &&
      [...event.dataTransfer.types].some((type) => type === "Files" || type === "text/plain" || type === "text/html")

    const hide = () => {
      depth = 0
      clearTimeout(fallback)
      setDragging(false)
    }
    const show = () => {
      setDragging(true)
      // Browsers fire dragover at least every 550 ms during a drag, so this only runs if a leave was missed.
      clearTimeout(fallback)
      fallback = setTimeout(hide, 1500)
    }
    const onDragStart = () => (internal = true)
    const onDragEnd = () => (internal = false)
    const onDragEnter = (event: DragEvent) => {
      if (!accepts(event)) return
      event.preventDefault()
      depth++
      show()
    }
    const onDragOver = (event: DragEvent) => {
      if (!accepts(event)) return
      event.preventDefault()
      event.dataTransfer!.dropEffect = "copy"
      show()
    }
    const onDragLeave = (event: DragEvent) => {
      if (!accepts(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) hide()
    }
    const handleDrop = (event: DragEvent) => {
      hide()
      if (!accepts(event)) return
      event.preventDefault()
      onDrop(event.dataTransfer!)
    }

    document.addEventListener("dragstart", onDragStart)
    document.addEventListener("dragend", onDragEnd)
    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", handleDrop)
    return () => {
      clearTimeout(fallback)
      document.removeEventListener("dragstart", onDragStart)
      document.removeEventListener("dragend", onDragEnd)
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", handleDrop)
    }
  }, [])

  const setHeader = useCallback(
    (value: boolean) => setHeaderOverride({ revision: input.revision, value }),
    [input.revision]
  )
  const setOutputFormat = useCallback(
    (outputFormat: OutputFormat) => setSettings((prev) => ({ ...prev, outputFormat })),
    []
  )
  const setOptions = useCallback(
    <F extends OutputFormat>(format: F, patch: Partial<OutputOptions[F]>) =>
      setSettings((prev) => ({
        ...prev,
        options: { ...prev.options, [format]: { ...prev.options[format], ...patch } },
      })),
    []
  )

  return (
    <TooltipProvider delay={300}>
      <div className="flex min-h-svh flex-col lg:h-svh lg:min-h-[40rem]">
        <header className="flex h-11 shrink-0 items-center gap-3 border-b px-4">
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="" className="size-5" />
            <h1 className="text-sm font-semibold tracking-tight">tableflip</h1>
          </div>
          <p className="hidden truncate text-xs text-muted-foreground md:block">
            Convert tables between Excel, CSV, HTML, Markdown, JSON and more. Nothing you paste leaves your browser.
          </p>
          <ThemeToggle />
        </header>

        <main className="grid flex-1 gap-3 p-3 lg:min-h-0 lg:grid-cols-2 lg:grid-rows-[minmax(0,2fr)_minmax(0,3fr)]">
          <InputPanel
            text={input.text}
            format={input.format}
            result={outcome?.result ?? null}
            readError={outcome?.error ?? null}
            actionError={actionError}
            note={current.note}
            pending={pending}
            bytes={bytes}
            textareaRef={textareaRef}
            onTextChange={(text) => {
              latestAction.current++
              setActionError(null)
              setInput((prev) => ({ ...prev, text, typed: true, note: text === "" ? null : prev.note }))
            }}
            onFormatChange={(format) => setInput((prev) => ({ ...prev, format, typed: false }))}
            onOpenFiles={(files) => void openFiles(files)}
            onExample={() => replaceInput(EXAMPLE_TABLE, "auto", "Example data")}
            onClear={() => {
              replaceInput("", "auto")
              textareaRef.current?.focus()
            }}
            onDismissActionError={() => setActionError(null)}
          />
          <PreviewPanel
            className="max-h-96 lg:col-start-1 lg:row-start-2 lg:max-h-none"
            table={table}
            hasHeader={hasHeader}
            onHeaderChange={setHeader}
            stale={pending}
          />
          <OutputPanel
            className="min-h-96 lg:col-start-2 lg:row-span-2 lg:row-start-1"
            view={view}
            stale={pending}
            format={settings.outputFormat}
            options={settings.options}
            onFormatChange={setOutputFormat}
            setOptions={setOptions}
          />
        </main>
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/40 px-12 py-10 text-center">
            <FileDownIcon className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Drop to open</p>
            <p className="text-xs text-muted-foreground">CSV, TSV, JSON, JSON Lines, Markdown, HTML or text</p>
          </div>
        </div>
      )}
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}

function ThemeToggle() {
  const { setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="ml-auto"
      aria-label="Switch between light and dark"
      onClick={() => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}

export default App
