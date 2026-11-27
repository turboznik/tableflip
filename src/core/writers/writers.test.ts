import { describe, expect, it } from "vitest"

import { DEFAULT_OPTIONS, OUTPUT_FORMATS, writeTable } from "../formats"
import { readDelimited } from "../readers/delimited"
import { readJson } from "../readers/json"
import { readMarkdown } from "../readers/markdown"
import { columnNames, makeTable, toView, type TableView } from "../table"
import { columnKinds } from "../values"
import { writeAscii } from "./ascii"
import { writeDax } from "./dax"
import { writeCsv } from "./delimited"
import { excelClipboard, writeExcelText } from "./excel"
import { writeHtml, writeHtmlDocument, writeRichHtml } from "./html"
import { writeJson, writeJsonLines } from "./json"
import { writeMarkdown } from "./markdown"
import { writePandas } from "./pandas"
import { writeTypst } from "./typst"

function view(rows: string[][], hasHeader = true): TableView {
  return toView(makeTable(rows, hasHeader), hasHeader)
}

const instruments = view([
  ["Tag", "Range", "Enabled", "Notes"],
  ["FT-101", "0.5", "TRUE", "Flow | main"],
  ["PT-102", "10", "false", 'Says "hi"\nsecond line'],
  ["TT-103", "", "", "007"],
])

describe("columnKinds", () => {
  it("types a column only when every value fits", () => {
    expect(
      columnKinds(
        [
          ["1", "1.5", "true", "007", "1e5", "1-2", ""],
          ["-2", "2", "FALSE", "8", "2", "3", ""],
        ],
        7
      )
    ).toEqual(["integer", "decimal", "boolean", "string", "number", "string", "string"])
  })
})

describe("columnNames", () => {
  it("fills blanks and makes duplicates unique", () => {
    expect(columnNames(view([["a", "", "a", "a_2"], ["1", "2", "3", "4"]]))).toEqual([
      "a",
      "Column 2",
      "a_2",
      "a_2_2",
    ])
  })
})

describe("CSV", () => {
  it("quotes only when needed", () => {
    expect(writeCsv(instruments, { delimiter: "," })).toBe(
      [
        "Tag,Range,Enabled,Notes",
        "FT-101,0.5,TRUE,Flow | main",
        'PT-102,10,false,"Says ""hi""\nsecond line"',
        "TT-103,,,007",
      ].join("\r\n")
    )
  })

  it("round-trips through the reader with every delimiter", () => {
    for (const delimiter of [",", ";", "\t"] as const) {
      const text = writeCsv(instruments, { delimiter })
      expect(readDelimited(text).rows).toEqual([instruments.header, ...instruments.body])
    }
  })
})

describe("Excel", () => {
  it("writes tab-separated text with Excel's quoting", () => {
    expect(writeExcelText(view([["a\tb", "c"]], false))).toBe('"a\tb"\tc')
  })

  it("marks cells as text and keeps line breaks in the cell", () => {
    const { text, html } = excelClipboard(view([["1-2", "a\nb"]], false), { keepText: true })
    expect(text).toBe('1-2\t"a\nb"')
    expect(html).toContain(`<td style='mso-number-format:"\\@"'>1-2</td>`)
    expect(html).toContain('a<br style="mso-data-placement:same-cell">b')
  })

  it("marks spaces HTML would collapse", () => {
    const { html } = excelClipboard(view([[" a  b", "c "]], false), { keepText: false })
    const kept = (spaces: string) => `<span style='mso-spacerun:yes'>${spaces}</span>`
    expect(html).toContain(`<td>${kept(" ")}a${kept("  ")}b</td><td>c${kept(" ")}</td>`)
    expect(writeRichHtml(view([["a  b"]], false))).toContain(`a${kept("  ")}b`)
    expect(writeHtml(view([["a  b"]], false), { inlineStyles: false })).toContain("<td>a  b</td>")
  })

  it("leaves formatting to Excel when keep-as-text is off", () => {
    const { html } = excelClipboard(view([["007"]], false), { keepText: false })
    expect(html).toContain("<td>007</td>")
    expect(html).not.toContain("mso-number-format")
  })

  it("escapes HTML in cells", () => {
    const { html } = excelClipboard(view([["<b>&</b>"]], false), { keepText: false })
    expect(html).toContain("<td>&lt;b&gt;&amp;&lt;/b&gt;</td>")
  })
})

