"use client"

import type { RoomState, RoomVersion } from "@/lib/room"

// ------------------------------------------------------------ room passwords (per tab)

const pwKey = (room: string) => `cloudclip:pw:${room}`

export function getRoomPassword(room: string): string | null {
  try {
    return sessionStorage.getItem(pwKey(room))
  } catch {
    return null
  }
}

export function setRoomPassword(room: string, password: string | null) {
  try {
    if (password) sessionStorage.setItem(pwKey(room), password)
    else sessionStorage.removeItem(pwKey(room))
  } catch {
    /* storage unavailable: password just won't persist across reloads */
  }
}

// ------------------------------------------------------------ fetch helper

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public locked = false,
  ) {
    super(message)
  }
}

async function call<T>(room: string, path: string, init: RequestInit = {}, password?: string | null): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body) headers.set("content-type", "application/json")
  const pw = password !== undefined ? password : getRoomPassword(room)
  if (pw) headers.set("x-room-password", pw)

  let res: Response
  try {
    res = await fetch(`/api/rooms/${encodeURIComponent(room)}${path}`, { ...init, headers, cache: "no-store" })
  } catch {
    throw new ApiError("Network error — try again.", 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      res.status === 429 ? "Too many requests — try again in a moment." : data?.message || "Network error — try again."
    throw new ApiError(msg, res.status, !!data?.locked)
  }
  return data as T
}

// ------------------------------------------------------------ endpoints

export const api = {
  getRoom: (room: string, password?: string | null) => call<RoomState>(room, "", {}, password),

  saveText: (room: string, text: string, oneTime: boolean) =>
    call<{ message: string }>(room, "/text", { method: "POST", body: JSON.stringify({ text, oneTime }) }),

  revealText: (room: string) => call<{ text: string }>(room, "/reveal", { method: "POST" }),

  history: (room: string) => call<{ versions: RoomVersion[] }>(room, "/history"),

  lock: (room: string, password: string) =>
    call<{ locked: boolean }>(room, "/lock", { method: "POST", body: JSON.stringify({ password }) }),

  unlock: (room: string) => call<{ locked: boolean }>(room, "/lock", { method: "DELETE" }),

  deleteFile: (room: string, id: string) =>
    call<{ ok: boolean }>(room, `/files/${id}`, { method: "DELETE" }),

  claimFile: (room: string, id: string) =>
    call<{ url: string; name: string }>(room, `/files/${id}/claim`, { method: "POST" }),

  /**
   * Upload flow: ask the server for a signed URL, PUT the file straight to Supabase Storage
   * (XHR so we get progress + cancel), then confirm with the server.
   */
  uploadFile(
    room: string,
    file: File,
    opts: { oneTime: boolean; onProgress?: (pct: number) => void; signal?: AbortSignal },
  ): Promise<void> {
    return (async () => {
      const { id, signedUrl } = await call<{ id: string; signedUrl: string }>(room, "/files", {
        method: "POST",
        body: JSON.stringify({ name: file.name, size: file.size, mime: file.type, oneTime: opts.oneTime }),
      })

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", signedUrl)
        xhr.setRequestHeader("content-type", file.type || "application/octet-stream")
        xhr.setRequestHeader("cache-control", "max-age=3600")
        xhr.setRequestHeader("x-upsert", "false")
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(
                new ApiError(
                  xhr.status === 413 ? "Upload failed — file too large (max 10 MB)." : "Upload failed — try again.",
                  xhr.status,
                ),
              )
        xhr.onerror = () => reject(new ApiError("Network error — try again.", 0))
        xhr.onabort = () => reject(new ApiError("Upload cancelled.", 499))
        opts.signal?.addEventListener("abort", () => xhr.abort(), { once: true })
        xhr.send(file)
      })

      await call<{ ok: boolean }>(room, `/files/${id}`, { method: "POST" })
    })()
  },
}
