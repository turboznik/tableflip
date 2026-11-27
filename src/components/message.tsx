import { OctagonAlertIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MessageProps {
  title?: string
  children: React.ReactNode
  onDismiss?: () => void
  className?: string
}

/** An inline error, shown where the problem is rather than in a popup. */
export function ErrorMessage({ title, children, onDismiss, className }: MessageProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive dark:bg-destructive/10",
        className
      )}
    >
      <OctagonAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 leading-relaxed">
        {title && <span className="font-semibold">{title} </span>}
        {children}
      </p>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="-my-0.5 text-destructive"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <XIcon />
        </Button>
      )}
    </div>
  )
}
