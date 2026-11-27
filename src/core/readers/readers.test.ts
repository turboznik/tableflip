import { describe, expect, it } from "vitest"

import { MAX_CELLS, TooMuchDataError } from "../limits"
import { TableReadError } from "../table"
import { readDelimited } from "./delimited"
import { readJson } from "./json"
import { readJsonLines } from "./jsonl"
import { readMarkdown, splitMarkdownRow } from "./markdown"

describe("readDelimited", () => {
  it("reads what Excel puts on the clipboard", () => {
    const text = 'Tag\tRange\tNotes\r\nFT-101\t0-100\t"line one\r\nline two"\r\nPT-102\t007\t"6"" pipe"\r\n'
    const table = readDelimited(text)
    expect(table.delimiter).toBe("\t")
    expect(table.rows).toEqual([
      ["Tag", "Range", "Notes"],
      ["FT-101", "0-100", "line one\r\nline two"],
      ["PT-102", "007", '6" pipe'],
    ])
    expect(table.headerSuggested).toBe(true)
  })

  it("detects commas, semicolons and pipes", () => {
    expect(readDelimited("a,b\n1,2").delimiter).toBe(",")
    expect(readDelimited("a;b\n1;2").delimiter).toBe(";")
    expect(readDelimited("a|b\n1|2").delimiter).toBe("|")
  })

  it("strips a byte order mark", () => {
    const bom = String.fromCharCode(0xfeff)
    expect(readDelimited(`${bom}Name,Value\nx,1`).rows[0]).toEqual(["Name", "Value"])
  })

  it("pads ragged rows and drops trailing empty rows", () => {
    const table = readDelimited("a,b,c\n1\n2,3\n\n\n")
    expect(table.columnCount).toBe(3)
    expect(table.rows).toEqual([
      ["a", "b", "c"],
      ["1", "", ""],
      ["2", "3", ""],
    ])
  })

  it("keeps blank rows in the middle", () => {
    expect(readDelimited("a\tb\n\t\nc\td").rows).toEqual([
      ["a", "b"],
      ["", ""],
      ["c", "d"],
    ])
  })

  it("doesn't suggest a header when the first row has numbers", () => {
    expect(readDelimited("1,2\n3,4").headerSuggested).toBe(false)
    expect(readDelimited("Name,2024\nx,1").headerSuggested).toBe(false)
  })

  it("reads a single column", () => {
    const table = readDelimited("one\ntwo\nthree")
    expect(table.columnCount).toBe(1)
    expect(table.rows).toHaveLength(3)
  })

  it("refuses too many cells and reports the size", () => {
    const row = new Array(20).fill("x").join(",")
    const text = new Array(5001).fill(row).join("\n")
    expect(() => readDelimited(text)).toThrow(TooMuchDataError)
    expect(() => readDelimited(text)).toThrow(
      "tableflip handles up to 100,000 cells. This table has 100,020 (5,001 rows × 20 columns)."
    )
  })

  it("accepts exactly the cell limit", () => {
    const row = new Array(20).fill("x").join(",")
    const text = new Array(MAX_CELLS / 20).fill(row).join("\n")
    expect(readDelimited(text).rows).toHaveLength(5000)
  })
})

