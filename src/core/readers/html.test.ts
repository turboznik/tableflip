// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { TooMuchDataError } from "../limits"
import { TableReadError } from "../table"
import { readHtml } from "./html"

describe("readHtml", () => {
  it("reads a table with a header", () => {
    const table = readHtml(`
      <table>
        <thead><tr><th>Tag</th><th>Range</th></tr></thead>
        <tbody>
          <tr><td>FT-101</td><td>0 &ndash; 100</td></tr>
          <tr><td> PT-102 </td><td>
            5
          </td></tr>
        </tbody>
      </table>`)
    expect(table.rows).toEqual([
      ["Tag", "Range"],
      ["FT-101", "0 – 100"],
      ["PT-102", "5"],
    ])
    expect(table.headerSuggested).toBe(true)
  })

  it("keeps line breaks from <br> and paragraphs", () => {
    const table = readHtml(
      "<table><tr><td>one<br>two</td><td><p>a</p><p>b</p></td><td><ul><li>x</li><li>y</li></ul></td></tr></table>"
    )
    expect(table.rows[0]).toEqual(["one\ntwo", "a\nb", "x\ny"])
  })

  it("puts merged cells in the first slot", () => {
    const table = readHtml(`
      <table>
        <tr><td rowspan="2">A</td><td colspan="2">B</td></tr>
        <tr><td>C</td><td>D</td></tr>
        <tr><td>E</td><td>F</td><td>G</td></tr>
      </table>`)
    expect(table.rows).toEqual([
      ["A", "B", ""],
      ["", "C", "D"],
      ["E", "F", "G"],
    ])
  })

  it("picks the biggest table and ignores nested tables' rows", () => {
    const table = readHtml(`
      <table><tr><td>layout</td></tr></table>
      <table>
        <tr><td>a</td><td>b</td></tr>
        <tr><td>c</td><td><table><tr><td>inner</td></tr></table></td></tr>
      </table>`)
    expect(table.rows).toEqual([
      ["a", "b"],
      ["c", "inner"],
    ])
  })

  it("ignores scripts and styles inside cells", () => {
    const table = readHtml("<table><tr><td>x<script>alert(1)</script><style>td{}</style></td></tr></table>")
    expect(table.rows).toEqual([["x"]])
  })

  it("turns non-breaking spaces into spaces", () => {
    const nbsp = String.fromCharCode(0xa0)
    expect(readHtml(`<table><tr><td>a${nbsp}b</td></tr></table>`).rows).toEqual([["a b"]])
  })

  it("explains when there's no table", () => {
    expect(() => readHtml("<p>No table here</p>")).toThrow(TableReadError)
    expect(() => readHtml("<p>No table here</p>")).toThrow("No table found in this HTML.")
  })

  it("caps huge spans and refuses tables over the limit", () => {
    expect(() => readHtml(`<table>${'<tr><td colspan="99999">x</td></tr>'.repeat(200)}</table>`)).toThrow(
      TooMuchDataError
    )
  })
})
