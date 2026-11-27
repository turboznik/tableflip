import { cn } from "@/lib/utils"

export function Panel({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground",
        className
      )}
      {...props}
    />
  )
}

export function PanelHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-10 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-1.5", className)}
      {...props}
    />
  )
}

export function PanelTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 className={cn("text-xs font-semibold tracking-tight", className)} {...props} />
}
