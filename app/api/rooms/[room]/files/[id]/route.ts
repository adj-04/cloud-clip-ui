import { authorizeRoom, handle, HttpError, json, readRoomParam } from "@/lib/server/http"
import { BUCKET, db } from "@/lib/server/supabase"

type Ctx = { params: Promise<{ room: string; id: string }> }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function load(req: Request, params: Ctx["params"]) {
  const room = await readRoomParam(params)
  const { id } = await params
  if (!UUID_RE.test(id)) throw new HttpError(400, "Invalid file id")
  await authorizeRoom(req, room)
  const { data, error } = await db()
    .from("files")
    .select("id, path, size, uploaded")
    .eq("id", id)
    .eq("room", room)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new HttpError(404, "File not found")
  return data
}

// POST /api/rooms/:room/files/:id -> confirm the upload finished
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const file = await load(req, params)
  if (!file.uploaded) {
    const { data: exists, error } = await db().storage.from(BUCKET).exists(file.path)
    if (error) throw error
    if (!exists) throw new HttpError(409, "Upload not found — try again.")
    const { error: updErr } = await db().from("files").update({ uploaded: true }).eq("id", file.id)
    if (updErr) throw updErr
  }
  return json({ ok: true })
})

// DELETE /api/rooms/:room/files/:id -> remove the file now
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const file = await load(req, params)
  const { error: rmErr } = await db().storage.from(BUCKET).remove([file.path])
  if (rmErr) throw rmErr
  const { error } = await db().from("files").delete().eq("id", file.id)
  if (error) throw error
  return json({ ok: true })
})
