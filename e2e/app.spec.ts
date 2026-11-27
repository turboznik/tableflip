import { expect, test, type Page } from "@playwright/test"

const TSV =
  "Tag\tDescription\tRange\nFT-101\tFeed water flow\t0-250\nPT-102\tDrum pressure\t007"

/** The start of what Excel puts on the clipboard as HTML. */
const EXCEL_HTML =
  '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta name=ProgId content=Excel.Sheet></head><body><table><tr><td>ignored</td></tr></table></body></html>'

const input = (page: Page) =>
  page.getByRole("textbox", { name: "Table to convert" })
const output = (page: Page) => page.getByRole("textbox", { name: /output$/ })
const status = (page: Page) =>
  page.getByRole("region", { name: "Input" }).locator("div.border-t")

/**
 * Pastes the given clipboard contents, as a paste event like the browser fires. Firefox drops
 * the data from scripted paste events, so there it goes through the real clipboard.
 */
async function paste(
  page: Page,
  data: Record<string, string>,
  selector = "body"
) {
  const dispatched = await page.evaluate(
    ([data, selector]) => {
      const transfer = new DataTransfer()
      for (const [type, value] of Object.entries(data))
        transfer.setData(type, value)
      const event = new ClipboardEvent("paste", {
        clipboardData: transfer,
        bubbles: true,
        cancelable: true,
      })
      if (!event.clipboardData?.types.length) return false
      const target = document.querySelector(selector) ?? document.body
      target.dispatchEvent(event)
      return true
    },
    [data, selector] as const
  )
  if (dispatched) return
  await page.evaluate(
    async ([data, selector]) => {
      const blobs = Object.entries(data).map(([type, value]) => [
        type,
        new Blob([value], { type }),
      ])
      await navigator.clipboard.write([
        new ClipboardItem(Object.fromEntries(blobs)),
      ])
      const target = document.querySelector<HTMLElement>(selector)
      if (target && target !== document.body) target.focus()
      else if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur()
    },
    [data, selector] as const
  )
  await page.keyboard.press("ControlOrMeta+v")
}

/** Records what the page puts on the clipboard through the copy event. */
async function recordCopies(page: Page) {
  await page.evaluate(() => {
    const copied: Record<string, string> = {}
    ;(window as unknown as { copied: Record<string, string> }).copied = copied
    const setData = DataTransfer.prototype.setData
    DataTransfer.prototype.setData = function (type: string, value: string) {
      copied[type] = value
      return setData.call(this, type, value)
    }
  })
}

const copied = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { copied: Record<string, string> }).copied
  )

const errors: string[] = []

test.beforeEach(async ({ page }) => {
  errors.length = 0
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  await page.goto("/")
})

test.afterEach(() => {
  expect(errors).toEqual([])
})

test("starts empty and loads the example", async ({ page }) => {
  await expect(page.getByText("Paste a table with")).toBeVisible()
  await expect(
    page.getByRole("button", { name: "Copy for Excel" })
  ).toBeDisabled()

  await page.getByRole("button", { name: "Try an example" }).click()
  await expect(input(page)).toHaveValue(/^Tag\tDescription/)
  await expect(status(page)).toContainText("Detected CSV / TSV, tab-separated")
  await expect(page.getByText("6 rows × 6 columns")).toBeVisible()
  await expect(
    page.getByRole("switch", { name: "First row is headers" })
  ).toBeChecked()
  await expect(
    page.getByRole("button", { name: "Copy for Excel" })
  ).toBeEnabled()
})

test("pasting spreadsheet cells uses their tab-separated text", async ({
  page,
}) => {
  await paste(page, { "text/plain": TSV, "text/html": EXCEL_HTML })
  await expect(input(page)).toHaveValue(TSV)
  await expect(page.getByText("2 rows × 3 columns")).toBeVisible()

  // One column with commas stays one column, and a ditto mark doesn't swallow the next rows.
  await paste(page, {
    "text/plain": 'Description\r\nValve, feed water\r\n"\r\nPump, boiler feed\r\n',
    "text/html": EXCEL_HTML,
  })
  await expect(page.getByText("3 rows × 1 column")).toBeVisible()
  await expect(status(page)).toContainText("Detected CSV / TSV")
})

