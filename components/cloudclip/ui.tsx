"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"

// Design tokens (CSS variables live in app/globals.css under "CloudClip theme").
export const t = {
  root: "cc-root",
  mono: "cc-mono",
  surface: "bg-[var(--cc-surface)] border border-[var(--cc-line)]",
  raised: "bg-[var(--cc-raised)]",
  fg: "text-[var(--cc-fg)]",
  dim: "text-[var(--cc-dim)]",
  accentText: "text-[var(--cc-accent-text)]",
  red: "text-[var(--cc-red)]",
  line: "border-[var(--cc-line)]",
  focus:
    "outline-none focus-visible:ring-2 focus-visible:ring-[var(--cc-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--cc-bg)]",
  /** main action: yellow pill, black text */
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--cc-accent)] px-6 py-2.5 font-semibold text-[var(--cc-accent-ink)] transition-[transform,filter] duration-150 hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--cc-raised)] disabled:text-[var(--cc-dim)] disabled:hover:brightness-100 disabled:active:scale-100",
  /** secondary: outlined pill */
  secondary:
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-[var(--cc-line)] px-3.5 py-1.5 text-sm font-medium text-[var(--cc-fg)] transition-colors hover:border-[var(--cc-fg)] disabled:opacity-40",
  /** quiet text button */
  ghost:
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm text-[var(--cc-dim)] transition-colors hover:bg-[var(--cc-raised)] hover:text-[var(--cc-fg)] disabled:opacity-40",
  iconBtn:
    "inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--cc-dim)] transition-colors hover:bg-[var(--cc-raised)] hover:text-[var(--cc-fg)]",
  field:
    "rounded-xl border border-[var(--cc-line)] bg-[var(--cc-bg)] px-3 py-2 text-[var(--cc-fg)] placeholder:text-[var(--cc-dim)] outline-none focus:border-[var(--cc-accent)]",
  link: "underline decoration-[var(--cc-accent)] decoration-2 underline-offset-4 hover:decoration-[var(--cc-fg)]",
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ------------------------------------------------------------ dialog

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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={dismissible ? onClose : undefined} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("relative w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150", t.surface)}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className={cn("text-xl font-semibold tracking-tight", t.fg)}>{title}</h2>
          {dismissible && (
            <button onClick={onClose} className={cn(t.iconBtn, "-mr-2 -mt-1", t.focus)} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

// ------------------------------------------------------------ toasts

export type ToastMsg = { id: number; message: string; type: "success" | "error"; action?: { label: string; onClick: () => void } }

export function Toasts({ toasts, dismiss }: { toasts: ToastMsg[]; dismiss: (id: number) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex max-w-md items-center gap-3 rounded-full py-2 pl-4 pr-2 text-sm font-medium shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200",
            toast.type === "success"
              ? "bg-[var(--cc-fg)] text-[var(--cc-bg)]"
              : "bg-[var(--cc-red)] text-white",
          )}
        >
          <span className="flex-1">{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick()
                dismiss(toast.id)
              }}
              className="rounded-full bg-[var(--cc-accent)] px-3 py-1 text-[var(--cc-accent-ink)]"
            >
              {toast.action.label}
            </button>
          )}
          <button onClick={() => dismiss(toast.id)} aria-label="Close" className="rounded-full p-1 opacity-60 hover:opacity-100">
            <X className="h-4 w-4" />
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
