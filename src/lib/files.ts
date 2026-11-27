import { assertInputSize, type InputFormat } from "@/core"

export const ACCEPTED_FILES = ".csv,.tsv,.txt,.json,.jsonl,.ndjson,.md,.markdown,.html,.htm"

const SPREADSHEET_FILE = /\.(xlsx|xlsm|xlsb|xls|ods|numbers)$/i

export class FileOpenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "FileOpenError"
  }
}

export function formatForFile(name: string): InputFormat | "auto" {
  const extension = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase()
  switch (extension) {
    case "csv":
    case "tsv":
      return "delimited"
    case "json":
      return "json"
    case "jsonl":
    case "ndjson":
      return "jsonl"
    case "md":
    case "markdown":
      return "markdown"
    case "html":
    case "htm":
      return "html"
    default:
      return "auto"
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
  if (SPREADSHEET_FILE.test(file.name)) {
    throw new FileOpenError(
      "tableflip can't open spreadsheet files. Select the cells in your spreadsheet, copy them, and paste them here."
    )
  }
  assertInputSize(file.size)
  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    // Folders and files that were moved or deleted after being chosen.
    throw new FileOpenError("This file couldn't be read.")
  }
  const text = decodeText(bytes)
  if (text.includes("\u0000")) {
    throw new FileOpenError("This doesn't look like a text file.")
  }
  return text.replace(/^\uFEFF/, "")
}
