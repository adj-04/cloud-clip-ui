import { authorizeRoom, handle, HttpError, json, readRoomParam } from "@/lib/server/http"
import { db } from "@/lib/server/supabase"

type Ctx = { params: Promise<{ room: string }> }

// POST /api/rooms/:room/reveal -> returns the one-time text and deletes it (exactly once).
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const room = await readRoomParam(params)
  await authorizeRoom(req, room)

  const { data, error } = await db().rpc("reveal_one_time_text", { p_room: room })
  if (error) throw error
  if (data == null) throw new HttpError(410, "This item was deleted after being viewed.")
  return json({ text: data as string })
})
