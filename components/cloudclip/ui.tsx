"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { X } from "lucide-react"

// Design tokens from design-tokens.json, as Tailwind classes (light / dark).
export const t = {
  page: "bg-[#F8FAFC] dark:bg-[#0B1220]",
  card: "bg-white dark:bg-[#0F1724] shadow-[0_6px_20px_rgba(2,6,23,0.08)] dark:shadow-[0_0_24px_rgba(6,182,212,0.08)] dark:ring-1 dark:ring-white/5",
  nav: "bg-white/90 dark:bg-[#071326]/90 border-b border-slate-200 dark:border-slate-800 backdrop-blur",
  text: "text-[#0F172A] dark:text-[#E6EEF6]",
  muted: "text-[#64748B] dark:text-[#93A6B8]",
  accentText: "text-[#0369A1] dark:text-[#06B6D4]",
  accentBg: "bg-[#0EA5E9] dark:bg-[#06B6D4]",
  surface: "bg-slate-50 dark:bg-[#0B1220] border border-slate-200 dark:border-slate-700/70",
  input:
    "bg-white dark:bg-[#0B1220] border border-slate-300 dark:border-slate-700 text-[#0F172A] dark:text-[#E6EEF6] placeholder-slate-400 dark:placeholder-slate-500",
  focus:
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0EA5E9] dark:focus-visible:ring-[#06B6D4] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#0F1724]",
  iconBtn:
    "inline-flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-all duration-[140ms] hover:-translate-y-0.5",
  ghostBtn:
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors disabled:opacity-50",
  secondaryBtn:
    "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium bg-sky-50 text-[#0369A1] hover:bg-sky-100 dark:bg-cyan-400/10 dark:text-[#06B6D4] dark:hover:bg-cyan-400/20 transition-colors disabled:opacity-50",
  primaryBtn:
    "inline-flex items-center justify-center gap-2 rounded-lg px-8 py-3 font-medium text-white bg-gradient-to-r from-sky-400 to-cyan-400 dark:from-cyan-500 dark:to-sky-500 shadow-sm hover:shadow-lg hover:shadow-sky-500/25 dark:hover:shadow-cyan-400/30 transition-all duration-[140ms] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-sm",
  badge: "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
}

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ")
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
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
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    // focus the first field (or button) inside
    requestAnimationFrame(() => {
      const el = ref.current?.querySelector<HTMLElement>("input, textarea") ?? ref.current?.querySelector<HTMLElement>("button")
      el?.focus()
    })
    return () => {
      document.removeEventListener("keydown", onKey)
      prev?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn("relative w-full max-w-md rounded-xl p-6", t.card)}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className={cn("text-base font-semibold", t.text)}>{title}</h2>
          {dismissible && (
            <button onClick={onClose} className={cn(t.iconBtn, t.focus, "hover:translate-y-0")} aria-label="Close">
              <X className="h-4 w-4" />
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
    <div className="pointer-events-none fixed right-4 top-20 z-[60] flex w-[min(100vw-2rem,22rem)] flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "pointer-events-auto flex items-start gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg animate-in slide-in-from-right-4 fade-in duration-200",
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600",
          )}
        >
          <span className="flex-1">{toast.message}</span>
          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick()
                dismiss(toast.id)
              }}
              className="font-semibold underline underline-offset-2"
            >
              {toast.action.label}
            </button>
          )}
          <button onClick={() => dismiss(toast.id)} aria-label="Close" className="opacity-80 hover:opacity-100">
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
