"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNowStrict } from "date-fns"
import { Download, Eye, EyeOff, FileIcon, FileText, Film, Music, Trash2 } from "lucide-react"
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

const KIND_ICON = { image: FileIcon, video: Film, audio: Music, pdf: FileText, text: FileText, other: FileIcon }

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
  if (failed) return <p className={cn("text-sm", t.dim)}>Couldn&apos;t load a preview.</p>
  if (text === null) return <Spinner className={cn("h-4 w-4", t.dim)} />
  return <pre className={cn("max-h-72 overflow-auto whitespace-pre-wrap break-words text-[13px]", t.mono, t.fg)}>{text}</pre>
}

function Preview({ file, kind }: { file: RoomFile; kind: Kind }) {
  if (!file.url) return null
  switch (kind) {
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={file.url} alt={file.name} className="max-h-[28rem] w-auto rounded-xl" />
    case "video":
      return <video src={file.url} controls className="max-h-[28rem] w-full rounded-xl" />
    case "audio":
      return <audio src={file.url} controls className="w-full" />
    case "pdf":
      return <iframe src={file.url} title={file.name} className="h-[28rem] w-full rounded-xl bg-white" />
    case "text":
      return <TextPreview url={file.url} />
    default:
      return null
  }
}

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
    <ul className={cn("divide-y overflow-hidden rounded-2xl border", t.line, "divide-[var(--cc-line)]")}>
      {files.map((f) => {
        const kind = kindOf(f)
        const Icon = KIND_ICON[kind]
        const canPreview = !f.oneTime && kind !== "other" && !!f.url
        const isOpen = open[f.id] ?? false
        return (
          <li key={f.id} className="p-3 sm:p-4">
            <div className="flex items-center gap-3">
              {kind === "image" && f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", t.raised, t.dim)}>
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-medium", t.fg)} title={f.name}>
                  {f.name}
                </p>
                <p className={cn("text-sm", t.dim)}>
                  {formatBytes(f.size)}, added {formatDistanceToNowStrict(new Date(f.createdAt), { addSuffix: true })}
                  {f.oneTime && (
                    <span className="ml-2 rounded-full bg-[var(--cc-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--cc-fg)]">
                      opens once
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {canPreview && (
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [f.id]: !isOpen }))}
                    className={cn(t.iconBtn, t.focus)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Hide" : "Show"} preview of ${f.name}`}
                    title={isOpen ? "Hide preview" : "Preview"}
                  >
                    {isOpen ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                  </button>
                )}
                {f.oneTime ? (
                  <button onClick={() => onClaim(f)} disabled={disabled} className={cn(t.secondary, t.focus)}>
                    <Download className="h-4 w-4" /> Download once
                  </button>
                ) : (
                  <a href={f.downloadUrl} className={cn(t.iconBtn, t.focus)} aria-label={`Download ${f.name}`} title="Download">
                    <Download className="h-[18px] w-[18px]" />
                  </a>
                )}
                {!f.oneTime && (
                  <button
                    onClick={() => onDelete(f)}
                    disabled={disabled}
                    className={cn(t.iconBtn, "hover:text-[var(--cc-red)]", t.focus)}
                    aria-label={`Delete ${f.name}`}
                    title="Delete"
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                )}
              </div>
            </div>
            {canPreview && isOpen && (
              <div className={cn("mt-3 rounded-xl p-2", t.raised)}>
                <Preview file={f} kind={kind} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