describe("readJson", () => {
  it("reads a list of objects, joining keys in order", () => {
    const table = readJson('[{"Tag":"FT-101","Range":10},{"Tag":"PT-102","Units":"psi"}]')
    expect(table.rows).toEqual([
      ["Tag", "Range", "Units"],
      ["FT-101", "10", ""],
      ["PT-102", "", "psi"],
    ])
    expect(table.headerSuggested).toBe(true)
  })

  it("keeps numbers exactly as written", () => {
    const table = readJson('[{"a":1.50,"b":12345678901234567890,"c":1e3}]')
    expect(table.rows[1]).toEqual(["1.50", "12345678901234567890", "1e3"])
  })

  it("flattens nested objects and writes arrays as JSON", () => {
    const table = readJson('[{"id":1,"loc":{"area":"A1","rack":{"n":2}},"tags":[1.0,"x"],"none":null,"ok":true}]')
    expect(table.rows).toEqual([
      ["id", "loc.area", "loc.rack.n", "tags", "none", "ok"],
      ["1", "A1", "2", '[1.0,"x"]', "", "true"],
    ])
  })

  it("reads a list of arrays", () => {
    const table = readJson('[["Tag","Range"],["FT-101",5]]')
    expect(table.rows).toEqual([
      ["Tag", "Range"],
      ["FT-101", "5"],
    ])
    expect(table.headerSuggested).toBe(true)
  })

  it("reads a list of plain values as one column", () => {
    expect(readJson('["a","b",3]').rows).toEqual([["value"], ["a"], ["b"], ["3"]])
  })

  it("reads an object wrapping a list", () => {
    const table = readJson('{"count":2,"data":[{"a":1},{"a":2}]}')
    expect(table.rows).toEqual([["a"], ["1"], ["2"]])
  })

  it("reads an object of columns", () => {
    const table = readJson('{"Tag":["FT-101","PT-102"],"Range":[1,2,3]}')
    expect(table.rows).toEqual([
      ["Tag", "Range"],
      ["FT-101", "1"],
      ["PT-102", "2"],
      ["", "3"],
    ])
  })

  it("reads a single object as one row", () => {
    expect(readJson('{"a":1,"b":"x"}').rows).toEqual([
      ["a", "b"],
      ["1", "x"],
    ])
  })

  it("explains invalid JSON", () => {
    expect(() => readJson("[1, 2,")).toThrow(TableReadError)
    expect(() => readJson("[1, 2,")).toThrow(/^This isn't valid JSON\./)
  })

  it("rejects a single value and empty lists", () => {
    expect(() => readJson("42")).toThrow("This JSON is a single value, not a table.")
    expect(() => readJson("[]")).toThrow("There are no rows in this data.")
  })

  it("refuses too many cells before building rows", () => {
    const items = Array.from({ length: 10_001 }, (_, i) => ({ a: i, b: i, c: i, d: i, e: i, f: i, g: i, h: i, i: i, j: i }))
    expect(() => readJson(JSON.stringify(items))).toThrow(TooMuchDataError)
  })
})

describe("readJsonLines", () => {
  it("reads one object per line and skips blank lines", () => {
    const table = readJsonLines('{"a":1}\n\n{"a":2,"b":"x"}\r\n')
    expect(table.rows).toEqual([
      ["a", "b"],
      ["1", ""],
      ["2", "x"],
    ])
  })

  it("names the line with invalid JSON", () => {
    expect(() => readJsonLines('{"a":1}\n{"a":')).toThrow(/^Line 2: This isn't valid JSON\./)
  })
})

describe("readMarkdown", () => {
  it("reads a pipe table and unescapes it", () => {
    const table = readMarkdown(
      [
        "Some text first.",
        "",
        "| Tag | Notes |",
        "| :--- | ---: |",
        "| FT-101 | a \\| b |",
        "| PT-102 | line<br>two |",
        "",
        "After the table.",
      ].join("\n")
    )
    expect(table.rows).toEqual([
      ["Tag", "Notes"],
      ["FT-101", "a | b"],
      ["PT-102", "line\ntwo"],
    ])
    expect(table.headerSuggested).toBe(true)
  })

  it("reads tables without outer pipes", () => {
    expect(readMarkdown("a | b\n--|--\n1 | 2").rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ])
  })

  it("drops cells beyond the header and pads short rows", () => {
    expect(readMarkdown("|a|b|\n|-|-|\n|1|2|3|\n|4|").rows).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["4", ""],
    ])
  })

  it("ignores horizontal rules", () => {
    expect(() => readMarkdown("Title\n---\ntext")).toThrow(TableReadError)
  })

  it("splits on pipes inside code spans, like GitHub", () => {
    expect(splitMarkdownRow("| `a|b` | c |")).toEqual(["`a", "b`", "c"])
    expect(splitMarkdownRow("| `a\\|b` | c |")).toEqual(["`a|b`", "c"])
  })
})
