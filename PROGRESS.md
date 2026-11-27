# Progress

## Status

Feature-complete first version. Every planned format reads and writes;
unit and browser tests pass. The repository is private until it has been
reviewed for publishing.

## Done

- Conversion library in `src/core`: readers for CSV/TSV, HTML, JSON, JSON
  Lines and Markdown; writers for the Excel clipboard, CSV, HTML, Markdown,
  JSON, JSON Lines, ASCII, DAX, pandas and Typst; format detection; size
  limits (5 MB of text, 100,000 cells).
- UI: paste anywhere, open or drop text files, input format override, preview
  with a "First row is headers" switch, output tabs with per-format options,
  Copy for Excel, rich "Copy table" for Word and Outlook, downloads, light
  and dark themes, settings saved in the browser.
- Server: Hono on Node, serving `dist/` with a strict CSP, cache headers,
  compression and a `/healthz` endpoint.
- Tests: Vitest for the library (round trips, real pandas, Typst and marked
  checks when installed, a 100k-cell timing check) and Playwright for the UI
  in Chromium and Firefox (paste paths, copy payloads, downloads, limits, file
  encodings, a file-read race, copying while input is still being read, drag
  and drop, typing in large input, theme).

## Decisions

- **No spreadsheet files.** Excel data comes in through the clipboard and goes
  back the same way. This keeps the app small and avoids an XLSX dependency.
- **Copy for Excel writes HTML as well as text.** The HTML carries
  `mso-number-format:"\@"` so Excel keeps values like `1-2` and `007` as typed
  ("Keep values as text", on by default).
- **Copying uses the copy event.** Chromium's async Clipboard API rewrites
  HTML and would drop the Excel formatting hints; the async API is only a
  fallback.
- **Tables pasted from web pages or Word become tab-separated text.** Their
  plain-text versions are unreliable. Spreadsheet pastes use their own text.
- **Pastes and files say what they are; detection is for plain text.**
  Spreadsheet pastes are read as tab-separated text with the spreadsheet's own
  quoting rule (only cells with line breaks are quoted, so a cell that starts
  with `"`, like a ditto mark, stays as typed). `.tsv` files are read as
  tab-separated, other files by extension, and tables from web pages keep the
  header row they mark.
- **Delimiter detection ignores blank lines** and treats text that no
  delimiter splits as one column (Papa Parse's own guess fails on two-column
  Excel copies, which end with a line break).
- **JSON numbers keep their exact text** (the `JSON.parse` reviver's source
  text), so large IDs and `1.50` survive a round trip.
- **The input textarea is uncontrolled.** React rewriting megabytes of text on
  each keystroke made typing lag; the app sets the value when it replaces the
  input.
- **Output on screen is cut at 100,000 characters**; copy and download use all
  of it, and so does selecting all of the output and copying. Each format's
  output is cached per table, so switching tabs back is instant.
- **Copy and Download use the newest input.** Big input waits for a pause in
  typing before it's read; a click in the meantime reads it right away.
  Option changes (like a DAX table name) also update the screen in the
  background, so typing stays quick with big tables.
- **Side by side from 1280 px.** The output tabs need about 620 px; narrower
  windows stack the panels.

## Performance (100,000 cells, 1 MB of tab-separated text)

Measured in headless Chromium on a busy 8-core server: paste to output about
0.5–0.7 s; switching output tabs 60–120 ms; typing in the input costs about
what a plain textarea with the same text costs.

## How to run and test

See [README.md](README.md). In short: `npm install`, `npm run dev`;
`npm run build && npm start` for production; `npm test`; `npm run test:e2e`.

## Next

- Review the repository before making it public (this file can be removed or
  kept as a changelog).
- Try real pastes from desktop Excel, Word and Outlook on Windows.

## Known limitations

- Real pastes from desktop Excel, Word and Outlook haven't been tested on
  Windows; the clipboard formats follow what those apps produce and accept.
- Safari may not fire paste events unless a text field has focus; clicking
  the input first works everywhere.
- A spreadsheet copy of a single column where cells are just `"` (ditto
  marks) can still be misread: the copied text alone can't tell two such
  cells apart from one quoted cell with a line break. With more than one
  column it reads correctly.
