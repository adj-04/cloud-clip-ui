import { authorizeRoom, ensureRoom, handle, HttpError, json, readJson, readRoomParam } from "@/lib/server/http"
import { BUCKET, db } from "@/lib/server/supabase"
import { LIMITS } from "@/lib/room"

type Ctx = { params: Promise<{ room: string }> }

// POST /api/rooms/:room/files { name, size, mime?, oneTime? }
// -> { id, signedUrl } : the browser PUTs the file to signedUrl, then calls POST /files/:id to confirm.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const room = await readRoomParam(params)
  await authorizeRoom(req, room)
  const body = await readJson<{ name?: unknown; size?: unknown; mime?: unknown; oneTime?: unknown }>(req)

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : ""
  const size = typeof body.size === "number" ? body.size : NaN
  const mime = typeof body.mime === "string" && body.mime ? body.mime.slice(0, 200) : "application/octet-stream"
  if (!name) throw new HttpError(400, '"name" is required')
  if (!Number.isFinite(size) || size <= 0) throw new HttpError(400, '"size" must be a positive number')
  if (size > LIMITS.fileBytes) throw new HttpError(413, "Upload failed — file too large (max 10 MB).")

  // Room storage limit: count live files plus uploads started in the last hour.
  const now = new Date()
  const { data: used, error: usedErr } = await db()
    .from("files")
    .select("size, uploaded, created_at")
    .eq("room", room)
    .is("consumed_at", null)
    .gt("expires_at", now.toISOString())
  if (usedErr) throw usedErr
  const hourAgo = now.getTime() - 60 * 60 * 1000
  const total = (used ?? [])
    .filter((f) => f.uploaded || new Date(f.created_at).getTime() > hourAgo)
    .reduce((s, f) => s + Number(f.size), 0)
  if (total + size > LIMITS.roomBytes) throw new HttpError(413, "Upload failed — room storage limit reached (1 GB).")

  await ensureRoom(room)

  // Object path does not contain the room name (Supabase keys disallow "~"); the DB row links them.
  const id = crypto.randomUUID()
  const safeName = name.replace(/[^\w.\- ()]/g, "_").slice(0, 150) || "file"
  const path = `${id}/${safeName}`

  const { error: insErr } = await db()
    .from("files")
    .insert({ id, room, path, name, size, mime, one_time: !!body.oneTime })
  if (insErr) throw insErr

  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path)
  if (error) throw error
  return json({ id, signedUrl: data.signedUrl })
})
