// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { TooMuchDataError } from "../limits"
import { makeTable, TableReadError, toView } from "../table"
import { writeRichHtml } from "../writers/html"
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

  it("keeps rowspan=0 in its section and stays within the cell limit", () => {
    const table = readHtml(
      "<table><thead><tr><th rowspan=0>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>"
    )
    expect(table.rows).toEqual([
      ["A", "B"],
      ["1", "2"],
    ])

    const started = performance.now()
    expect(() => readHtml(`<table>${"<tr><td rowspan=0>x</td></tr>".repeat(3000)}</table>`)).toThrow(
      TooMuchDataError
    )
    expect(() => readHtml(`<table>${"<tr><td rowspan=1000>x</td></tr>".repeat(3000)}</table>`)).toThrow(
      TooMuchDataError
    )
    expect(performance.now() - started).toBeLessThan(3000)
  })

  it("reads Word lists, preformatted text and kept spaces, and skips hidden text", () => {
    const table = readHtml(`<table><tr>
      <td><p style="mso-list:l0 level1 lfo1"><span style="font-family:Symbol;mso-list:Ignore">·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span>Open valve</p>
        <p style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">2.<span>&nbsp;&nbsp;</span></span>Check flow</p></td>
      <td><pre>a   b\n  c</pre></td>
      <td><span style="mso-spacerun:yes">  </span>TT-1<span style="mso-spacerun:yes">  </span>x</td>
      <td><span style="display:none">0042</span>42<span hidden>!</span></td>
      <td><span>FT-101 </span> <span>spare</span><svg><title>icon</title></svg></td>
    </tr></table>`)
    expect(table.rows).toEqual([
      ["• Open valve\n2. Check flow", "a   b\n  c", "  TT-1  x", "42", "FT-101 spare"],
    ])
  })

  it("reads back tableflip's own rich copy exactly", () => {
    const cells = ["  TT-1", "a  b", "c ", "line 1\nline 2"]
    const view = toView(makeTable([cells, cells], false), false)
    expect(readHtml(writeRichHtml(view)).rows).toEqual([cells, cells])
  })
})
