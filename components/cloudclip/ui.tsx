"use client"

import { useEffect, useRef, type ReactNode } from "react"

// Terminal design tokens (CSS variables live in app/globals.css under "CloudClip terminal theme").
export const t = {
  root: "cc-root",
  win: "bg-[var(--cc-win)] border border-[var(--cc-line)]",
  bar: "bg-[var(--cc-bar)] border-[var(--cc-line)]",
  fg: "text-[var(--cc-fg)]",
  dim: "text-[var(--cc-dim)]",
  blue: "text-[var(--cc-blue)]",
  green: "text-[var(--cc-green)]",
  yellow: "text-[var(--cc-yellow)]",
  red: "text-[var(--cc-red)]",
  line: "border-[var(--cc-line)]",
  focus:
    "outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cc-blue)]",
  /** inline text command: "copy", "edit" */
  cmd: "inline-flex items-center gap-1 px-1 text-[var(--cc-blue)] hover:bg-[var(--cc-blue)] hover:text-[var(--cc-win)] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--cc-blue)]",
  /** quieter command */
  cmdDim:
    "inline-flex items-center gap-1 px-1 text-[var(--cc-dim)] hover:bg-[var(--cc-dim)] hover:text-[var(--cc-win)] disabled:opacity-40",
  /** primary: inverse block, like a selected line */
  primary:
    "inline-flex items-center justify-center gap-2 px-4 py-1.5 bg-[var(--cc-fg)] text-[var(--cc-win)] font-medium hover:bg-[var(--cc-blue)] disabled:opacity-40 disabled:hover:bg-[var(--cc-fg)] disabled:cursor-not-allowed",
  field:
    "bg-transparent border border-[var(--cc-line)] text-[var(--cc-fg)] placeholder:text-[var(--cc-dim)] focus:border-[var(--cc-blue)] outline-none",
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

/** Braille spinner, as terminals do. */
export function Spinner({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const frames = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
    let i = 0
    const id = setInterval(() => {
      if (ref.current) ref.current.textContent = frames[(i = (i + 1) % frames.length)]
    }, 80)
    return () => clearInterval(id)
  }, [])
  return (
    <span ref={ref} className={cn("inline-block w-[1ch]", className)} aria-hidden>
      ⠋
    </span>
  )
}

// ------------------------------------------------------------ dialog (a small window)

export function Dialog({
  open,
  onClose,
  title,
  children,
  dismissible = true,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  dismissible?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismissible && onClose()
    document.addEventListener("keydown", onKey)
    requestAnimationFrame(() => {
      const el = ref.current?.querySelector<HTMLElement>("input, textarea") ?? ref.current?.querySelector<HTMLElement>("button")
      el?.focus()
    })
    return () => {
      document.removeEventListener("keydown", onKey)
      prev?.focus?.()
    }
  }, [open, onClose, dismissible])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--cc-bg)]/80" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cn("relative w-full max-w-md shadow-2xl", t.win)}>
        <div className={cn("flex items-center justify-between border-b px-3 py-1.5 text-[13px]", t.bar)}>
          <span className={t.fg}>{title}</span>
          {dismissible && (
            <button onClick={onClose} className={cn(t.cmdDim, t.focus)} aria-label="Close">
              esc
            </button>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ toasts (output lines)

export type ToastMsg = { id: number; message: string; type: "success" | "error"; action?: { label: string; onClick: () => void } }

export function Toasts({ toasts, dismiss }: { toasts: ToastMsg[]; dismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(100vw-2rem,26rem)] flex-col gap-1"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn("pointer-events-auto flex items-start gap-2 px-3 py-2 text-[13px] shadow-lg", t.win, "animate-in fade-in slide-in-from-bottom-1 duration-150")}
        >
          <span className={toast.type === "success" ? t.green : t.red} aria-hidden>
            {toast.type === "success" ? "✓" : "✗"}
          </span>
          <span className={cn("flex-1", t.fg)}>{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick()
                dismiss(toast.id)
              }}
              className={t.cmd}
            >
              {toast.action.label}
            </button>
          )}
          <button onClick={() => dismiss(toast.id)} aria-label="Close" className={t.cmdDim}>
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

// ------------------------------------------------------------ clipboard

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  }
}
