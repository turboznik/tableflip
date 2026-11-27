// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { MAX_INPUT_BYTES, TooMuchDataError } from "./limits"
import { choosePaste } from "./paste"
import { detectFormat, readTable } from "./read"

describe("detectFormat", () => {
  it.each([
    ['[{"a":1}]', "json"],
    ['  {\n  "a": [1, 2]\n}', "json"],
    ['[\n  {"a": 1}\n]', "json"],
    ['{"a":1}\n{"a":2}', "jsonl"],
    ["[1,2]\n[3,4]", "jsonl"],
    ["<table><tr><td>x</td></tr></table>", "html"],
    ['<meta charset="utf-8"><table><tr><td>x</td></tr></table>', "html"],
    ["Copied text <table><tr><td>x</td></tr></table>", "html"],
    ["| a | b |\n|---|---|\n| 1 | 2 |", "markdown"],
    ["a | b\n:-- | --:\n1 | 2", "markdown"],
    ["a,b\n1,2", "delimited"],
    ["a\tb\n1\t2", "delimited"],
    ["Title\n---\nmore", "delimited"],
    ["Instruments\n-----------\n\n| a | b |\n|---|---|\n| 1 | 2 |", "markdown"],
    ["<!doctype html><p>No table here</p>", "html"],
    ["", "delimited"],
  ])("%j is %s", (text, format) => {
    expect(detectFormat(text)).toBe(format)
  })
})

describe("readTable", () => {
  it("uses the format it detects", () => {
    expect(readTable("a,b\n1,2", "auto")).toMatchObject({
      format: "delimited",
      delimiter: ",",
    })
    expect(readTable('[{"a":1}]', "auto").format).toBe("json")
  })

  it("says when a table has no values", () => {
    expect(() => readTable(",,,\n,,,", "auto")).toThrow("This table is empty.")
    expect(() => readTable("{}", "auto")).toThrow("This table is empty.")
  })

  it("follows what the source says over guessing", () => {
    const column = "Description\nValve, feed water\nPump, boiler feed\nDrum level"
    expect(readTable(column, "auto").table.columnCount).toBe(2)
    const known = readTable(column, "auto", { format: "delimited", delimiter: "\t" })
    expect(known.table.columnCount).toBe(1)
    expect(readTable("[1]\t{2}", "auto", { format: "delimited" }).format).toBe("delimited")
    expect(readTable("2024\t2025\n1\t2", "auto", { header: true }).table.headerSuggested).toBe(true)
  })

  it("says when HTML has no table", () => {
    expect(() => readTable("<!doctype html><p>No table here</p>", "auto")).toThrow("No table found in this HTML.")
  })

  it("uses the format it's told", () => {
    expect(readTable('[{"a":1}]', "delimited").table.rows[0]).toEqual([
      '[{"a":1}]',
    ])
  })

  it("refuses text over the size limit", () => {
    const text = "x".repeat(MAX_INPUT_BYTES + 1)
    expect(() => readTable(text, "auto")).toThrow(TooMuchDataError)
    expect(() => readTable(text, "auto")).toThrow(
      "tableflip accepts up to 5 MB of text. This is 5.1 MB."
    )
  })

  it("counts bytes, not characters, near the limit", () => {
    // 2 million characters, but 6 million bytes in UTF-8.
    const text = "€".repeat(2_000_000)
    expect(() => readTable(text, "auto")).toThrow("This is 5.8 MB.")
  })
})

describe("choosePaste", () => {
  it("turns a web or Word table into tab-separated text", () => {
    const html = "<table><tr><th>Tag</th><th>Notes</th></tr><tr><td>FT-101</td><td>a<br>b</td></tr></table>"
    expect(choosePaste(html, "Tag Notes FT-101 a b")).toEqual({
      text: 'Tag\tNotes\nFT-101\t"a\nb"',
      hint: { format: "delimited", delimiter: "\t", header: true },
      fromRichTable: true,
    })
  })

  it("keeps the header a web table marks", () => {
    const html = "<table><tr><th></th><th>2024</th></tr><tr><td>FT-101</td><td>5</td></tr></table>"
    expect(choosePaste(html, "").hint.header).toBe(true)
  })

  it("uses Excel's own plain text, read as tab-separated", () => {
    const html =
      '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td>a</td></tr></table></body></html>'
    expect(choosePaste(html, "a\tb\r\n")).toEqual({
      text: "a\tb\r\n",
      hint: { format: "delimited", delimiter: "\t", spreadsheet: true },
      fromRichTable: false,
    })
  })

  it("recognizes Excel's HTML after a browser has cleaned it up", () => {
    const html =
      '<html><head><meta name="ProgId" content="Excel.Sheet"></head><body><table><tr><td>a</td></tr></table></body></html>'
    expect(choosePaste(html, "a\tb").hint.spreadsheet).toBe(true)
  })

  it("uses Google Sheets' plain text", () => {
    const html = "<google-sheets-html-origin><table><tr><td>a</td></tr></table>"
    expect(choosePaste(html, "a").hint.spreadsheet).toBe(true)
  })

  it("refuses a rich table with too many cells", () => {
    const html = `<table>${`<tr>${"<td>x</td>".repeat(400)}</tr>`.repeat(300)}</table>`
    expect(() => choosePaste(html, "x")).toThrow(TooMuchDataError)
  })

  it("uses plain text when there's no table", () => {
    expect(choosePaste("<b>bold</b>", "bold")).toEqual({ text: "bold", hint: {}, fromRichTable: false })
    expect(choosePaste("", "a,b")).toEqual({ text: "a,b", hint: {}, fromRichTable: false })
  })
})