describe("HTML", () => {
  it("writes one row per line with a header", () => {
    expect(writeHtml(view([["A", "B"], ["<1>", "x\ny"]]), { inlineStyles: false })).toBe(
      [
        "<table>",
        "  <thead>",
        "    <tr><th>A</th><th>B</th></tr>",
        "  </thead>",
        "  <tbody>",
        "    <tr><td>&lt;1&gt;</td><td>x<br>y</td></tr>",
        "  </tbody>",
        "</table>",
      ].join("\n")
    )
  })

  it("leaves out thead without a header", () => {
    expect(writeHtml(view([["a"]], false), { inlineStyles: false })).not.toContain("thead")
  })

  it("adds inline styles for email", () => {
    const html = writeRichHtml(instruments)
    expect(html).toContain('<table style="border-collapse: collapse">')
    expect(html).toMatch(/<th style="border: 1px solid #d4d4d4;[^"]*font-weight: bold">Tag<\/th>/)
  })

  it("wraps downloads in a full page", () => {
    const page = writeHtmlDocument(instruments, { inlineStyles: false })
    expect(page.startsWith("<!doctype html>")).toBe(true)
    expect(page).toContain('<meta charset="utf-8">')
    expect(page).toContain("\n    <table>\n")
  })
})

describe("Markdown", () => {
  it("aligns columns and escapes pipes and line breaks", () => {
    expect(writeMarkdown(instruments, { align: true })).toBe(
      [
        "| Tag    | Range | Enabled | Notes                    |",
        "| ------ | ----- | ------- | ------------------------ |",
        "| FT-101 | 0.5   | TRUE    | Flow \\| main             |",
        '| PT-102 | 10    | false   | Says "hi"<br>second line |',
        "| TT-103 |       |         | 007                      |",
      ].join("\n")
    )
  })

  it("writes compact tables", () => {
    expect(writeMarkdown(view([["a", "b"], ["1", "2"]]), { align: false })).toBe(
      "| a | b |\n| --- | --- |\n| 1 | 2 |"
    )
  })

  it("names columns when there's no header", () => {
    expect(writeMarkdown(view([["1", "2"]], false), { align: false }).split("\n")[0]).toBe(
      "| Column 1 | Column 2 |"
    )
  })

  it("pads wide characters by display width", () => {
    const lines = writeMarkdown(view([["名前", "x"], ["abcd", "y"]]), { align: true }).split("\n")
    expect(lines[0]).toBe("| 名前 | x   |")
    expect(lines[2]).toBe("| abcd | y   |")
  })

  it("round-trips through the reader", () => {
    const text = writeMarkdown(instruments, { align: true })
    expect(readMarkdown(text).rows).toEqual([instruments.header, ...instruments.body])
  })
})

describe("JSON", () => {
  const options = DEFAULT_OPTIONS.json

  it("writes typed objects, keeping numbers as written", () => {
    expect(JSON.parse(writeJson(instruments, options))).toEqual([
      { Tag: "FT-101", Range: 0.5, Enabled: true, Notes: "Flow | main" },
      { Tag: "PT-102", Range: 10, Enabled: false, Notes: 'Says "hi"\nsecond line' },
      { Tag: "TT-103", Range: null, Enabled: null, Notes: "007" },
    ])
    expect(writeJson(view([["n"], ["1.50"]]), options)).toContain('"n": 1.50')
  })

  it("writes strings when type detection is off", () => {
    const rows = JSON.parse(writeJson(instruments, { ...options, detectTypes: false }))
    expect(rows[0].Range).toBe("0.5")
    expect(rows[2].Range).toBe("")
  })

  it("writes arrays, header first", () => {
    expect(JSON.parse(writeJson(instruments, { ...options, shape: "arrays" }))[0]).toEqual([
      "Tag",
      "Range",
      "Enabled",
      "Notes",
    ])
    expect(writeJson(view([["a", "b"], ["1", "2"]]), { ...options, shape: "arrays" })).toBe(
      '[\n  ["a", "b"],\n  [1, 2]\n]'
    )
  })

  it("minifies", () => {
    expect(writeJson(view([["a"], ["x"]]), { ...options, minify: true })).toBe('[{"a":"x"}]')
  })

  it("writes an empty list for a header-only table", () => {
    expect(writeJson(view([["a"]]), options)).toBe("[]")
  })

  it("round-trips through the reader", () => {
    const text = writeJson(instruments, { ...options, detectTypes: false })
    expect(readJson(text).rows).toEqual([instruments.header, ...instruments.body])
  })
})

