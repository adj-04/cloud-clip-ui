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
  onSubmit: (password: string) => Promise<string | null> // returns error message or null
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
        <p className={cn("text-sm", t.muted)}>
          Enter the password for <span className="font-mono">{room}</span> to view and edit it.
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          autoComplete="current-password"
          aria-label="Room password"
          placeholder="Password"
          className={cn("w-full rounded-lg px-3 py-2", t.input, t.focus)}
        />
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        <div className="flex items-center justify-between">
          <a href="/" className={cn("text-sm underline underline-offset-2", t.muted)}>
            New room instead
          </a>
          <button type="submit" disabled={busy || !pw} className={cn(t.primaryBtn, "px-5 py-2", t.focus)}>
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
    <Dialog open={open} onClose={onClose} title={locked ? "Room lock" : "Lock this room"}>
      <form onSubmit={submit} className="space-y-3">
        <p className={cn("text-sm", t.muted)}>
          {locked
            ? "This room is locked. Set a new password, or remove the lock to make it public again."
            : "Anyone with the link will need this password to view or edit the room. Share it separately."}
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder={locked ? "New password" : "Password"}
          aria-label="Password"
          autoComplete="new-password"
          className={cn("w-full rounded-lg px-3 py-2", t.input, t.focus)}
        />
        <input
          type="password"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="Confirm password"
          aria-label="Confirm password"
          autoComplete="new-password"
          className={cn("w-full rounded-lg px-3 py-2", t.input, t.focus)}
        />
        <p className={cn("text-xs", mismatch ? "text-red-600 dark:text-red-400" : t.muted)}>
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
              className={cn(t.ghostBtn, "text-sm text-red-600 dark:text-red-400")}
            >
              Remove lock
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={busy || tooShort || pw !== pw2} className={cn(t.primaryBtn, "px-5 py-2", t.focus)}>
            {busy ? <Spinner /> : <Lock className="h-4 w-4" />} {locked ? "Change password" : "Lock room"}
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
    QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: "#0F172A", light: "#FFFFFF" } })
      .then(setSrc)
      .catch(() => setSrc(null))
  }, [open, url])

  return (
    <Dialog open={open} onClose={onClose} title="Open on another device">
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-xl bg-white p-3">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={`QR code for ${url}`} className="h-60 w-60" />
          ) : (
            <div className="flex h-60 w-60 items-center justify-center">
              <Spinner className="h-6 w-6 text-slate-400" />
            </div>
          )}
        </div>
        <p className={cn("text-center text-sm", t.muted)}>Scan with your phone camera to open this room.</p>
        <div className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2", t.surface)}>
          <span className={cn("flex-1 truncate font-mono text-xs", t.text)}>{url}</span>
          <button onClick={onCopy} className={t.ghostBtn} aria-label="Copy room link">
            <Copy className="h-4 w-4" /> Copy link
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
        <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
      ) : versions === null ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5 text-slate-400" />
        </div>
      ) : versions.length === 0 ? (
        <p className={cn("text-sm", t.muted)}>No earlier versions yet. Each save keeps the previous text here (last 5).</p>
      ) : (
        <ul className="max-h-[60vh] space-y-2 overflow-auto">
          {versions.map((v) => (
            <li key={v.id} className={cn("rounded-lg p-3", t.surface)}>
              <div className="mb-1 flex items-center justify-between">
                <span className={cn("text-xs", t.muted)}>
                  {formatDistanceToNowStrict(new Date(v.createdAt), { addSuffix: true })} · {v.body.length} chars
                </span>
                <button onClick={() => onRestore(v)} className={t.ghostBtn}>
                  <RotateCcw className="h-3.5 w-3.5" /> Restore
                </button>
              </div>
              <p className={cn("line-clamp-3 whitespace-pre-wrap break-words text-sm", t.text)}>{v.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
