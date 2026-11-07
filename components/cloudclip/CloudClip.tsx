"use client"

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { formatDistanceToNowStrict } from "date-fns"
import {
  Check,
  Copy,
  History,
  Lock,
  LockOpen,
  Moon,
  Pencil,
  QrCode,
  RefreshCw,
  Sun,
  UploadCloud,
  X,
  Zap,
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
    toast(ok ? "Copied!" : "Couldn't copy link", ok ? "success" : "error")
  }, [roomUrl, toast])

  const copyAndToast = async (value: string) => {
    const ok = await copyText(value)
    toast(ok ? "Copied!" : "Couldn't copy", ok ? "success" : "error")
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
      toast(copied ? `Posted to ${room} — URL copied to clipboard` : `Posted to ${room}`, "success", copied ? undefined : { label: "Copy link", onClick: copyLink })
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
      toast("Room locked. Share the password separately.")
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
      toast("Lock removed — room is public again.")
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

  return (
    <div className={cn("min-h-screen transition-colors duration-200", t.page)}>
      <Navbar room={room} online={online} live={connected} onCopy={copyLink} onQr={() => setDialog("qr")} />

      <main className="mx-auto max-w-lg px-4 py-6 sm:py-10 lg:max-w-3xl">
        <section className={cn("rounded-xl p-4 sm:p-6 transition-colors", t.card)}>
          {/* Room bar */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={cn("rounded-md px-2 py-1 font-mono text-sm bg-slate-100 dark:bg-slate-800", t.text)}
              title="Room names look like abcde12~ (5 letters, 2 digits, 1 symbol)"
            >
              {room}
            </span>
            <button onClick={copyLink} className={cn(t.ghostBtn, t.focus)} aria-label="Copy room link" title={`Room: ${room} · Copy`}>
              <Copy className="h-3.5 w-3.5" /> Copy link
            </button>
            {state?.locked && (
              <span className={cn(t.badge, "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300")}>
                <Lock className="h-3 w-3" /> Locked
              </span>
            )}
            <button
              onClick={() => setDialog("lock")}
              disabled={!state}
              className={cn(t.ghostBtn, t.focus, "ml-auto")}
              aria-label={state?.locked ? "Manage room lock" : "Lock room"}
            >
              {state?.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
              {state?.locked ? "Manage lock" : "Lock room"}
            </button>
          </div>

          {/* Mode switcher */}
          <div className="mb-5 grid w-full grid-cols-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800 sm:inline-grid sm:w-auto" role="tablist" aria-label="Content type">
            {(["text", "file"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn(
                  "h-9 rounded-full px-6 text-sm font-medium transition-all duration-[180ms] ease-out",
                  t.focus,
                  mode === m ? cn("text-white shadow-sm", t.accentBg) : cn(t.muted, "hover:text-slate-900 dark:hover:text-slate-100"),
                )}
              >
                {m === "text" ? "Text" : "File"}
                {m === "file" && state && state.files.length > 0 && (
                  <span className={cn("ml-1.5 rounded-full px-1.5 text-[11px]", mode === m ? "bg-white/25" : "bg-slate-200 dark:bg-slate-700")}>
                    {state.files.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          {!state ? (
            <div className="flex flex-col items-center gap-3 py-12">
              {needsPassword ? (
                <Lock className={cn("h-6 w-6", t.muted)} />
              ) : loadError ? (
                <>
                  <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
                  <button onClick={load} className={t.secondaryBtn}>
                    <RefreshCw className="h-4 w-4" /> Retry
                  </button>
                </>
              ) : (
                <Spinner className="h-6 w-6 text-slate-400" />
              )}
            </div>
          ) : mode === "text" ? (
            <div className="mb-5">
              {revealed !== null ? (
                <ReadView
                  label="One-time message"
                  body={revealed}
                  note="This message has been deleted from the server. Copy it now if you need it."
                  onCopy={() => copyAndToast(revealed)}
                  extra={
                    <button onClick={() => setRevealed(null)} className={t.ghostBtn}>
                      <X className="h-3.5 w-3.5" /> Close
                    </button>
                  }
                />
              ) : showOneTimeWaiting ? (
                <div className={cn("rounded-lg p-6 text-center", t.surface)}>
                  <Zap className="mx-auto mb-2 h-6 w-6 text-amber-500" />
                  {sentOneTime ? (
                    <>
                      <p className={cn("font-medium", t.text)}>One-time message posted</p>
                      <p className={cn("mt-1 text-sm", t.muted)}>It will be deleted after someone opens it.</p>
                      <button onClick={() => { setSentOneTime(false); startEdit() }} className={cn(t.secondaryBtn, "mt-4")}>
                        <Pencil className="h-4 w-4" /> Replace it
                      </button>
                    </>
                  ) : (
                    <>
                      <p className={cn("font-medium", t.text)}>A one-time message is waiting</p>
                      <p className={cn("mt-1 text-sm", t.muted)}>Opening it deletes it for everyone.</p>
                      <button onClick={reveal} disabled={revealing} className={cn(t.primaryBtn, "mt-4 px-5 py-2")}>
                        {revealing ? <Spinner /> : null} Reveal message
                      </button>
                    </>
                  )}
                </div>
              ) : editing ? (
                <div>
                  {remoteChanged && (
                    <div className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:bg-cyan-400/10 dark:text-cyan-200">
                      <span>Updated on another device.</span>
                      <button onClick={() => { setDraft(text?.body ?? ""); setEditBase(text?.updatedAt ?? null) }} className="font-semibold underline underline-offset-2">
                        Load latest
                      </button>
                    </div>
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
                    }}
                    placeholder="Paste or type text here..."
                    aria-label="Clipboard text"
                    className={cn("min-h-[120px] w-full resize-y rounded-lg p-4 font-mono text-sm sm:min-h-[140px]", t.input, t.focus)}
                    rows={8}
                  />
                  <div className={cn("mt-1 flex justify-between text-xs", t.muted)}>
                    <span className="hidden sm:inline">Ctrl + Enter to post</span>
                    <span className={charCount > LIMITS.textChars ? "text-red-600 dark:text-red-400" : ""}>
                      {charCount.toLocaleString()} / {LIMITS.textChars.toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <ReadView
                  label="Text"
                  body={text?.body ?? ""}
                  note={text ? `Last updated ${formatDistanceToNowStrict(new Date(text.updatedAt), { addSuffix: true })}` : undefined}
                  onCopy={() => copyAndToast(text?.body ?? "")}
                  extra={
                    <>
                      <button onClick={() => setDialog("history")} className={t.ghostBtn} aria-label="Previous versions">
                        <History className="h-3.5 w-3.5" /> <span className="hidden sm:inline">History</span>
                      </button>
                      <button onClick={startEdit} className={t.ghostBtn} aria-label="Edit text">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                    </>
                  }
                />
              )}
            </div>
          ) : (
            <div className="mb-5 space-y-4">
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload files: drop here or press Enter to choose"
                aria-disabled={roomFull}
                onClick={() => !roomFull && fileInputRef.current?.click()}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !roomFull && (e.preventDefault(), fileInputRef.current?.click())}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  "cursor-pointer rounded-lg text-center transition-all duration-[120ms]",
                  t.focus,
                  state && state.files.length > 0 ? "p-5" : "p-8 sm:p-10",
                  dragOver
                    ? "border-[3px] border-dashed border-sky-400 bg-sky-50 dark:border-cyan-400 dark:bg-cyan-400/10"
                    : "border-2 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-500 dark:hover:bg-slate-800/40",
                  roomFull && "cursor-not-allowed opacity-60",
                )}
              >
                <UploadCloud className={cn("mx-auto mb-2", state && state.files.length > 0 ? "h-7 w-7" : "h-12 w-12", t.muted)} />
                <p className={cn("text-base", t.text)}>Drop your file here or click to upload (max 10 MB)</p>
                <p className={cn("mt-1 text-xs", t.muted)}>All file types allowed · you can also paste a screenshot</p>
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

              {roomFull && <p className="text-sm text-red-600 dark:text-red-400">Upload failed — room storage limit reached (1 GB).</p>}
              {!roomFull && state && state.storageUsed > LIMITS.roomBytes * 0.8 && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Room storage almost full: {formatBytes(state.storageUsed)} of 1 GB used.
                </p>
              )}

              {uploads.length > 0 && (
                <ul className="space-y-2">
                  {uploads.map((u) => (
                    <li key={u.key} className={cn("rounded-lg p-3", t.surface)}>
                      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
                        <span className={cn("truncate", t.text)}>{u.name}</span>
                        {u.error ? (
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="text-red-600 dark:text-red-400">{u.error}</span>
                            <button onClick={() => retryUpload(u)} className={t.ghostBtn}>
                              <RefreshCw className="h-3.5 w-3.5" /> Retry
                            </button>
                            <button onClick={() => setUploads((us) => us.filter((x) => x.key !== u.key))} className={t.ghostBtn} aria-label="Dismiss">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        ) : (
                          <span className="flex shrink-0 items-center gap-2">
                            <span className={t.muted}>{u.progress}%</span>
                            <button onClick={() => u.abort.abort()} className={t.ghostBtn} aria-label={`Cancel upload of ${u.name}`}>
                              Cancel
                            </button>
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                        <div
                          className={cn("h-full transition-all", u.error ? "bg-red-500" : t.accentBg)}
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

              {state && state.files.length > 0 && (
                <FileList files={state.files} disabled={busyFile} onDelete={deleteFile} onClaim={claimFile} />
              )}
            </div>
          )}

          {/* Options */}
          {state && (
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex cursor-pointer items-start gap-2" title="When enabled, the item will be permanently deleted after the first viewer downloads/reads it.">
                <input
                  type="checkbox"
                  checked={oneTime}
                  onChange={(e) => setOneTime(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#0EA5E9] dark:accent-[#06B6D4]"
                />
                <span className={cn("text-sm", t.muted)}>
                  Enable one-time view (auto-delete after first access)
                  {oneTime && (
                    <span className="block text-xs text-amber-700 dark:text-amber-300">
                      This {mode === "text" ? "text" : "file"} will be deleted after someone views it once.
                    </span>
                  )}
                </span>
              </label>
              <span className={cn("text-xs", t.muted)}>
                Text TTL: {LIMITS.textTtlDays} days · File TTL: {LIMITS.fileTtlDays} days
              </span>
            </div>
          )}

          {/* Action row (text mode; files upload as soon as they're chosen) */}
          {state && mode === "text" && editing && !showOneTimeWaiting && revealed === null && (
            <div className="flex flex-col items-center gap-2">
              <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
                {text && text.body && (
                  <button onClick={cancelEdit} className={cn(t.ghostBtn, "justify-center px-4 py-2 text-sm")}>
                    Cancel
                  </button>
                )}
                <button onClick={postText} disabled={posting || !draft.trim()} className={cn(t.primaryBtn, t.focus, "w-full sm:w-auto")}>
                  {posting ? (
                    <>
                      <Spinner /> Posting...
                    </>
                  ) : posted ? (
                    <>
                      <Check className="h-4 w-4" /> Posted
                    </>
                  ) : (
                    "Send / Post"
                  )}
                </button>
              </div>
              {postError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{postError}</p>}
            </div>
          )}

          <p className={cn("mt-6 text-center text-sm", t.muted)}>
            {state?.locked ? "Room is locked — only people with the password can see or edit it." : "Room is public and editable by default. Lock the room to prevent edits."}
          </p>
        </section>

        <JoinRoom />
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
          toast("Version restored into the editor — press Send / Post to save it.")
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------ pieces

function ReadView({
  label,
  body,
  note,
  onCopy,
  extra,
}: {
  label: string
  body: string
  note?: string
  onCopy: () => void
  extra?: ReactNode
}) {
  return (
    <div className={cn("rounded-lg p-4", t.surface)}>
      <div className="mb-2 flex items-center gap-1">
        <span className={cn("mr-auto text-sm", t.muted)}>{label}</span>
        <button onClick={onCopy} className={t.ghostBtn} aria-label="Copy text">
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
        {extra}
      </div>
      <div className={cn("max-h-[50vh] overflow-auto whitespace-pre-wrap break-words font-mono text-sm", t.text)}>{body || "No content"}</div>
      {note && <p className={cn("mt-3 text-xs", t.muted)}>{note}</p>}
    </div>
  )
}

function Navbar({ room, online, live, onCopy, onQr }: { room: string; online: number; live: boolean; onCopy: () => void; onQr: () => void }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === "dark"

  return (
    <nav className={cn("sticky top-0 z-40 h-16", t.nav)}>
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4">
        <a href="/" className={cn("text-lg font-semibold", t.text)} title="New room">
          CloudClip
        </a>
        <div className="flex items-center gap-1 sm:gap-2">
          <span
            className={cn("mr-1 hidden items-center gap-1.5 text-xs sm:flex", t.muted)}
            title={live ? "Live sync on — changes appear instantly on every device" : "Connecting… (falling back to refresh every 5 s)"}
          >
            <span className={cn("h-2 w-2 rounded-full", live ? "bg-emerald-500" : "bg-slate-400")} />
            {live ? `${online} ${online === 1 ? "device" : "devices"} here` : "Connecting…"}
          </span>
          <button onClick={onQr} className={cn(t.iconBtn, t.focus)} aria-label={`Show QR code for room ${room}`} title="Open on phone">
            <QrCode className="h-5 w-5" />
          </button>
          <button onClick={onCopy} className={cn(t.iconBtn, t.focus)} aria-label="Copy room link" title={`Room: ${room} · Copy`}>
            <Copy className="h-5 w-5" />
          </button>
          <button
            onClick={() => setTheme(dark ? "light" : "dark")}
            className={cn(t.iconBtn, t.focus)}
            aria-pressed={dark}
            aria-label="Toggle light / dark"
            title="Toggle light / dark"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </nav>
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
    <form onSubmit={go} className="mx-auto mt-6 flex max-w-sm items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Open another room…"
        aria-label="Room name to open"
        className={cn("flex-1 rounded-lg px-3 py-2 font-mono text-sm", t.input, t.focus)}
      />
      <button type="submit" disabled={!valid} className={t.secondaryBtn}>
        Open
      </button>
    </form>
  )
}