describe("JSON Lines", () => {
  it("writes one value per line", () => {
    expect(writeJsonLines(view([["a", "b"], ["1", "x"], ["2", "y"]]), DEFAULT_OPTIONS.jsonl)).toBe(
      '{"a":1,"b":"x"}\n{"a":2,"b":"y"}'
    )
    expect(
      writeJsonLines(view([["a", "b"], ["1", "x"]]), { shape: "arrays", detectTypes: false })
    ).toBe('["a","b"]\n["1","x"]')
  })
})

describe("ASCII", () => {
  it("draws a classic table with numbers on the right", () => {
    expect(writeAscii(view([["Tag", "Range"], ["FT-101", "5"], ["PT-2", "10.5"]]), { style: "classic" })).toBe(
      [
        "+--------+-------+",
        "| Tag    | Range |",
        "+--------+-------+",
        "| FT-101 |     5 |",
        "| PT-2   |  10.5 |",
        "+--------+-------+",
      ].join("\n")
    )
  })

  it("draws box lines and splits multi-line cells", () => {
    expect(writeAscii(view([["a", "b\nc"]], false), { style: "box" })).toBe(
      ["┌───┬───┐", "│ a │ b │", "│   │ c │", "└───┴───┘"].join("\n")
    )
  })
})

describe("DAX", () => {
  it("writes a typed DATATABLE", () => {
    expect(writeDax(instruments, { tableName: "Instruments", detectTypes: true })).toBe(
      [
        "Instruments = DATATABLE(",
        '    "Tag", STRING,',
        '    "Range", DOUBLE,',
        '    "Enabled", BOOLEAN,',
        '    "Notes", STRING,',
        "    {",
        '        {"FT-101", 0.5, TRUE, "Flow | main"},',
        '        {"PT-102", 10, FALSE, "Says ""hi""\nsecond line"},',
        '        {"TT-103", BLANK(), BLANK(), "007"}',
        "    }",
        ")",
      ].join("\n")
    )
  })

  it("keeps exponents and huge integers as text", () => {
    const dax = writeDax(view([["a", "b"], ["1e5", "99999999999999999999"]]), {
      tableName: "",
      detectTypes: true,
    })
    expect(dax).toContain('"a", STRING,')
    expect(dax).toContain('"b", STRING,')
    expect(dax.startsWith("Table = DATATABLE(")).toBe(true)
  })

  it("writes empty data for a header-only table", () => {
    expect(writeDax(view([["a"]]), { tableName: "T", detectTypes: true })).toContain("    {}")
  })
})

describe("Pandas", () => {
  it("writes columns as a dict", () => {
    expect(writePandas(instruments, { variable: "instruments", detectTypes: true })).toBe(
      [
        "import pandas as pd",
        "",
        "instruments = pd.DataFrame({",
        '    "Tag": ["FT-101", "PT-102", "TT-103"],',
        '    "Range": [0.5, 10, None],',
        '    "Enabled": [True, False, None],',
        '    "Notes": ["Flow | main", "Says \\"hi\\"\\nsecond line", "007"],',
        "})",
      ].join("\n")
    )
  })

  it("writes rows when there's no header", () => {
    expect(writePandas(view([["1", "x"]], false), { variable: "df", detectTypes: true })).toContain(
      'df = pd.DataFrame([\n    [1, "x"],\n])'
    )
  })

  it("falls back to df for names Python won't accept", () => {
    for (const variable of ["", "2df", "my df", "class"]) {
      expect(writePandas(instruments, { variable, detectTypes: true })).toContain("\ndf = pd.DataFrame")
    }
  })
})

describe("Typst", () => {
  it("writes strings, escaping only what strings need", () => {
    expect(writeTypst(view([["Tag", "Notes"], ["FT-101", 'a "b" \\ #c\nd']]))).toBe(
      [
        "#table(",
        "  columns: 2,",
        '  table.header("Tag", "Notes"),',
        '  "FT-101", "a \\"b\\" \\\\ #c\\nd",',
        ")",
      ].join("\n")
    )
  })
})

describe("writeTable", () => {
  it("writes every format", () => {
    for (const { id } of OUTPUT_FORMATS) {
      expect(writeTable(instruments, id, DEFAULT_OPTIONS[id]).length).toBeGreaterThan(0)
    }
  })

  it("handles 100,000 cells quickly", () => {
    const rows = Array.from({ length: 5000 }, (_, r) =>
      Array.from({ length: 20 }, (_, c) => (r === 0 ? `Column ${c}` : `${r * c}.5`))
    )
    const big = view(rows)
    for (const { id } of OUTPUT_FORMATS) {
      const start = performance.now()
      writeTable(big, id, DEFAULT_OPTIONS[id])
      expect(performance.now() - start, id).toBeLessThan(1500)
    }
  })
})