test("pasting a table from a web page or Word converts it", async ({
  page,
}) => {
  await paste(page, {
    "text/plain": "Tag Range FT-101 0-250",
    "text/html":
      "<table><tr><th>Tag</th><th>Range</th></tr><tr><td>FT-101</td><td>0-250</td></tr></table>",
  })
  await expect(input(page)).toHaveValue("Tag\tRange\nFT-101\t0-250")
  await expect(status(page)).toContainText("Converted from a copied table")
})

test("pasting replaces the whole input, but edits part of it normally", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Example", exact: true }).click()
  await input(page).focus()
  await input(page).press("ControlOrMeta+a")
  await paste(page, { "text/plain": "a,b\n1,2" }, "textarea")
  await expect(input(page)).toHaveValue("a,b\n1,2")

  // A partial selection is left to the browser, so the event isn't cancelled.
  await input(page).evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange(1, 1)
  )
  const cancelled = await page.evaluate(() => {
    const transfer = new DataTransfer()
    transfer.setData("text/plain", "x")
    const event = new ClipboardEvent("paste", {
      clipboardData: transfer,
      bubbles: true,
      cancelable: true,
    })
    document.querySelector("textarea")!.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(cancelled).toBe(false)
})

test("real keyboard paste works", async ({ page }) => {
  await page.evaluate((text) => navigator.clipboard.writeText(text), TSV)
  await page.locator("body").click({ position: { x: 5, y: 5 } })
  await page.keyboard.press("ControlOrMeta+v")
  await expect(input(page)).toHaveValue(TSV)
})

