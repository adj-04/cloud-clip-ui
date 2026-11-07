"use client"

import { useEffect, useState } from "react"
import { formatDistanceToNowStrict } from "date-fns"
import { Download, Eye, EyeOff, FileIcon, FileText, Film, ImageIcon, Music, Trash2, Zap } from "lucide-react"
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

const KIND_ICON = { image: ImageIcon, video: Film, audio: Music, pdf: FileText, text: FileText, other: FileIcon }

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
  if (failed) return <p className={cn("text-sm", t.muted)}>Preview unavailable.</p>
  if (text === null) return <Spinner className="h-4 w-4 text-slate-400" />
  return <pre className={cn("max-h-72 overflow-auto rounded-md p-3 text-xs font-mono whitespace-pre-wrap break-words", t.surface, t.text)}>{text}</pre>
}

function Preview({ file, kind }: { file: RoomFile; kind: Kind }) {
  if (!file.url) return null
  switch (kind) {
    case "image":
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={file.url} alt={file.name} className="max-h-96 w-auto rounded-md border border-slate-200 dark:border-slate-700" />
    case "video":
      return <video src={file.url} controls className="max-h-96 w-full rounded-md" />
    case "audio":
      return <audio src={file.url} controls className="w-full" />
    case "pdf":
      return <iframe src={file.url} title={file.name} className="h-96 w-full rounded-md border border-slate-200 dark:border-slate-700" />
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
    <ul className="space-y-3">
      {files.map((f) => {
        const kind = kindOf(f)
        const Icon = KIND_ICON[kind]
        const canPreview = !f.oneTime && kind !== "other" && !!f.url
        const isOpen = open[f.id] ?? false
        return (
          <li key={f.id} className={cn("rounded-lg p-3", t.surface)}>
            <div className="flex items-center gap-3">
              {kind === "image" && f.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              ) : (
                <Icon className={cn("h-8 w-8 shrink-0", t.muted)} aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-medium", t.text)} title={f.name}>
                  {f.name}
                </p>
                <p className={cn("text-xs", t.muted)}>
                  {formatBytes(f.size)} · uploaded {formatDistanceToNowStrict(new Date(f.createdAt), { addSuffix: true })} ·
                  expires in {formatDistanceToNowStrict(new Date(f.expiresAt))}
                  {f.oneTime && (
                    <span className={cn(t.badge, "ml-2 bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300")}>
                      <Zap className="h-3 w-3" /> View once
                    </span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {canPreview && (
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [f.id]: !isOpen }))}
                    className={t.ghostBtn}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Hide" : "Show"} preview of ${f.name}`}
                  >
                    {isOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="hidden sm:inline">{isOpen ? "Hide" : "Preview"}</span>
                  </button>
                )}
                {f.oneTime ? (
                  <button onClick={() => onClaim(f)} disabled={disabled} className={t.secondaryBtn}>
                    <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download once</span>
                  </button>
                ) : (
                  <a href={f.downloadUrl} className={t.secondaryBtn} aria-label={`Download ${f.name}`}>
                    <Download className="h-4 w-4" /> <span className="hidden sm:inline">Download</span>
                  </a>
                )}
                {!f.oneTime && (
                  <button onClick={() => onDelete(f)} disabled={disabled} className={t.ghostBtn} aria-label={`Delete ${f.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            {canPreview && isOpen && (
              <div className="mt-3">
                <Preview file={f} kind={kind} />
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
