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
    ["", "delimited"],
  ])("%j is %s", (text, format) => {
    expect(detectFormat(text)).toBe(format)
  })
})

describe("readTable", () => {
  it("uses the format it detects", () => {
    expect(readTable("a,b\n1,2", "auto")).toMatchObject({ format: "delimited", delimiter: "," })
    expect(readTable('[{"a":1}]', "auto").format).toBe("json")
  })

  it("uses the format it's told", () => {
    expect(readTable('[{"a":1}]', "delimited").table.rows[0]).toEqual(['[{"a":1}]'])
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
      format: "delimited",
      fromRichTable: true,
    })
  })

  it("uses Excel's own plain text", () => {
    const html =
      '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><table><tr><td>a</td></tr></table></body></html>'
    expect(choosePaste(html, "a\tb\r\n")).toEqual({ text: "a\tb\r\n", format: "auto", fromRichTable: false })
  })

  it("uses Google Sheets' plain text", () => {
    const html = '<google-sheets-html-origin><table><tr><td>a</td></tr></table>'
    expect(choosePaste(html, "a").fromRichTable).toBe(false)
  })

  it("uses plain text when there's no table", () => {
    expect(choosePaste("<b>bold</b>", "bold")).toEqual({ text: "bold", format: "auto", fromRichTable: false })
    expect(choosePaste("", "a,b")).toEqual({ text: "a,b", format: "auto", fromRichTable: false })
  })
})
