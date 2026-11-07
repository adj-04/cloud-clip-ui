"use client"

import { useEffect, useState, type FormEvent } from "react"
import QRCode from "qrcode"
import { formatDistanceToNowStrict } from "date-fns"
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
      <form onSubmit={submit} className="space-y-3">
        <p className={t.dim}>
          Enter the password for <span className={t.fg}>{room}</span>.
        </p>
        <label className="flex items-center gap-2">
          <span className={t.blue}>password:</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            aria-label="Room password"
            className={cn("flex-1 px-2 py-1", t.field)}
          />
        </label>
        {err && <p className={t.red}>✗ {err}</p>}
        <div className="flex items-center justify-between pt-1">
          <a href="/" className={cn(t.cmdDim, t.focus)}>
            new room instead
          </a>
          <button type="submit" disabled={busy || !pw} className={cn(t.primary, t.focus)}>
            {busy && <Spinner />} unlock
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
    <Dialog open={open} onClose={onClose} title={locked ? "Room lock" : "Lock this room"}>
      <form onSubmit={submit} className="space-y-3">
        <p className={t.dim}>
          {locked
            ? "Set a new password, or remove the lock to make the room public again."
            : "Anyone opening this room will need the password to read or edit it. Share it separately from the link."}
        </p>
        <label className="flex items-center gap-2">
          <span className={cn("w-[9ch]", t.blue)}>{locked ? "new:" : "password:"}</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            aria-label="Password"
            autoComplete="new-password"
            className={cn("flex-1 px-2 py-1", t.field)}
          />
        </label>
        <label className="flex items-center gap-2">
          <span className={cn("w-[9ch]", t.blue)}>confirm:</span>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            aria-label="Confirm password"
            autoComplete="new-password"
            className={cn("flex-1 px-2 py-1", t.field)}
          />
        </label>
        <p className={cn("text-[13px]", mismatch ? t.red : t.dim)}>
          {mismatch ? "Passwords don't match." : `At least ${LIMITS.minPassword} characters.`}
        </p>
        <div className="flex items-center justify-between pt-1">
          {locked ? (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await onUnlock()
                setBusy(false)
              }}
              className={cn(t.cmd, "text-[var(--cc-red)] hover:bg-[var(--cc-red)]", t.focus)}
            >
              remove lock
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={busy || tooShort || pw !== pw2} className={cn(t.primary, t.focus)}>
            {busy && <Spinner />} {locked ? "change password" : "lock room"}
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
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#111317", light: "#ffffff" } })
      .then(setSrc)
      .catch(() => setSrc(null))
  }, [open, url])

  return (
    <Dialog open={open} onClose={onClose} title="Open on another device">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-white p-2">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={`QR code for ${url}`} className="h-56 w-56 [image-rendering:pixelated]" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-slate-500">
              <Spinner />
            </div>
          )}
        </div>
        <p className={t.dim}>Scan with your phone camera.</p>
        <div className={cn("flex w-full items-center gap-2 border px-2 py-1", t.line)}>
          <span className={cn("flex-1 truncate text-[13px]", t.fg)}>{url}</span>
          <button onClick={onCopy} className={cn(t.cmd, t.focus)} aria-label="Copy room link">
            copy link
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
    <Dialog open={open} onClose={onClose} title="Previous versions">
      {err ? (
        <p className={t.red}>✗ {err}</p>
      ) : versions === null ? (
        <p className={t.dim}>
          <Spinner /> loading
        </p>
      ) : versions.length === 0 ? (
        <p className={t.dim}>No earlier versions yet. Each post keeps the text it replaced, up to 5.</p>
      ) : (
        <ul className="max-h-[60vh] space-y-3 overflow-auto">
          {versions.map((v) => (
            <li key={v.id} className={cn("border-l-2 pl-3", t.line)}>
              <div className="flex items-center justify-between text-[13px]">
                <span className={t.dim}>
                  {formatDistanceToNowStrict(new Date(v.createdAt), { addSuffix: true })}, {v.body.length} chars
                </span>
                <button onClick={() => onRestore(v)} className={cn(t.cmd, t.focus)}>
                  restore
                </button>
              </div>
              <p className={cn("line-clamp-3 whitespace-pre-wrap break-words", t.fg)}>{v.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
