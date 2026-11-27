/**
 * Checks generated code with the real tools when they're installed:
 * Python (and pandas) for the Pandas output, Typst for the Typst output,
 * and marked for Markdown. Set PYTHON to a Python that has pandas.
 */
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { marked, type Tokens } from "marked"
import { describe, expect, it } from "vitest"

import { makeTable, toView } from "../table"
import { writeMarkdown } from "./markdown"
import { writePandas } from "./pandas"
import { writeTypst } from "./typst"

const python = process.env.PYTHON ?? "python3"

function works(command: string, args: string[]): boolean {
  return spawnSync(command, args, { stdio: "ignore" }).status === 0
}

const hasPython = works(python, ["--version"])
const hasPandas = hasPython && works(python, ["-c", "import pandas"])
const hasTypst = works("typst", ["--version"])

const tricky = toView(
  makeTable(
    [
      ["Tag", "Value", "Flag", "Notes", "Tag"],
      ["FT-101", "1.50", "true", 'quote " backslash \\ hash # star *', "dup"],
      ["PT-102", "-3", "FALSE", "line one\nline two\ttab", ""],
      ["日本", "", "", "emoji 🙂 and control \u0001 char", "x"],
      ["", "12345678901234567890", "true", "$math$ [bracket] <angle> @at", "y"],
    ],
    true
  ),
  true
)

describe.skipIf(!hasPython)("Pandas output", () => {
  it("is valid Python", () => {
    const code = writePandas(tricky, { variable: "df", detectTypes: true })
    const result = spawnSync(python, ["-c", "import ast, sys; ast.parse(sys.stdin.read())"], {
      input: code,
    })
    expect(result.stderr.toString()).toBe("")
    expect(result.status).toBe(0)
  })

  it.skipIf(!hasPandas)("builds the expected DataFrame", () => {
    const code = writePandas(tricky, { variable: "df", detectTypes: true })
    const script = `${code}\nimport json\nprint(json.dumps({"columns": list(df.columns), "dtypes": [str(t) for t in df.dtypes], "rows": len(df), "notes": df["Notes"][1], "big": str(df["Value"][3])}))`
    const output = execFileSync(python, ["-c", script]).toString()
    const result = JSON.parse(output)
    expect(result.columns).toEqual(["Tag", "Value", "Flag", "Notes", "Tag_2"])
    expect(result.rows).toBe(4)
    expect(result.notes).toBe("line one\nline two\ttab")
    expect(result.big).toBe("12345678901234567890")
  })
})

describe.skipIf(!hasTypst)("Typst output", () => {
  it("compiles", () => {
    const dir = mkdtempSync(join(tmpdir(), "tableflip-typst-"))
    try {
      writeFileSync(join(dir, "table.typ"), writeTypst(tricky))
      const result = spawnSync("typst", ["compile", "table.typ", "table.pdf"], { cwd: dir })
      expect(result.stderr.toString()).toBe("")
      expect(result.status).toBe(0)
      expect(readFileSync(join(dir, "table.pdf")).subarray(0, 4).toString()).toBe("%PDF")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe("Markdown output", () => {
  it("parses as a GitHub table with the same cells", () => {
    for (const align of [true, false]) {
      const tokens = marked.lexer(writeMarkdown(tricky, { align }))
      const table = tokens.find((token) => token.type === "table") as Tokens.Table
      expect(table.header.map((cell) => cell.text)).toEqual(tricky.header)
      expect(table.rows).toHaveLength(tricky.body.length)
      expect(table.rows[0][3].text).toBe('quote " backslash \\ hash # star *')
      expect(table.rows[1][3].text).toBe("line one<br>line two tab")
    }
  })

  it("keeps backslashes before pipes and punctuation", () => {
    const cells = [String.raw`C:\data\|x`, String.raw`a\*b`, "ok"]
    const markdown = writeMarkdown(toView(makeTable([["a", "b", "c"], cells], true), true), { align: false })
    const table = marked.lexer(markdown).find((token) => token.type === "table") as Tokens.Table
    expect(table.rows[0].map((cell) => marked.parseInline(cell.text))).toEqual([
      String.raw`C:\data\|x`,
      String.raw`a\*b`,
      "ok",
    ])
  })
})
