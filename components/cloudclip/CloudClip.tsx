"use client"

import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { formatDistanceToNowStrict } from "date-fns"
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
      toast(copied ? `Posted to ${room}, link copied` : `Posted to ${room}`, "success", copied ? undefined : { label: "copy link", onClick: copyLink })
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
    <div className={cn(t.root, "flex min-h-dvh flex-col items-center sm:justify-center sm:p-6")}>
      <div className={cn("flex w-full max-w-3xl flex-1 flex-col sm:min-h-[30rem] sm:flex-none sm:shadow-2xl", t.win)}>
        <TopBar
          mode={mode}
          setMode={setMode}
          fileCount={fileCount}
          room={room}
          onCopy={copyLink}
          onQr={() => setDialog("qr")}
        />

        <main className="flex-1 px-4 py-5 sm:px-6">
          {!state ? (
            <p className={t.dim}>
              {needsPassword ? (
                "Waiting for the room password."
              ) : loadError ? (
                <>
                  <span className={t.red}>✗ {loadError}</span>{" "}
                  <button onClick={load} className={cn(t.cmd, t.focus)}>
                    retry
                  </button>
                </>
              ) : (
                <>
                  <Prompt cmd={`open ${room}`} /> <span className="cc-cursor" />
                </>
              )}
            </p>
          ) : mode === "text" ? (
            <section aria-label="Text">
              {revealed !== null ? (
                <>
                  <PromptRow cmd="cat clip">
                    <button onClick={() => copyAndToast(revealed)} className={cn(t.cmd, t.focus)} aria-label="Copy text">
                      copy
                    </button>
                    <button onClick={() => setRevealed(null)} className={cn(t.cmdDim, t.focus)}>
                      close
                    </button>
                  </PromptRow>
                  <Output>{revealed}</Output>
                  <p className={cn("mt-3", t.yellow)}>This message has been deleted from the server. Copy it now if you need it.</p>
                </>
              ) : showOneTimeWaiting ? (
                <>
                  <PromptRow cmd="cat clip" />
                  {sentOneTime ? (
                    <div className="space-y-3">
                      <p className={t.green}>✓ One-time message posted. It disappears after someone opens it.</p>
                      <button onClick={() => { setSentOneTime(false); startEdit() }} className={cn(t.cmd, t.focus)}>
                        replace it
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className={t.yellow}>A one-time message is waiting. Reading it deletes it for everyone.</p>
                      <button onClick={reveal} disabled={revealing} className={cn(t.primary, t.focus)} aria-label="Reveal message">
                        {revealing && <Spinner />} reveal
                      </button>
                    </div>
                  )}
                </>
              ) : editing ? (
                <>
                  {remoteChanged && (
                    <p className={cn("mb-3", t.yellow)}>
                      Updated on another device.{" "}
                      <button
                        onClick={() => { setDraft(text?.body ?? ""); setEditBase(text?.updatedAt ?? null) }}
                        className={cn(t.cmd, t.focus)}
                      >
                        load latest
                      </button>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <span className={cn("select-none pt-[2px]", t.blue)} aria-hidden>
                      $
                    </span>
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
                      rows={10}
                      className={cn(
                        "min-h-[9rem] w-full resize-y bg-transparent caret-[var(--cc-blue)] outline-none placeholder:text-[var(--cc-dim)]",
                        t.fg,
                      )}
                    />
                  </div>
                  <div className={cn("mt-2 flex items-center justify-between border-t pt-3", t.line)}>
                    <OneTimeToggle checked={oneTime} onChange={setOneTime} what="text" />
                    <span className={cn("text-[13px]", charCount > LIMITS.textChars ? t.red : t.dim)}>
                      {charCount.toLocaleString()}/{LIMITS.textChars.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                    {postError && <span className={cn("mr-auto", t.red)} role="alert">✗ {postError}</span>}
                    {text && text.body && (
                      <button onClick={cancelEdit} className={cn(t.cmdDim, t.focus)} aria-label="Cancel">
                        cancel <Key>esc</Key>
                      </button>
                    )}
                    <button onClick={postText} disabled={posting || !draft.trim()} className={cn(t.primary, t.focus)} aria-label="Send / Post">
                      {posting ? <><Spinner /> posting</> : posted ? "posted" : <>post <Key inverse>ctrl ⏎</Key></>}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <PromptRow cmd="cat clip">
                    <button onClick={() => copyAndToast(text?.body ?? "")} className={cn(t.cmd, t.focus)} aria-label="Copy text">
                      copy
                    </button>
                    <button onClick={() => setDialog("history")} className={cn(t.cmdDim, t.focus)} aria-label="Previous versions">
                      history
                    </button>
                    <button onClick={startEdit} className={cn(t.cmd, t.focus)} aria-label="Edit text">
                      edit
                    </button>
                  </PromptRow>
                  <Output>{text?.body ?? ""}</Output>
                  {text && (
                    <p className={cn("mt-4 text-[13px]", t.dim)}>
                      # updated {formatDistanceToNowStrict(new Date(text.updatedAt), { addSuffix: true })}, deleted{" "}
                      {formatDistanceToNowStrict(new Date(text.expiresAt), { addSuffix: true })}
                    </p>
                  )}
                </>
              )}
            </section>
          ) : (
            <section aria-label="Files" className="space-y-4">
              <PromptRow cmd={`ls ${room}`} />
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
                  "cursor-pointer border border-dashed px-4 py-6 text-center transition-colors",
                  t.focus,
                  dragOver ? "border-[var(--cc-blue)] bg-[var(--cc-sel)]" : cn(t.line, "hover:border-[var(--cc-dim)]"),
                  roomFull && "cursor-not-allowed opacity-50",
                )}
              >
                <p className={t.fg}>
                  Drop files here, paste a screenshot, or <span className={cn(t.blue, "underline underline-offset-4")}>choose files</span>
                </p>
                <p className={cn("mt-1 text-[13px]", t.dim)}>Up to 10 MB each. Kept for {LIMITS.fileTtlDays} days.</p>
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />

              <OneTimeToggle checked={oneTime} onChange={setOneTime} what="files you add next" />

              {roomFull && <p className={t.red}>✗ Upload failed — room storage limit reached (1 GB).</p>}
              {!roomFull && state.storageUsed > LIMITS.roomBytes * 0.8 && (
                <p className={t.yellow}>Room storage almost full: {formatBytes(state.storageUsed)} of 1 GB used.</p>
              )}

              {uploads.length > 0 && (
                <ul className="space-y-1">
                  {uploads.map((u) => (
                    <li key={u.key} className="flex flex-wrap items-center gap-x-3">
                      <span className={cn("min-w-0 flex-1 truncate", t.fg)}>{u.name}</span>
                      {u.error ? (
                        <>
                          <span className={t.red}>✗ {u.error}</span>
                          <button onClick={() => retryUpload(u)} className={cn(t.cmd, t.focus)}>retry</button>
                          <button onClick={() => setUploads((us) => us.filter((x) => x.key !== u.key))} className={cn(t.cmdDim, t.focus)} aria-label="Dismiss">
                            dismiss
                          </button>
                        </>
                      ) : (
                        <>
                          <Bar pct={u.progress} />
                          <button onClick={() => u.abort.abort()} className={cn(t.cmdDim, t.focus)} aria-label={`Cancel upload of ${u.name}`}>
                            cancel
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {fileCount > 0 ? (
                <FileList files={state.files} disabled={busyFile} onDelete={deleteFile} onClaim={claimFile} />
              ) : (
                uploads.length === 0 && <p className={t.dim}>No files in this room yet.</p>
              )}
            </section>
          )}
        </main>

        <StatusLine
          room={room}
          locked={!!state?.locked}
          live={connected}
          online={online}
          canLock={!!state}
          onLock={() => setDialog("lock")}
        />
      </div>

      <JoinRoom />

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
          toast("Version restored into the editor. Post it to save.")
        }}
      />
    </div>
  )
}

// ------------------------------------------------------------ pieces

function Prompt({ cmd }: { cmd: string }) {
  return (
    <span>
      <span className={t.blue}>$</span> <span className={t.fg}>{cmd}</span>
    </span>
  )
}

function PromptRow({ cmd, children }: { cmd: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <Prompt cmd={cmd} />
      {children && <div className="flex items-center gap-1">{children}</div>}
    </div>
  )
}

function Output({ children }: { children: ReactNode }) {
  return <div className={cn("max-h-[55vh] overflow-auto whitespace-pre-wrap break-words", t.fg)}>{children || <span className={t.dim}>(empty)</span>}</div>
}

function Key({ children, inverse }: { children: ReactNode; inverse?: boolean }) {
  return <kbd className={cn("ml-1 hidden px-1 text-[12px] font-normal sm:inline", inverse ? "opacity-60" : t.dim)}>{children}</kbd>
}

/** Text progress bar: [██████░░░░] 60% */
function Bar({ pct }: { pct: number }) {
  const width = 16
  const filled = Math.round((pct / 100) * width)
  return (
    <span role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="whitespace-nowrap">
      <span className={t.blue}>{"█".repeat(filled)}</span>
      <span className={t.dim}>{"░".repeat(width - filled)}</span>
      <span className={cn("ml-2 inline-block w-[4ch] text-right", t.dim)}>{pct}%</span>
    </span>
  )
}

function OneTimeToggle({ checked, onChange, what }: { checked: boolean; onChange: (v: boolean) => void; what: string }) {
  return (
    <label
      className="flex cursor-pointer select-none items-center gap-2"
      title="When enabled, the item is permanently deleted after the first person opens it."
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={cn("peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[var(--cc-blue)]", checked ? t.yellow : t.dim)} aria-hidden>
        [{checked ? "x" : " "}]
      </span>
      <span className={checked ? t.yellow : t.dim}>
        one-time view{checked ? `: ${what} will be deleted after the first view` : ""}
      </span>
    </label>
  )
}

function TopBar({
  mode,
  setMode,
  fileCount,
  room,
  onCopy,
  onQr,
}: {
  mode: "text" | "file"
  setMode: (m: "text" | "file") => void
  fileCount: number
  room: string
  onCopy: () => void
  onQr: () => void
}) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = !mounted || resolvedTheme === "dark"

  const tabs: { id: "text" | "file"; label: string }[] = [
    { id: "text", label: "0:text" },
    { id: "file", label: fileCount ? `1:files(${fileCount})` : "1:files" },
  ]

  return (
    <header className={cn("flex items-center gap-4 border-b px-3 py-1.5 text-[13px] sm:px-4", t.bar)}>
      <a href="/" className={cn("font-semibold", t.fg, t.focus)} title="Start a new room">
        cloudclip
      </a>
      <nav role="tablist" aria-label="Content type" className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={mode === tab.id}
            aria-label={tab.id === "text" ? "Text" : "File"}
            onClick={() => setMode(tab.id)}
            className={cn(
              "px-1.5",
              t.focus,
              mode === tab.id ? "bg-[var(--cc-fg)] text-[var(--cc-bar)]" : cn(t.dim, "hover:text-[var(--cc-fg)]"),
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1">
        <button onClick={onQr} className={cn(t.cmdDim, t.focus)} aria-label={`Show QR code for room ${room}`} title="Open on your phone">
          qr
        </button>
        <button onClick={onCopy} className={cn(t.cmdDim, t.focus)} aria-label="Copy room link" title="Copy room link">
          link
        </button>
        <button
          onClick={() => setTheme(dark ? "light" : "dark")}
          className={cn(t.cmdDim, t.focus)}
          aria-pressed={dark}
          aria-label="Toggle light / dark"
          title="Toggle light / dark"
        >
          {dark ? "light" : "dark"}
        </button>
      </div>
    </header>
  )
}

/** tmux-style status line: room, access, connection, expiry. */
function StatusLine({
  room,
  locked,
  live,
  online,
  canLock,
  onLock,
}: {
  room: string
  locked: boolean
  live: boolean
  online: number
  canLock: boolean
  onLock: () => void
}) {
  return (
    <footer className={cn("flex flex-wrap items-stretch border-t text-[13px]", t.bar)}>
      <span className="bg-[var(--cc-blue)] px-3 py-1 font-medium text-[var(--cc-win)]" title="Room name">
        {room}
      </span>
      <button
        onClick={onLock}
        disabled={!canLock}
        className={cn("px-3 py-1 hover:bg-[var(--cc-line)] disabled:opacity-50", locked ? t.yellow : t.dim, t.focus)}
        aria-label={locked ? "Manage room lock" : "Lock room"}
        title={locked ? "Password required. Click to change or remove." : "Anyone with the link can read and edit. Click to lock."}
      >
        {locked ? "locked" : "public"}
      </button>
      <span
        className={cn("px-3 py-1", live ? t.green : t.dim)}
        title={live ? "Changes appear instantly on every open device" : "Live sync unavailable; checking every 5 seconds"}
      >
        {live ? `● ${online} online` : "○ connecting"}
      </span>
      <span className={cn("ml-auto hidden px-3 py-1 sm:inline", t.dim)}>
        text {LIMITS.textTtlDays}d, files {LIMITS.fileTtlDays}d
      </span>
    </footer>
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
    <form onSubmit={go} className="cc-root flex w-full max-w-3xl items-center gap-2 px-4 py-4 text-[13px] sm:px-0">
      <label htmlFor="join-room" className={t.dim}>
        open another room:
      </label>
      <input
        id="join-room"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Room name to open"
        spellCheck={false}
        autoCapitalize="none"
        className={cn("min-w-0 flex-1 border-b px-1 py-0.5", t.line, "bg-transparent outline-none focus:border-[var(--cc-blue)]", t.fg)}
      />
      <button type="submit" disabled={!valid} className={cn(t.cmd, t.focus)}>
        open
      </button>
    </form>
  )
}
