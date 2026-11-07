"use client"

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { formatDistanceToNowStrict } from "date-fns"
import {
  Check,
  ClipboardIcon,
  Copy,
  History,
  Link as LinkIcon,
  Lock,
  LockOpen,
  Moon,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  Sparkles,
  Sun,
  Upload,
  X,
} from "lucide-react"
import { api, ApiError, setRoomPassword } from "@/lib/client/api"
import { useRoomLive } from "@/lib/client/realtime"
import { LIMITS, formatBytes, isValidRoom, type RoomFile, type RoomState } from "@/lib/room"
import { FileList } from "./FileList"
import { HistoryDialog, LockDialog, QrDialog, UnlockDialog } from "./Dialogs"
import { cn, copyText, Spinner, t, Toasts, type ToastMsg } from "./ui"

type Mode = "text" | "file"
type Upload = { key: string; name: string; size: number; progress: number; abort: AbortController; error?: string; file: File; oneTime: boolean }

export default function CloudClip({ room }: { room: string }) {
  // ---------------------------------------------------------- state
  const [state, setState] = useState<RoomState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [needsPassword, setNeedsPassword] = useState(false)

  const [mode, setMode] = useState<Mode>("text")
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState(false)
  const [editBase, setEditBase] = useState<string | null>(null) // updatedAt of the text we started editing
  const [oneTime, setOneTime] = useState(false)
  const [posting, setPosting] = useState(false)
  const [posted, setPosted] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [sentOneTime, setSentOneTime] = useState(false) // this device posted the pending one-time text
  const [revealed, setRevealed] = useState<string | null>(null)
  const [revealing, setRevealing] = useState(false)

  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [busyFile, setBusyFile] = useState(false)

  const [toasts, setToasts] = useState<ToastMsg[]>([])
  const [dialog, setDialog] = useState<null | "qr" | "lock" | "history">(null)
  const [roomUrl, setRoomUrl] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const toastId = useRef(0)
  const editingRef = useRef(editing)
  editingRef.current = editing

  useEffect(() => setRoomUrl(`${window.location.origin}/clip/${room}`), [room])

  // ---------------------------------------------------------- helpers
  const toast = useCallback((message: string, type: ToastMsg["type"] = "success", action?: ToastMsg["action"]) => {
    const id = ++toastId.current
    setToasts((ts) => [...ts.slice(-2), { id, message, type, action }])
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4000)
  }, [])

  const copyLink = useCallback(async () => {
    const ok = await copyText(roomUrl)
    toast(ok ? "Room link copied" : "Couldn't copy the link", ok ? "success" : "error")
  }, [roomUrl, toast])

  const copyAndToast = async (value: string) => {
    const ok = await copyText(value)
    toast(ok ? "Copied to your clipboard" : "Couldn't copy that", ok ? "success" : "error")
  }

  const handleApiError = useCallback(
    (e: unknown, fallback = "Network error — try again.") => {
      if (e instanceof ApiError && e.locked) {
        setRoomPassword(room, null)
        setNeedsPassword(true)
        return
      }
      toast(e instanceof Error ? e.message : fallback, "error")
    },
    [room, toast],
  )

  // ---------------------------------------------------------- loading + live sync
  const load = useCallback(async () => {
    try {
      const s = await api.getRoom(room)
      setState(s)
      setLoadError(null)
      setNeedsPassword(false)
      // Show existing text read-first; keep the user's draft if they're mid-edit.
      if (!editingRef.current || s.text === null) {
        setDraft(s.text?.body ?? "")
        setEditing(!s.text || s.text.body === "" || s.text.oneTime)
      }
      if (!s.text?.oneTime) setSentOneTime(false)
    } catch (e) {
      if (e instanceof ApiError && e.locked) {
        setRoomPassword(room, null)
        setNeedsPassword(true)
        setState(null)
      } else {
        setLoadError(e instanceof Error ? e.message : "Network error — try again.")
      }
    }
  }, [room])

  const { notify, online, connected } = useRoomLive(room, load)

  useEffect(() => {
    load()
  }, [load])

  // Fallback polling (5 s, per spec) only when the realtime connection isn't up.
  useEffect(() => {
    if (connected || needsPassword) return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [connected, needsPassword, load])

  // Refresh when the tab becomes visible again (phones suspend websockets in the background).
  useEffect(() => {
    const onVis = () => document.visibilityState === "visible" && load()
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [load])

  // ---------------------------------------------------------- text
  const text = state?.text ?? null
  const remoteChanged = editing && editBase !== null && text?.updatedAt !== editBase

  const startEdit = () => {
    setDraft(text?.body ?? "")
    setEditBase(text?.updatedAt ?? null)
    setEditing(true)
    setPosted(false)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const cancelEdit = () => {
    setDraft(text?.body ?? "")
    setEditing(false)
    setEditBase(null)
    setPostError(null)
  }

  const postText = useCallback(async () => {
    if (posting || !draft.trim()) return
    if (draft.length > LIMITS.textChars) {
      setPostError(`Text exceeds ${LIMITS.textChars.toLocaleString()} characters.`)
      return
    }
    setPosting(true)
    setPostError(null)
    try {
      await api.saveText(room, draft, oneTime)
      const copied = await copyText(roomUrl)
      toast(copied ? `Sent to ${room}. Link copied, share it anywhere.` : `Sent to ${room}`, "success", copied ? undefined : { label: "Copy link", onClick: copyLink })
      setPosted(true)
      setTimeout(() => setPosted(false), 2000)
      setEditBase(null)
      if (oneTime) {
        setSentOneTime(true)
        setOneTime(false)
        setDraft("")
      }
      setEditing(false)
      notify()
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.locked) handleApiError(e)
      else setPostError(e instanceof Error ? e.message : "Network error — try again.")
    } finally {
      setPosting(false)
    }
  }, [posting, draft, oneTime, room, roomUrl, toast, copyLink, notify, load, handleApiError])

  const reveal = async () => {
    setRevealing(true)
    try {
      const { text: body } = await api.revealText(room)
      setRevealed(body)
      notify()
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) {
        setRevealed(null)
        toast("This item was deleted after being viewed.", "error")
        await load()
      } else handleApiError(e)
    } finally {
      setRevealing(false)
    }
  }

  // ---------------------------------------------------------- files
  const roomFull = (state?.storageUsed ?? 0) >= LIMITS.roomBytes

  const startUpload = useCallback(
    async (u: Upload) => {
      try {
        await api.uploadFile(room, u.file, {
          oneTime: u.oneTime,
          signal: u.abort.signal,
          onProgress: (p) => setUploads((us) => us.map((x) => (x.key === u.key ? { ...x, progress: p } : x))),
        })
        setUploads((us) => us.filter((x) => x.key !== u.key))
        toast(`Uploaded ${u.name}`)
        notify()
        await load()
      } catch (e) {
        if (e instanceof ApiError && e.status === 499) {
          setUploads((us) => us.filter((x) => x.key !== u.key))
          return
        }
        if (e instanceof ApiError && e.locked) {
          setUploads((us) => us.filter((x) => x.key !== u.key))
          handleApiError(e)
          return
        }
        const msg = e instanceof Error ? e.message : "Upload failed — try again."
        setUploads((us) => us.map((x) => (x.key === u.key ? { ...x, error: msg } : x)))
      }
    },
    [room, toast, notify, load, handleApiError],
  )

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return
    const files = Array.from(list)
    const tooBig = files.filter((f) => f.size > LIMITS.fileBytes)
    if (tooBig.length) toast("Upload failed — file too large (max 10 MB).", "error")
    const ok = files.filter((f) => f.size <= LIMITS.fileBytes && f.size > 0)
    for (const file of ok) {
      const u: Upload = {
        key: `${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        progress: 0,
        abort: new AbortController(),
        file,
        oneTime,
      }
      setUploads((us) => [...us, u])
      startUpload(u)
    }
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const retryUpload = (u: Upload) => {
    const fresh = { ...u, progress: 0, error: undefined, abort: new AbortController() }
    setUploads((us) => us.map((x) => (x.key === u.key ? fresh : x)))
    startUpload(fresh)
  }

  const deleteFile = async (f: RoomFile) => {
    setBusyFile(true)
    try {
      await api.deleteFile(room, f.id)
      notify()
      await load()
    } catch (e) {
      handleApiError(e)
    } finally {
      setBusyFile(false)
    }
  }

  const claimFile = async (f: RoomFile) => {
    if (!confirm(`"${f.name}" is view-once. It will be deleted for everyone after this download. Continue?`)) return
    setBusyFile(true)
    try {
      const { url } = await api.claimFile(room, f.id)
      window.location.assign(url)
      notify()
      await load()
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) {
        toast("This item was viewed and removed.", "error")
        await load()
      } else handleApiError(e)
    } finally {
      setBusyFile(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (!roomFull) addFiles(e.dataTransfer.files)
  }

  // Paste a file/screenshot anywhere on the page while in File mode.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (mode !== "file" || !e.clipboardData?.files.length) return
      e.preventDefault()
      addFiles(e.clipboardData.files)
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, oneTime])

  // ---------------------------------------------------------- lock
  const submitPassword = async (pw: string) => {
    try {
      const s = await api.getRoom(room, pw)
      setRoomPassword(room, pw)
      setState(s)
      setNeedsPassword(false)
      setDraft(s.text?.body ?? "")
      setEditing(!s.text || s.text.body === "" || s.text.oneTime)
      return null
    } catch (e) {
      return e instanceof Error ? e.message : "Wrong password."
    }
  }

  const lockRoom = async (pw: string) => {
    try {
      await api.lock(room, pw)
      setRoomPassword(room, pw)
      setDialog(null)
      toast("Room locked. Share the password separately from the link.")
      notify()
      await load()
    } catch (e) {
      handleApiError(e)
    }
  }

  const unlockRoom = async () => {
    try {
      await api.unlock(room)
      setRoomPassword(room, null)
      setDialog(null)
      toast("Lock removed. The room is public again.")
      notify()
      await load()
    } catch (e) {
      handleApiError(e)
    }
  }

  const loadHistory = useCallback(async () => (await api.history(room)).versions, [room])

  // ---------------------------------------------------------- render
  const showOneTimeWaiting = mode === "text" && text?.oneTime && revealed === null
  const charCount = draft.length
  const fileCount = state?.files.length ?? 0

  return (
    <div className={cn(t.root, "min-h-dvh")}>
      <Header />

      <main className="mx-auto w-full max-w-3xl px-5 pb-16">
        {/* Room identity */}
        <section className="mb-8 mt-8 sm:mt-14">
          <p className={cn("mb-1", t.dim)}>Your room</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <h1 className={cn("break-all text-4xl font-semibold tracking-tight sm:text-5xl", t.mono, t.fg)}>{room}</h1>
            <div className="flex items-center gap-2">
              <button onClick={copyLink} className={cn(t.secondary, t.focus)} aria-label="Copy room link">
                <LinkIcon className="h-4 w-4" /> Copy link
              </button>
              <button onClick={() => setDialog("qr")} className={cn(t.secondary, t.focus)} aria-label={`Show QR code for room ${room}`}>
                <QrCode className="h-4 w-4" /> QR
              </button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className={cn("inline-flex items-center gap-2", connected ? t.fg : t.dim)}>
              <span className={cn("h-2 w-2 rounded-full", connected ? "cc-live bg-[var(--cc-accent)]" : "bg-[var(--cc-dim)]")} />
              {connected ? (online > 1 ? `${online} devices here right now` : "Live. Open it on another device to sync") : "Connecting…"}
            </span>
            <button
              onClick={() => setDialog("lock")}
              disabled={!state}
              className={cn("inline-flex items-center gap-1.5 disabled:opacity-40", t.dim, "hover:text-[var(--cc-fg)]", t.focus)}
              aria-label={state?.locked ? "Manage room lock" : "Lock room"}
            >
              {state?.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
              {state?.locked ? "Locked with a password" : "Open to anyone with the link"}
            </button>
          </div>
        </section>

        {/* Text / Files switch */}
        <div role="tablist" aria-label="Content type" className={cn("mb-4 inline-flex rounded-full p-1", t.raised)}>
          {(["text", "file"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              aria-label={m === "text" ? "Text" : "File"}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-5 py-1.5 text-sm font-semibold transition-colors duration-150",
                t.focus,
                mode === m ? "bg-[var(--cc-accent)] text-[var(--cc-accent-ink)]" : cn(t.dim, "hover:text-[var(--cc-fg)]"),
              )}
            >
              {m === "text" ? "Text" : fileCount ? `Files (${fileCount})` : "Files"}
            </button>
          ))}
        </div>

        <section className={cn("rounded-3xl p-5 sm:p-7", t.surface)}>
          {!state ? (
            <div className={cn("flex items-center gap-3 py-8", t.dim)}>
              {needsPassword ? (
                <>
                  <Lock className="h-5 w-5" /> Waiting for the room password…
                </>
              ) : loadError ? (
                <>
                  <span className={t.red}>{loadError}</span>
                  <button onClick={load} className={cn(t.secondary, t.focus)}>
                    <RefreshCw className="h-4 w-4" /> Try again
                  </button>
                </>
              ) : (
                <>
                  <Spinner /> Opening room…
                </>
              )}
            </div>
          ) : mode === "text" ? (
            revealed !== null ? (
              <>
                <TextActions>
                  <span className={cn("mr-auto text-sm", t.dim)}>One-time message</span>
                  <button onClick={() => copyAndToast(revealed)} className={cn(t.secondary, t.focus)} aria-label="Copy text">
                    <Copy className="h-4 w-4" /> Copy
                  </button>
                  <button onClick={() => setRevealed(null)} className={cn(t.ghost, t.focus)}>
                    Close
                  </button>
                </TextActions>
                <Body>{revealed}</Body>
                <p className={cn("mt-5 rounded-2xl bg-[var(--cc-accent-soft)] px-4 py-3 text-sm", t.fg)}>
                  This message has now been deleted from the server, so copy it if you need it.
                </p>
              </>
            ) : showOneTimeWaiting ? (
              <div className="flex flex-col items-start gap-4 py-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--cc-accent)] text-[var(--cc-accent-ink)]">
                  <Sparkles className="h-5 w-5" />
                </span>
                {sentOneTime ? (
                  <>
                    <div>
                      <p className={cn("text-xl font-semibold", t.fg)}>Your one-time message is waiting</p>
                      <p className={t.dim}>It disappears as soon as someone opens it.</p>
                    </div>
                    <button onClick={() => { setSentOneTime(false); startEdit() }} className={cn(t.secondary, t.focus)}>
                      <Pencil className="h-4 w-4" /> Replace it
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <p className={cn("text-xl font-semibold", t.fg)}>Someone left you a one-time message</p>
                      <p className={t.dim}>It will be deleted for everyone once you open it.</p>
                    </div>
                    <button onClick={reveal} disabled={revealing} className={cn(t.primary, t.focus)}>
                      {revealing && <Spinner />} Reveal message
                    </button>
                  </>
                )}
              </div>
            ) : editing ? (
              <>
                {remoteChanged && (
                  <p className={cn("mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-[var(--cc-accent-soft)] px-4 py-2.5 text-sm", t.fg)}>
                    Someone just updated this on another device.
                    <button
                      onClick={() => { setDraft(text?.body ?? ""); setEditBase(text?.updatedAt ?? null) }}
                      className={cn("font-semibold", t.link)}
                    >
                      Load their version
                    </button>
                  </p>
                )}
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault()
                      postText()
                    }
                    if (e.key === "Escape" && text?.body) cancelEdit()
                  }}
                  placeholder="Paste or type text here..."
                  aria-label="Clipboard text"
                  autoFocus
                  spellCheck={false}
                  rows={9}
                  className={cn(
                    "min-h-[11rem] w-full resize-y bg-transparent text-[15px] leading-relaxed caret-[var(--cc-accent)] outline-none placeholder:text-[var(--cc-dim)]",
                    t.mono,
                    t.fg,
                  )}
                />
                <div className={cn("mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 border-t pt-4", t.line)}>
                  <OneTimeSwitch checked={oneTime} onChange={setOneTime} />
                  <span className={cn("text-sm tabular-nums", charCount > LIMITS.textChars ? t.red : t.dim)}>
                    {charCount.toLocaleString()} / {LIMITS.textChars.toLocaleString()}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    {text && text.body && (
                      <button onClick={cancelEdit} className={cn(t.ghost, t.focus)} aria-label="Cancel">
                        Cancel
                      </button>
                    )}
                    <button onClick={postText} disabled={posting || !draft.trim()} className={cn(t.primary, t.focus)} aria-label="Send / Post">
                      {posting ? <><Spinner /> Sending</> : posted ? <><Check className="h-4 w-4" /> Sent</> : <><Send className="h-4 w-4" /> Send</>}
                    </button>
                  </div>
                </div>
                {postError && <p className={cn("mt-3 text-sm", t.red)} role="alert">{postError}</p>}
                <p className={cn("mt-3 hidden text-xs sm:block", t.dim)}>Tip: Ctrl + Enter sends.</p>
              </>
            ) : (
              <>
                <TextActions>
                  <span className={cn("mr-auto text-sm", t.dim)}>
                    {text ? `Sent ${formatDistanceToNowStrict(new Date(text.updatedAt), { addSuffix: true })}` : ""}
                  </span>
                  <button onClick={() => setDialog("history")} className={cn(t.ghost, t.focus)} aria-label="Previous versions">
                    <History className="h-4 w-4" /> <span className="hidden sm:inline">History</span>
                  </button>
                  <button onClick={startEdit} className={cn(t.ghost, t.focus)} aria-label="Edit text">
                    <Pencil className="h-4 w-4" /> Edit
                  </button>
                  <button onClick={() => copyAndToast(text?.body ?? "")} className={cn(t.primary, "px-4 py-1.5 text-sm", t.focus)} aria-label="Copy text">
                    <Copy className="h-4 w-4" /> Copy
                  </button>
                </TextActions>
                <Body>{text?.body ?? ""}</Body>
              </>
            )
          ) : (
            <div className="space-y-5">
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload files: drop here or press Enter to choose"
                aria-disabled={roomFull}
                onClick={() => !roomFull && fileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !roomFull && (e.preventDefault(), fileInputRef.current?.click())}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center transition-colors duration-150",
                  fileCount ? "py-7" : "py-12",
                  t.focus,
                  dragOver ? "border-[var(--cc-accent)] bg-[var(--cc-accent-soft)]" : cn(t.line, "hover:border-[var(--cc-dim)]"),
                  roomFull && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--cc-accent)] text-[var(--cc-accent-ink)]">
                  <Upload className="h-5 w-5" />
                </span>
                <p className={cn("text-lg font-medium", t.fg)}>
                  Drop files here or <span className={t.link}>choose files</span>
                </p>
                <p className={cn("text-sm", t.dim)}>Up to 10 MB each. You can also paste a screenshot.</p>
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

              <OneTimeSwitch checked={oneTime} onChange={setOneTime} />

              {roomFull && <p className={t.red}>Upload failed — room storage limit reached (1 GB).</p>}
              {!roomFull && state.storageUsed > LIMITS.roomBytes * 0.8 && (
                <p className={t.dim}>This room is nearly full: {formatBytes(state.storageUsed)} of 1 GB used.</p>
              )}

              {uploads.length > 0 && (
                <ul className="space-y-3">
                  {uploads.map((u) => (
                    <li key={u.key}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className={cn("truncate font-medium", t.fg)}>{u.name}</span>
                        {u.error ? (
                          <span className="flex shrink-0 items-center gap-1">
                            <span className={t.red}>{u.error}</span>
                            <button onClick={() => retryUpload(u)} className={cn(t.ghost, t.focus)}>Retry</button>
                            <button onClick={() => setUploads((us) => us.filter((x) => x.key !== u.key))} className={cn(t.ghost, t.focus)} aria-label="Dismiss">
                              <X className="h-4 w-4" />
                            </button>
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-2">
                            <span className={cn("tabular-nums", t.dim)}>{u.progress}%</span>
                            <button onClick={() => u.abort.abort()} className={cn(t.ghost, t.focus)} aria-label={`Cancel upload of ${u.name}`}>
                              Cancel
                            </button>
                          </span>
                        )}
                      </div>
                      <div className={cn("h-1.5 overflow-hidden rounded-full", t.raised)}>
                        <div
                          className={cn("h-full rounded-full transition-[width] duration-200", u.error ? "bg-[var(--cc-red)]" : "bg-[var(--cc-accent)]")}
                          style={{ width: `${u.progress}%` }}
                          role="progressbar"
                          aria-valuenow={u.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {fileCount > 0 && <FileList files={state.files} disabled={busyFile} onDelete={deleteFile} onClaim={claimFile} />}
            </div>
          )}
        </section>

        <footer className={cn("mt-6 flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between", t.dim)}>
          <p>Text disappears after {LIMITS.textTtlDays} days, files after {LIMITS.fileTtlDays}.</p>
          <JoinRoom />
        </footer>
      </main>

      <Toasts toasts={toasts} dismiss={(id) => setToasts((ts) => ts.filter((x) => x.id !== id))} />
      <UnlockDialog open={needsPassword} room={room} onSubmit={submitPassword} />
      <QrDialog open={dialog === "qr"} url={roomUrl} onClose={() => setDialog(null)} onCopy={copyLink} />
      <LockDialog open={dialog === "lock"} locked={!!state?.locked} onClose={() => setDialog(null)} onLock={lockRoom} onUnlock={unlockRoom} />
      <HistoryDialog
        open={dialog === "history"}
        onClose={() => setDialog(null)}
        load={loadHistory}
        onRestore={(v) => {
          setDialog(null)
          setDraft(v.body)
          setEditBase(text?.updatedAt ?? null)
          setEditing(true)
          toast("Restored into the editor. Press Send to keep it.")
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------ pieces

function TextActions({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-1.5">{children}</div>
}

function Body({ children }: { children: ReactNode }) {
  return (
    <div className={cn("max-h-[55vh] overflow-auto whitespace-pre-wrap break-words text-[15px] leading-relaxed", t.mono, t.fg)}>
      {children || <span className={t.dim}>Nothing here yet.</span>}
    </div>
  )
}

function OneTimeSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      className="inline-flex cursor-pointer select-none items-center gap-2.5 text-sm"
      title="The item is deleted for everyone after the first person opens it."
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--cc-accent)]",
          checked ? "bg-[var(--cc-accent)]" : "bg-[var(--cc-line)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full transition-transform duration-150",
            checked ? "translate-x-[18px] bg-[var(--cc-accent-ink)]" : "translate-x-0.5 bg-[var(--cc-fg)]",
          )}
        />
      </span>
      <span className={checked ? t.fg : t.dim}>{checked ? "One-time view: deleted after it's opened once" : "One-time view"}</span>
    </label>
  )
}

function Header() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = !mounted || resolvedTheme === "dark"

  return (
    <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 pt-5">
      <a href="/" className={cn("inline-flex items-center gap-2.5 rounded-full", t.focus)} title="Start a new room">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--cc-accent)] text-[var(--cc-accent-ink)]">
          <ClipboardIcon className="h-[18px] w-[18px]" strokeWidth={2.4} />
        </span>
        <span className={cn("text-lg font-bold tracking-tight", t.fg)}>cloudclip</span>
      </a>
      <div className="flex items-center gap-1">
        <span className="hidden sm:block">
          <a href="/" className={cn(t.ghost, t.focus)}>
            <Plus className="h-4 w-4" /> New room
          </a>
        </span>
        <button
          onClick={() => setTheme(dark ? "light" : "dark")}
          className={cn(t.iconBtn, t.focus)}
          aria-pressed={dark}
          aria-label="Toggle light / dark"
          title="Toggle light / dark"
        >
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </header>
  )
}

function JoinRoom() {
  const [name, setName] = useState("")
  const valid = isValidRoom(name.trim())
  const go = (e: FormEvent) => {
    e.preventDefault()
    if (valid) window.location.assign(`/clip/${name.trim()}`)
  }
  return (
    <form onSubmit={go} className={cn("flex items-center gap-1 rounded-full py-1 pl-4 pr-1", t.raised)}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Have a room name?"
        aria-label="Room name to open"
        spellCheck={false}
        autoCapitalize="none"
        className={cn("w-40 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--cc-dim)] sm:w-44", t.mono, t.fg)}
      />
      <button
        type="submit"
        disabled={!valid}
        className="rounded-full bg-[var(--cc-fg)] px-3.5 py-1 text-sm font-semibold text-[var(--cc-bg)] disabled:opacity-30"
      >
        Open
      </button>
    </form>
  )
}
