import { authorizeRoom, handle, json, readRoomParam } from "@/lib/server/http"
import { BUCKET, db } from "@/lib/server/supabase"
import type { RoomFile, RoomState } from "@/lib/room"

type Ctx = { params: Promise<{ room: string }> }

const PREVIEW_URL_TTL = 60 * 60 // 1 hour

// GET /api/rooms/:room -> current text + files (room "exists" virtually even if empty)
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const room = await readRoomParam(params)
  const { locked } = await authorizeRoom(req, room)
  const now = new Date().toISOString()

  const [clipRes, filesRes] = await Promise.all([
    db().from("clips").select("body, one_time, updated_at, expires_at").eq("room", room).gt("expires_at", now).maybeSingle(),
    db()
      .from("files")
      .select("id, path, name, size, mime, one_time, created_at, expires_at")
      .eq("room", room)
      .eq("uploaded", true)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .order("created_at", { ascending: false }),
  ])
  if (clipRes.error) throw clipRes.error
  if (filesRes.error) throw filesRes.error

  const rows = filesRes.data ?? []
  const viewable = rows.filter((f) => !f.one_time)
  const signed = new Map<string, string>()
  if (viewable.length) {
    const { data, error } = await db()
      .storage.from(BUCKET)
      .createSignedUrls(viewable.map((f) => f.path), PREVIEW_URL_TTL)
    if (error) throw error
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }

  const files: RoomFile[] = rows.map((f) => {
    const url = signed.get(f.path)
    return {
      id: f.id,
      name: f.name,
      size: f.size,
      mime: f.mime,
      oneTime: f.one_time,
      createdAt: f.created_at,
      expiresAt: f.expires_at,
      ...(url ? { url, downloadUrl: `${url}&download=${encodeURIComponent(f.name)}` } : {}),
    }
  })

  const clip = clipRes.data
  const state: RoomState = {
    room,
    locked,
    text: clip
      ? {
          body: clip.one_time ? null : clip.body,
          oneTime: clip.one_time,
          updatedAt: clip.updated_at,
          expiresAt: clip.expires_at,
        }
      : null,
    files,
    storageUsed: rows.reduce((s, f) => s + Number(f.size), 0),
  }
  return json(state)
})
