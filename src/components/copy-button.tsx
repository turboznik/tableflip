import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import type { ClipboardPayload } from "@/core"
import { copyToClipboard } from "@/lib/clipboard"

interface CopyButtonProps {
  label: string
  /** Called on click, so expensive payloads are only built when needed. */
  getPayload: () => ClipboardPayload
  variant?: "default" | "outline"
  disabled?: boolean
}

export function CopyButton({ label, getPayload, variant = "outline", disabled }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await copyToClipboard(getPayload())
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
    } catch (error) {
      toast.error("Couldn't copy", {
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <Button variant={variant} disabled={disabled} onClick={copy} aria-live="polite">
      {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
      {copied ? "Copied" : label}
    </Button>
  )
}
