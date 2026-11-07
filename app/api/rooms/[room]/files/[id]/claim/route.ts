import { authorizeRoom, handle, HttpError, json, readRoomParam } from "@/lib/server/http"
import { BUCKET, db } from "@/lib/server/supabase"

type Ctx = { params: Promise<{ room: string; id: string }> }

const CLAIM_URL_TTL = 60 // seconds: enough to start the download, useless afterwards

// POST /api/rooms/:room/files/:id/claim -> one-time file: returns a short-lived download URL exactly once.
// The object itself is deleted by the daily cleanup job.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const room = await readRoomParam(params)
  const { id } = await params
  await authorizeRoom(req, room)

  const { data, error } = await db().rpc("claim_one_time_file", { p_room: room, p_id: id })
  if (error) throw error
  const row = (data as { path: string; name: string }[] | null)?.[0]
  if (!row) throw new HttpError(410, "This item was viewed and removed.")

  const { data: signed, error: signErr } = await db()
    .storage.from(BUCKET)
    .createSignedUrl(row.path, CLAIM_URL_TTL, { download: row.name })
  if (signErr) throw signErr
  return json({ url: signed.signedUrl, name: row.name })
})
