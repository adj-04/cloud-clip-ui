import { authorizeRoom, handle, HttpError, json, readJson, readRoomParam } from "@/lib/server/http"
import { db } from "@/lib/server/supabase"
import { LIMITS } from "@/lib/room"

type Ctx = { params: Promise<{ room: string }> }

// POST /api/rooms/:room/text  { text: string, oneTime?: boolean }
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const room = await readRoomParam(params)
  await authorizeRoom(req, room)
  const { text, oneTime } = await readJson<{ text?: unknown; oneTime?: unknown }>(req)

  if (typeof text !== "string") throw new HttpError(400, '"text" must be a string')
  if (text.length > LIMITS.textChars) throw new HttpError(413, `Text exceeds ${LIMITS.textChars} characters.`)
  if (oneTime && !text.trim()) throw new HttpError(400, "A one-time message can't be empty.")

  const { error } = await db().rpc("save_text", { p_room: room, p_body: text, p_one_time: !!oneTime })
  if (error) throw error
  return json({ message: "Saved" })
})
