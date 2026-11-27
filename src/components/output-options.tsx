import { InfoIcon } from "lucide-react"
import { useId } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { OutputFormat, OutputOptions } from "@/core"

type SetOptions = <F extends OutputFormat>(format: F, patch: Partial<OutputOptions[F]>) => void

interface OutputOptionsProps {
  format: OutputFormat
  options: OutputOptions
  setOptions: SetOptions
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-1.5">
      <Switch id={id} size="sm" checked={checked} onCheckedChange={onChange} />
      <Label htmlFor={id} className="text-xs font-normal whitespace-nowrap">
        {label}
      </Label>
      {hint && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`About ${label}`}
              />
            }
          >
            <InfoIcon className="size-3" />
          </TooltipTrigger>
          <TooltipContent className="max-w-64 text-pretty">{hint}</TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

function Choice<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string
  value: T
  choices: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <ToggleGroup
      aria-label={label}
      variant="outline"
      size="sm"
      spacing={0}
      value={[value]}
      onValueChange={(next) => {
        // Clicking the selected item would clear the group; keep a choice selected.
        if (next.length > 0) onChange(next[0] as T)
      }}
    >
      {choices.map((choice) => (
        <ToggleGroupItem key={choice.value} value={choice.value} className="px-2 text-xs">
          {choice.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

function TextOption({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id} className="text-xs font-normal whitespace-nowrap text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={value}
        placeholder={placeholder}
        maxLength={100}
        spellCheck={false}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        className="h-6 w-28 px-1.5 font-mono text-xs"
      />
    </div>
  )
}

const DETECT_TYPES_HINT =
  "Writes a column as numbers or true/false when every value in it is one. Columns with values like 007 or 1-2 stay text."

/** The few settings each output format has. */
export function OutputOptionsBar({ format, options, setOptions }: OutputOptionsProps) {
  switch (format) {
    case "excel":
      return (
        <Toggle
          label="Keep values as text"
          hint="Stops Excel from turning values like 1-2 into dates, dropping leading zeros from 007, or treating +24V as a formula."
          checked={options.excel.keepText}
          onChange={(keepText) => setOptions("excel", { keepText })}
        />
      )
    case "csv":
      return (
        <Choice
          label="Delimiter"
          value={options.csv.delimiter}
          choices={[
            { value: ",", label: "Comma" },
            { value: ";", label: "Semicolon" },
            { value: "\t", label: "Tab" },
          ]}
          onChange={(delimiter) => setOptions("csv", { delimiter })}
        />
      )
    case "html":
      return (
        <Toggle
          label="Inline styles"
          hint="Adds borders and padding to the code, so the table looks right in emails."
          checked={options.html.inlineStyles}
          onChange={(inlineStyles) => setOptions("html", { inlineStyles })}
        />
      )
    case "markdown":
      return (
        <Toggle
          label="Align columns"
          checked={options.markdown.align}
          onChange={(align) => setOptions("markdown", { align })}
        />
      )
    case "json":
      return (
        <>
          <Choice
            label="Shape"
            value={options.json.shape}
            choices={[
              { value: "objects", label: "Objects" },
              { value: "arrays", label: "Arrays" },
            ]}
            onChange={(shape) => setOptions("json", { shape })}
          />
          <Toggle
            label="Detect types"
            hint={DETECT_TYPES_HINT}
            checked={options.json.detectTypes}
            onChange={(detectTypes) => setOptions("json", { detectTypes })}
          />
          <Toggle
            label="Minify"
            checked={options.json.minify}
            onChange={(minify) => setOptions("json", { minify })}
          />
        </>
      )
    case "jsonl":
      return (
        <>
          <Choice
            label="Shape"
            value={options.jsonl.shape}
            choices={[
              { value: "objects", label: "Objects" },
              { value: "arrays", label: "Arrays" },
            ]}
            onChange={(shape) => setOptions("jsonl", { shape })}
          />
          <Toggle
            label="Detect types"
            hint={DETECT_TYPES_HINT}
            checked={options.jsonl.detectTypes}
            onChange={(detectTypes) => setOptions("jsonl", { detectTypes })}
          />
        </>
      )
    case "ascii":
      return (
        <Choice
          label="Border style"
          value={options.ascii.style}
          choices={[
            { value: "classic", label: "Plain" },
            { value: "box", label: "Box lines" },
          ]}
          onChange={(style) => setOptions("ascii", { style })}
        />
      )
    case "dax":
      return (
        <>
          <TextOption
            label="Table name"
            value={options.dax.tableName}
            placeholder="Table"
            onChange={(tableName) => setOptions("dax", { tableName })}
          />
          <Toggle
            label="Detect types"
            hint="Uses INTEGER, DOUBLE and BOOLEAN columns when every value in the column fits. Everything else is STRING."
            checked={options.dax.detectTypes}
            onChange={(detectTypes) => setOptions("dax", { detectTypes })}
          />
        </>
      )
    case "pandas":
      return (
        <>
          <TextOption
            label="Variable"
            value={options.pandas.variable}
            placeholder="df"
            onChange={(variable) => setOptions("pandas", { variable })}
          />
          <Toggle
            label="Detect types"
            hint={DETECT_TYPES_HINT}
            checked={options.pandas.detectTypes}
            onChange={(detectTypes) => setOptions("pandas", { detectTypes })}
          />
        </>
      )
    case "typst":
      return null
  }
}
