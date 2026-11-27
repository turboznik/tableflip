import { assertInputSize, assertTextSize, MAX_INPUT_BYTES, type ReadHint } from "@/core"

export const ACCEPTED_FILES = ".csv,.tsv,.txt,.json,.jsonl,.ndjson,.md,.markdown,.html,.htm"

const PICTURE_REFUSAL = "tableflip can't read tables in pictures."

/** Files people try that tableflip can't read, and what to say about them. */
const REFUSED_FILES: [RegExp, string][] = [
  [
    /\.(xlsx|xlsm|xlsb|xls|ods|numbers)$/i,
    "tableflip can't open spreadsheet files. Select the cells in your spreadsheet, copy them, and paste them here.",
  ],
  [
    /\.(docx|docm|doc|odt|rtf|pages)$/i,
    "tableflip can't open documents. Select the table in your document, copy it, and paste it here.",
  ],
  [/\.pdf$/i, "tableflip can't open PDF files."],
  [/\.(png|jpe?g|gif|bmp|webp|heic|heif|tiff?|svg)$/i, PICTURE_REFUSAL],
]

export class FileOpenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FileOpenError"
  }
}

/** What a file's extension says about its contents. */
export function hintForFile(name: string): ReadHint {
  const extension = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase()
  switch (extension) {
    case "csv":
      return { format: "delimited" }
    case "tsv":
      return { format: "delimited", delimiter: "\t" }
    case "json":
      return { format: "json" }
    case "jsonl":
    case "ndjson":
      return { format: "jsonl" }
    case "md":
    case "markdown":
      return { format: "markdown" }
    case "html":
    case "htm":
      return { format: "html" }
    default:
      return {}
  }
}

/**
 * Decodes a text file. UTF-8 and UTF-16 (what Excel's "Unicode Text" saves)
 * are recognized; anything else is read as Windows-1252, the usual encoding
 * of CSV files saved by older versions of Excel.
 */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes)
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder("windows-1252").decode(bytes)
  }
}

/** Reads a dropped or chosen file as text, refusing files tableflip can't use. */
export async function readTextFile(file: File): Promise<string> {
  // Pasted screenshots are files too.
  const refusal = file.type.startsWith("image/")
    ? PICTURE_REFUSAL
    : REFUSED_FILES.find(([pattern]) => pattern.test(file.name))?.[1]
  if (refusal) throw new FileOpenError(refusal)
  // UTF-16 files take two bytes per character, so the text is measured after decoding.
  if (file.size > MAX_INPUT_BYTES * 2) assertInputSize(file.size)
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    // Folders and files that were moved or deleted after being chosen.
    throw new FileOpenError("This file couldn't be read.")
  }
  const text = decodeText(bytes).replace(/^\uFEFF/, "")
  if (text.includes("\u0000")) {
    throw new FileOpenError("This doesn't look like a text file.")
  }
  if (text.trim() === "") throw new FileOpenError("This file is empty.")
  assertTextSize(text)
  return text
}
