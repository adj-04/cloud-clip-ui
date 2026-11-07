"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNowStrict } from "date-fns"
import { formatBytes, type RoomFile } from "@/lib/room"
import { cn, Spinner, t } from "./ui"

type Kind = "image" | "video" | "audio" | "pdf" | "text" | "other"

const TEXT_EXT = /\.(txt|md|csv|tsv|json|xml|ya?ml|log|ini|toml|py|js|ts|tsx|jsx|r|sh|html|css|sql|c|cpp|h|java|go|rs)$/i
const MAX_TEXT_PREVIEW = 256 * 1024

function kindOf(f: RoomFile): Kind {
  const m = f.mime || ""
  if (m.startsWith("image/")) return "image"
  if (m.startsWith("video/")) return "video"
  if (m.startsWith("audio/")) return "audio"
  if (m === "application/pdf" || /\.pdf$/i.test(f.name)) return "pdf"
  if ((m.startsWith("text/") || m === "application/json" || TEXT_EXT.test(f.name)) && f.size <= MAX_TEXT_PREVIEW) return "text"
  return "other"
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((s) => alive && setText(s))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [url])
  if (failed) return <p className={t.dim}>Preview unavailable.</p>
  if (text === null) return <p className={t.dim}><Spinner /> loading</p>
  return <pre className={cn("max-h-72 overflow-auto whitespace-pre-wrap break-words text-[13px]", t.fg)}>{text}</pre>
}

function Preview({ file, kind }: { file: RoomFile; kind: Kind }) {
  if (!file.url) return null
  switch (kind) {
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={file.url} alt={file.name} className="max-h-96 w-auto" />
    case "video":
      return <video src={file.url} controls className="max-h-96 w-full" />
    case "audio":
      return <audio src={file.url} controls className="w-full" />
    case "pdf":
      return <iframe src={file.url} title={file.name} className="h-96 w-full bg-white" />
    case "text":
      return <TextPreview url={file.url} />
    default:
      return null
  }
}

const ago = (d: string) => formatDistanceToNowStrict(new Date(d), { addSuffix: true })

/** `ls -l`-style listing: size, age, name, then commands. */
export function FileList({
  files,
  disabled,
  onDelete,
  onClaim,
}: {
  files: RoomFile[]
  disabled?: boolean
  onDelete: (f: RoomFile) => void
  onClaim: (f: RoomFile) => void
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  return (
    <ul className="space-y-1">
      {files.map((f) => {
        const kind = kindOf(f)
        const canPreview = !f.oneTime && kind !== "other" && !!f.url
        const isOpen = open[f.id] ?? false
        return (
          <li key={f.id}>
            <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-0.5 sm:grid-cols-[8ch_14ch_1fr_auto]">
              <span className={cn("hidden text-right sm:block", t.dim)}>{formatBytes(f.size)}</span>
              <span className={cn("hidden sm:block", t.dim)} title={`expires ${ago(f.expiresAt)}`}>
                {ago(f.createdAt)}
              </span>
              <span className="min-w-0">
                <span className={cn("block truncate", f.oneTime ? t.yellow : t.fg)} title={f.name}>
                  {f.name}
                  {f.oneTime && <span className={t.dim}> (view once)</span>}
                </span>
                <span className={cn("block text-[12px] sm:hidden", t.dim)}>
                  {formatBytes(f.size)}, {ago(f.createdAt)}
                </span>
              </span>
              <span className="flex items-center whitespace-nowrap">
                {canPreview && (
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [f.id]: !isOpen }))}
                    className={cn(t.cmdDim, t.focus)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Hide" : "Show"} preview of ${f.name}`}
                  >
                    {isOpen ? "hide" : "view"}
                  </button>
                )}
                {f.oneTime ? (
                  <button onClick={() => onClaim(f)} disabled={disabled} className={cn(t.cmd, t.focus)}>
                    download once
                  </button>
                ) : (
                  <a href={f.downloadUrl} className={cn(t.cmd, t.focus)} aria-label={`Download ${f.name}`}>
                    get
                  </a>
                )}
                {!f.oneTime && (
                  <button
                    onClick={() => onDelete(f)}
                    disabled={disabled}
                    className={cn(t.cmdDim, "hover:bg-[var(--cc-red)]", t.focus)}
                    aria-label={`Delete ${f.name}`}
                  >
                    rm
                  </button>
                )}
              </span>
            </div>
            {canPreview && isOpen && (
              <div className={cn("my-2 border-l-2 pl-3 sm:ml-[calc(22ch+1.5rem)]", t.line)}>
                <Preview file={f} kind={kind} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
