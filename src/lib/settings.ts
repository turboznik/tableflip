import { DEFAULT_OPTIONS, OUTPUT_FORMATS, type OutputFormat, type OutputOptions } from "@/core"

export interface Settings {
  outputFormat: OutputFormat
  options: OutputOptions
}

const STORAGE_KEY = "tableflip:settings:v1"

/** Allowed values for options that are a fixed set of choices. */
const CHOICES: Record<string, readonly string[]> = {
  "csv.delimiter": [",", ";", "\t"],
  "json.shape": ["objects", "arrays"],
  "jsonl.shape": ["objects", "arrays"],
  "ascii.style": ["classic", "box"],
}

const MAX_TEXT_OPTION = 100

export const DEFAULT_SETTINGS: Settings = { outputFormat: "excel", options: DEFAULT_OPTIONS }

/** Keeps only stored values that have the right type, so old or edited data can't break the app. */
function sanitize(stored: unknown): Settings {
  if (typeof stored !== "object" || stored === null) return DEFAULT_SETTINGS
  const raw = stored as { outputFormat?: unknown; options?: Record<string, Record<string, unknown>> }

  const outputFormat = OUTPUT_FORMATS.some((format) => format.id === raw.outputFormat)
    ? (raw.outputFormat as OutputFormat)
    : DEFAULT_SETTINGS.outputFormat

  const options = structuredClone(DEFAULT_OPTIONS) as unknown as Record<string, Record<string, unknown>>
  for (const [format, defaults] of Object.entries(options)) {
    const saved = raw.options?.[format]
    if (typeof saved !== "object" || saved === null) continue
    for (const [key, fallback] of Object.entries(defaults)) {
      const value = saved[key]
      if (typeof value !== typeof fallback) continue
      const choices = CHOICES[`${format}.${key}`]
      if (choices && !choices.includes(value as string)) continue
      if (typeof value === "string" && value.length > MAX_TEXT_OPTION) continue
      defaults[key] = value
    }
  }
  return { outputFormat, options: options as unknown as OutputOptions }
}

export function loadSettings(): Settings {
  try {
    const text = localStorage.getItem(STORAGE_KEY)
    return text ? sanitize(JSON.parse(text)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Private windows and locked-down browsers can refuse storage; settings just won't stick.
  }
}
