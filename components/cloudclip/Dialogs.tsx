"use client"

import { useEffect, useState, type FormEvent } from "react"
import QRCode from "qrcode"
import { formatDistanceToNowStrict } from "date-fns"
import { Copy, Lock, RotateCcw } from "lucide-react"
import { LIMITS, type RoomVersion } from "@/lib/room"
import { cn, Dialog, Spinner, t } from "./ui"

// ------------------------------------------------------------ password entry (locked room)

export function UnlockDialog({
  open,
  room,
  onSubmit,
}: {
  open: boolean
  room: string
  onSubmit: (password: string) => Promise<string | null>
}) {
  const [pw, setPw] = useState("")
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(await onSubmit(pw))
    setBusy(false)
  }

  return (
    <Dialog open={open} onClose={() => {}} title="This room is locked" dismissible={false}>
      <form onSubmit={submit} className="space-y-4">
        <p className={t.dim}>
          Enter the password for <span className={cn(t.mono, t.fg)}>{room}</span> to see what&apos;s inside.
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="current-password"
          aria-label="Room password"
          placeholder="Password"
          className={cn("w-full", t.field)}
        />
        {err && <p className={cn("text-sm", t.red)}>{err}</p>}
        <div className="flex items-center justify-between gap-3 pt-1">
          <a href="/" className={cn("text-sm", t.dim, t.link)}>
            Start a new room instead
          </a>
          <button type="submit" disabled={busy || !pw} className={cn(t.primary, t.focus)}>
            {busy ? <Spinner /> : <Lock className="h-4 w-4" />} Unlock
          </button>
        </div>
      </form>
    </Dialog>
  )
}

// ------------------------------------------------------------ set / change / remove lock

export function LockDialog({
  open,
  locked,
  onClose,
  onLock,
  onUnlock,
}: {
  open: boolean
  locked: boolean
  onClose: () => void
  onLock: (password: string) => Promise<void>
  onUnlock: () => Promise<void>
}) {
  const [pw, setPw] = useState("")
  const [pw2, setPw2] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setPw("")
      setPw2("")
    }
  }, [open])

  const tooShort = pw.length < LIMITS.minPassword
  const mismatch = pw2.length > 0 && pw !== pw2

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (tooShort || pw !== pw2) return
    setBusy(true)
    await onLock(pw)
    setBusy(false)
  }

  return (
    <Dialog open={open} onClose={onClose} title={locked ? "Room password" : "Lock this room"}>
      <form onSubmit={submit} className="space-y-3">
        <p className={t.dim}>
          {locked
            ? "Change the password, or remove it to make the room open to anyone with the link."
            : "Anyone opening this room will need the password. Send it separately from the link."}
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={locked ? "New password" : "Password"}
          aria-label="Password"
          autoComplete="new-password"
          className={cn("w-full", t.field)}
        />
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="Type it again"
          aria-label="Confirm password"
          autoComplete="new-password"
          className={cn("w-full", t.field)}
        />
        <p className={cn("text-sm", mismatch ? t.red : t.dim)}>
          {mismatch ? "Those don't match yet." : `At least ${LIMITS.minPassword} characters.`}
        </p>
        <div className="flex items-center justify-between gap-3 pt-2">
          {locked ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await onUnlock()
                setBusy(false)
              }}
              className={cn(t.ghost, "text-[var(--cc-red)]", t.focus)}
            >
              Remove password
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={busy || tooShort || pw !== pw2} className={cn(t.primary, t.focus)}>
            {busy && <Spinner />} {locked ? "Change password" : "Lock room"}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

// ------------------------------------------------------------ QR code

export function QrDialog({ open, url, onClose, onCopy }: { open: boolean; url: string; onClose: () => void; onCopy: () => void }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !url) return
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#000000", light: "#FFFFFF" } })
      .then(setSrc)
      .catch(() => setSrc(null))
  }, [open, url])

  return (
    <Dialog open={open} onClose={onClose} title="Open on your phone">
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-2xl bg-white p-3 ring-4 ring-[var(--cc-accent)]">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={`QR code for ${url}`} className="h-56 w-56 [image-rendering:pixelated]" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-neutral-400">
              <Spinner className="h-6 w-6" />
            </div>
          )}
        </div>
        <p className={cn("text-center", t.dim)}>Point your camera at the code and the room opens.</p>
        <div className={cn("flex w-full items-center gap-2 rounded-full py-1 pl-4 pr-1", t.raised)}>
          <span className={cn("flex-1 truncate text-sm", t.mono, t.fg)}>{url}</span>
          <button onClick={onCopy} className={cn(t.secondary, "border-transparent", t.focus)} aria-label="Copy room link">
            <Copy className="h-4 w-4" /> Copy
          </button>
        </div>
      </div>
    </Dialog>
  )
}

// ------------------------------------------------------------ history

export function HistoryDialog({
  open,
  onClose,
  load,
  onRestore,
}: {
  open: boolean
  onClose: () => void
  load: () => Promise<RoomVersion[]>
  onRestore: (v: RoomVersion) => void
}) {
  const [versions, setVersions] = useState<RoomVersion[] | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setVersions(null)
    setErr(null)
    load()
      .then(setVersions)
      .catch((e) => setErr(e?.message ?? "Couldn't load history."))
  }, [open, load])

  return (
    <Dialog open={open} onClose={onClose} title="Earlier versions">
      {err ? (
        <p className={t.red}>{err}</p>
      ) : versions === null ? (
        <div className={cn("flex justify-center py-6", t.dim)}>
          <Spinner className="h-5 w-5" />
        </div>
      ) : versions.length === 0 ? (
        <p className={t.dim}>Nothing yet. Each time you send new text, the previous version is kept here (up to 5).</p>
      ) : (
        <ul className="max-h-[60vh] space-y-2 overflow-auto">
          {versions.map((v) => (
            <li key={v.id} className={cn("rounded-2xl p-3", t.raised)}>
              <div className="mb-1 flex items-center justify-between">
                <span className={cn("text-sm", t.dim)}>{formatDistanceToNowStrict(new Date(v.createdAt), { addSuffix: true })}</span>
                <button onClick={() => onRestore(v)} className={cn(t.ghost, t.focus)}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </button>
              </div>
              <p className={cn("line-clamp-3 whitespace-pre-wrap break-words text-sm", t.mono, t.fg)}>{v.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