test("pasting into other fields is left alone", async ({ page }) => {
  await page.getByRole("button", { name: "Example", exact: true }).click()
  await page.getByRole("tab", { name: "DAX" }).click()
  const name = page.getByRole("textbox", { name: "Table name" })
  await name.fill("")
  await name.focus()
  await page.evaluate(() => navigator.clipboard.writeText("Instruments"))
  await page.keyboard.press("ControlOrMeta+v")
  await expect(name).toHaveValue("Instruments")
  await expect(input(page)).toHaveValue(/^Tag\tDescription/)
  await expect(output(page)).toHaveValue(/^Instruments = DATATABLE\(/)
})

test("the header switch changes the output", async ({ page }) => {
  await paste(page, { "text/plain": TSV })
  await page.getByRole("tab", { name: "JSON", exact: true }).click()
  await expect(output(page)).toHaveValue(/"Tag": "FT-101"/)

  await page.getByRole("switch", { name: "First row is headers" }).click()
  await expect(output(page)).toHaveValue(/^\[\n {2}\{\n {4}"Column 1": "Tag",/)
  await expect(page.getByText("3 rows × 3 columns")).toBeVisible()

  // A new table starts from its own suggestion again.
  await paste(page, { "text/plain": TSV })
  await expect(
    page.getByRole("switch", { name: "First row is headers" })
  ).toBeChecked()
})

test("every output format writes something", async ({ page }) => {
  await page.getByRole("button", { name: "Example", exact: true }).click()
  const expected: Record<string, RegExp> = {
    Excel: /^Tag\tDescription/,
    CSV: /^Tag,Description,Range/,
    HTML: /^<table>/,
    Markdown: /^\| Tag +\| Description/,
    JSON: /^\[\n {2}\{\n {4}"Tag": "FT-101"/,
    "JSON Lines": /^\{"Tag":"FT-101"/,
    ASCII: /^\+-+\+/,
    DAX: /^Table = DATATABLE\(/,
    Pandas: /^import pandas as pd/,
    Typst: /^#table\(/,
  }
  for (const [tab, pattern] of Object.entries(expected)) {
    await page.getByRole("tab", { name: tab, exact: true }).click()
    await expect(output(page)).toHaveValue(pattern)
  }
})

test("format options apply and are remembered", async ({ page }) => {
  await page.getByRole("button", { name: "Example", exact: true }).click()
  await page.getByRole("tab", { name: "CSV" }).click()
  await page.getByRole("button", { name: "Semicolon" }).click()
  await expect(output(page)).toHaveValue(/^Tag;Description;Range/)

  await page.getByRole("tab", { name: "JSON", exact: true }).click()
  await page.getByRole("switch", { name: "Minify" }).click()
  await expect(output(page)).toHaveValue(/^\[\{"Tag":"FT-101"/)

  await page.reload()
  await page.getByRole("button", { name: "Example", exact: true }).click()
  await expect(
    page.getByRole("tab", { name: "JSON", exact: true })
  ).toHaveAttribute("aria-selected", "true")
  await expect(output(page)).toHaveValue(/^\[\{"Tag":"FT-101"/)
  await page.getByRole("tab", { name: "CSV" }).click()
  await expect(output(page)).toHaveValue(/^Tag;Description;Range/)
})

test("Copy for Excel puts text and Excel-ready HTML on the clipboard", async ({
  page,
}) => {
  await paste(page, { "text/plain": TSV })
  await recordCopies(page)
  await page.getByRole("button", { name: "Copy for Excel" }).click()
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible()
  const data = await copied(page)
  expect(data["text/plain"]).toBe(
    "Tag\tDescription\tRange\r\nFT-101\tFeed water flow\t0-250\r\nPT-102\tDrum pressure\t007"
  )
  expect(data["text/html"]).toContain('mso-number-format:"\\@"')
  expect(data["text/html"]).toContain(">007</td>")
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    data["text/plain"]
  )
  await expect(
    page.getByRole("button", { name: "Copy for Excel" })
  ).toBeVisible({ timeout: 3000 })

  // Without "keep as text", Excel is free to read numbers and dates.
  await page.getByRole("switch", { name: "Keep values as text" }).click()
  await page.getByRole("button", { name: "Copy for Excel" }).click()
  expect((await copied(page))["text/html"]).not.toContain("mso-number-format")
})

test("HTML has a rich copy and a code copy", async ({ page }) => {
  await paste(page, { "text/plain": TSV })
  await page.getByRole("tab", { name: "HTML" }).click()
  await recordCopies(page)

  await page.getByRole("button", { name: "Copy table" }).click()
  let data = await copied(page)
  expect(data["text/html"]).toContain("<table")
  expect(data["text/html"]).toContain("border")
  expect(data["text/plain"]).toContain("Tag\tDescription")

  await page.evaluate(() => {
    const data = (window as unknown as { copied: Record<string, string> })
      .copied
    for (const key of Object.keys(data)) delete data[key]
  })
  await page.getByRole("button", { name: "Copy code" }).click()
  data = await copied(page)
  expect(data["text/html"]).toBeUndefined()
  expect(data["text/plain"]).toMatch(/^<table>\n {2}<thead>/)
})

test("downloads have the right name and contents", async ({ page }) => {
  await paste(page, { "text/plain": TSV })
  await page.getByRole("tab", { name: "CSV" }).click()
  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download" }).click(),
  ])
  expect(csv.suggestedFilename()).toBe("table.csv")
  const csvText = await streamText(await csv.createReadStream())
  expect(csvText.startsWith("\uFEFFTag,Description,Range\r\n")).toBe(true)

  await page.getByRole("button", { name: "Tab", exact: true }).click()
  const [tsv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download" }).click(),
  ])
  expect(tsv.suggestedFilename()).toBe("table.tsv")

  await page.getByRole("tab", { name: "HTML" }).click()
  const [html] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download" }).click(),
  ])
  expect(html.suggestedFilename()).toBe("table.html")
  expect(await streamText(await html.createReadStream())).toMatch(
    /^<!doctype html>/
  )

  await page.getByRole("tab", { name: "Excel" }).click()
  await expect(page.getByRole("button", { name: "Download" })).toHaveCount(0)
})

async function streamText(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString("utf8")
}

test("too much text is refused and the old input kept", async ({ page }) => {
  await paste(page, { "text/plain": TSV })
  await paste(page, { "text/plain": "x,".repeat(3_000_000) })
  const alert = page.getByRole("alert")
  await expect(alert).toContainText("Too much data.")
  await expect(alert).toContainText(
    "tableflip accepts up to 5 MB of text. This is 5.8 MB."
  )
  await expect(alert).not.toContainText(/AI|chat|agent|instead|try/i)
  await expect(input(page)).toHaveValue(TSV)

  await alert.getByRole("button", { name: "Dismiss" }).click()
  await expect(page.getByRole("alert")).toHaveCount(0)
})

test("too many cells is refused with the count", async ({ page }) => {
  const row = Array.from({ length: 300 }, (_, i) => i).join("\t")
  await paste(page, {
    "text/plain": Array.from({ length: 400 }, () => row).join("\n"),
  })
  await expect(page.getByRole("alert")).toContainText(
    "tableflip handles up to 100,000 cells. This table has 120,000 (400 rows × 300 columns)."
  )
  await expect(output(page)).toHaveCount(0)
})

test("read errors explain the problem", async ({ page }) => {
  await paste(page, { "text/plain": '[{"a": 1}, {"a": ' })
  await expect(page.getByRole("alert")).toContainText("This isn't valid JSON.")

  await paste(page, { "text/plain": TSV })
  await page.getByRole("combobox", { name: "Read input as" }).click()
  await page.getByRole("option", { name: "Markdown" }).click()
  await expect(page.getByRole("alert")).toContainText(
    "No Markdown table found."
  )
  await page.getByRole("combobox", { name: "Read input as" }).click()
  await page.getByRole("option", { name: "Auto-detect" }).click()
  await expect(page.getByRole("alert")).toHaveCount(0)
})

test("opens text files in several encodings", async ({ page }) => {
  const chooser = page.locator('input[type="file"]')
  await chooser.setInputFiles({
    name: "list.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Tag,Range\nFT-101,0-250\n"),
  })
  await expect(input(page)).toHaveValue("Tag,Range\nFT-101,0-250\n")
  await expect(status(page)).toContainText("Opened list.csv")

  // Excel's "Unicode Text" export: UTF-16 with a byte order mark.
  const utf16 = Buffer.concat([
    Buffer.from([0xff, 0xfe]),
    Buffer.from("Tag\tUnits\nTT-103\t°F\n", "utf16le"),
  ])
  await chooser.setInputFiles({
    name: "list.txt",
    mimeType: "text/plain",
    buffer: utf16,
  })
  await expect(input(page)).toHaveValue("Tag\tUnits\nTT-103\t°F\n")

  // Older Excel CSV: Windows-1252.
  await chooser.setInputFiles({
    name: "old.csv",
    mimeType: "text/csv",
    buffer: Buffer.from([0x54, 0x2c, 0x55, 0x0a, 0x31, 0x2c, 0xb0, 0x46]),
  })
  await expect(input(page)).toHaveValue("T,U\n1,°F")
})

test("refuses spreadsheet and binary files", async ({ page }) => {
  const chooser = page.locator('input[type="file"]')
  await chooser.setInputFiles({
    name: "list.xlsx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("PK\u0003\u0004"),
  })
  await expect(page.getByRole("alert")).toContainText(
    "tableflip can't open spreadsheet files."
  )

  await chooser.setInputFiles({
    name: "image.txt",
    mimeType: "text/plain",
    buffer: Buffer.from([0x89, 0x50, 0x00, 0x01]),
  })
  await expect(page.getByRole("alert")).toContainText(
    "This doesn't look like a text file."
  )

  await chooser.setInputFiles({
    name: "empty.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("\r\n"),
  })
  await expect(page.getByRole("alert")).toContainText("This file is empty.")
})

test("a slow file can't overwrite a newer paste", async ({ page }) => {
  await page.evaluate(() => {
    const arrayBuffer = Blob.prototype.arrayBuffer
    Blob.prototype.arrayBuffer = async function () {
      await new Promise((resolve) => setTimeout(resolve, 500))
      return arrayBuffer.call(this)
    }
  })
  await page
    .locator('input[type="file"]')
    .setInputFiles({
      name: "slow.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("old,file\n1,2"),
    })
  await paste(page, { "text/plain": TSV })
  await page.waitForTimeout(800)
  await expect(input(page)).toHaveValue(TSV)
})

test("dropping a file opens it and hides the overlay", async ({ page }) => {
  const transfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer()
    transfer.items.add(
      new File(["Tag\tRange\nFT-101\t0-250"], "dropped.tsv", {
        type: "text/tab-separated-values",
      })
    )
    return transfer
  })
  await page.dispatchEvent("main", "dragenter", { dataTransfer: transfer })
  await page.dispatchEvent("main", "dragover", { dataTransfer: transfer })
  await expect(page.getByText("Drop to open")).toBeVisible()
  await page.dispatchEvent("main", "drop", { dataTransfer: transfer })
  await expect(page.getByText("Drop to open")).toHaveCount(0)
  await expect(input(page)).toHaveValue("Tag\tRange\nFT-101\t0-250")
  await expect(status(page)).toContainText("Opened dropped.tsv")
})

test("the drop overlay goes away when a drag leaves", async ({ page }) => {
  const transfer = await page.evaluateHandle(() => {
    const transfer = new DataTransfer()
    transfer.setData("text/plain", "a,b")
    return transfer
  })
  const overlay = page.getByText("Drop to open")
  // Moving between elements: the next dragenter comes before the last dragleave.
  await page.dispatchEvent("main", "dragenter", { dataTransfer: transfer })
  await page.dispatchEvent("textarea", "dragenter", { dataTransfer: transfer })
  await page.dispatchEvent("main", "dragleave", { dataTransfer: transfer })
  await expect(overlay).toBeVisible()
  // Leaving the window.
  await page.dispatchEvent("textarea", "dragleave", { dataTransfer: transfer })
  await expect(overlay).toHaveCount(0)

  // If a leave is missed, the overlay still goes away once dragover stops.
  await page.dispatchEvent("main", "dragover", { dataTransfer: transfer })
  await expect(overlay).toBeVisible()
  await page.waitForTimeout(700)
  await expect(overlay).toBeVisible()
  await expect(overlay).toHaveCount(0, { timeout: 2000 })
})

test("large input stays responsive while typing", async ({ page }) => {
  const rows = Array.from(
    { length: 5000 },
    (_, i) => `TAG-${i}\tValue ${i}\t${i}`
  )
  await paste(page, { "text/plain": "Tag\tName\tNumber\n" + rows.join("\n") })
  await expect(page.getByText("5,000 rows × 3 columns")).toBeVisible()

  await input(page).focus()
  await page.keyboard.press("ControlOrMeta+End")
  const started = Date.now()
  await page.keyboard.type("\nNEW\tAdded\t1", { delay: 5 })
  expect(Date.now() - started).toBeLessThan(3000)
  await expect(page.getByText("5,001 rows × 3 columns")).toBeVisible()
})

test("Copy uses the newest input, even before the screen catches up", async ({
  page,
}) => {
  // Over 50,000 characters, so reading waits for a pause in typing.
  const rows = Array.from({ length: 3000 }, (_, i) => `TAG-${i}\tValue ${i}\t${i}`)
  await paste(page, { "text/plain": "Tag\tName\tNumber\n" + rows.join("\n") })
  await expect(page.getByText("3,000 rows × 3 columns")).toBeVisible()
  await page.getByRole("tab", { name: "CSV" }).click()
  await recordCopies(page)

  await input(page).focus()
  await page.keyboard.press("ControlOrMeta+End")
  await page.keyboard.type("\nNEW\tRow\t1")
  await page.getByRole("button", { name: "Copy", exact: true }).click()
  expect((await copied(page))["text/plain"]).toMatch(/NEW,Row,1\s*$/)
})

test("selecting all of a shortened output copies all of it", async ({
  page,
}) => {
  const rows = Array.from({ length: 5000 }, (_, i) => `TAG-${i}\tValue ${i}\t${i}`)
  await paste(page, { "text/plain": "Tag\tName\tNumber\n" + rows.join("\n") })
  await page.getByRole("tab", { name: "CSV" }).click()
  await expect(page.getByText("Showing the start only.")).toBeVisible()
  await recordCopies(page)

  await output(page).focus()
  await page.keyboard.press("ControlOrMeta+a")
  await page.keyboard.press("ControlOrMeta+c")
  expect((await copied(page))["text/plain"]).toContain("TAG-4999,Value 4999,4999")
})

test("clear empties the input and focuses it", async ({ page }) => {
  await page.getByRole("button", { name: "Example", exact: true }).click()
  await page.getByRole("button", { name: "Clear input" }).click()
  await expect(input(page)).toHaveValue("")
  await expect(input(page)).toBeFocused()
  await expect(
    page.getByText("The table you paste or open shows up here.")
  ).toBeVisible()
})

test("the theme switch is remembered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/light/)
  await page
    .getByRole("button", { name: "Switch between light and dark" })
    .click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)
})
