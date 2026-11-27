import type { TableView } from "./table"
import { writeAscii, type AsciiOptions } from "./writers/ascii"
import { writeDax, type DaxOptions } from "./writers/dax"
import { writeCsv, type CsvOptions } from "./writers/delimited"
import { writeExcelText, type ExcelOptions } from "./writers/excel"
import { writeHtml, type HtmlOptions } from "./writers/html"
import { writeJson, writeJsonLines, type JsonLinesOptions, type JsonOptions } from "./writers/json"
import { writeMarkdown, type MarkdownOptions } from "./writers/markdown"
import { writePandas, type PandasOptions } from "./writers/pandas"
import { writeTypst } from "./writers/typst"

export interface OutputOptions {
  excel: ExcelOptions
  csv: CsvOptions
  html: HtmlOptions
  markdown: MarkdownOptions
  json: JsonOptions
  jsonl: JsonLinesOptions
  ascii: AsciiOptions
  dax: DaxOptions
  pandas: PandasOptions
  typst: Record<string, never>
}

export type OutputFormat = keyof OutputOptions

export interface OutputFormatInfo {
  id: OutputFormat
  label: string
  /** File extension for downloads, or null when the format is copy-only. */
  extension: string | null
  mimeType: string
}

export const OUTPUT_FORMATS: OutputFormatInfo[] = [
  { id: "excel", label: "Excel", extension: null, mimeType: "text/tab-separated-values" },
  { id: "csv", label: "CSV", extension: "csv", mimeType: "text/csv" },
  { id: "html", label: "HTML", extension: "html", mimeType: "text/html" },
  { id: "markdown", label: "Markdown", extension: "md", mimeType: "text/markdown" },
  { id: "json", label: "JSON", extension: "json", mimeType: "application/json" },
  { id: "jsonl", label: "JSON Lines", extension: "jsonl", mimeType: "application/jsonl" },
  { id: "ascii", label: "ASCII", extension: "txt", mimeType: "text/plain" },
  { id: "dax", label: "DAX", extension: "dax", mimeType: "text/plain" },
  { id: "pandas", label: "Pandas", extension: "py", mimeType: "text/x-python" },
  { id: "typst", label: "Typst", extension: "typ", mimeType: "text/plain" },
]

export const DEFAULT_OPTIONS: OutputOptions = {
  excel: { keepText: true },
  csv: { delimiter: "," },
  html: { inlineStyles: false },
  markdown: { align: true },
  json: { shape: "objects", detectTypes: true, minify: false },
  jsonl: { shape: "objects", detectTypes: true },
  ascii: { style: "classic" },
  dax: { tableName: "Table", detectTypes: true },
  pandas: { variable: "df", detectTypes: true },
  typst: {},
}

const WRITERS: {
  [F in OutputFormat]: (view: TableView, options: OutputOptions[F]) => string
} = {
  excel: (view) => writeExcelText(view),
  csv: writeCsv,
  html: writeHtml,
  markdown: writeMarkdown,
  json: writeJson,
  jsonl: writeJsonLines,
  ascii: writeAscii,
  dax: writeDax,
  pandas: writePandas,
  typst: (view) => writeTypst(view),
}

/** Writes the table in one format, with that format's options. */
export function writeTable<F extends OutputFormat>(
  view: TableView,
  format: F,
  options: OutputOptions[F]
): string {
  const write = WRITERS[format] as (
    view: TableView,
    options: OutputOptions[F]
  ) => string
  return write(view, options)
}
