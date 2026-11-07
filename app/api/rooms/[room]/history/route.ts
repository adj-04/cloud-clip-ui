import { authorizeRoom, handle, json, readRoomParam } from "@/lib/server/http"
import { db } from "@/lib/server/supabase"
import type { RoomVersion } from "@/lib/room"

type Ctx = { params: Promise<{ room: string }> }

// GET /api/rooms/:room/history -> last 5 previous versions of the text
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const room = await readRoomParam(params)
  await authorizeRoom(req, room)

  const { data, error } = await db()
    .from("clip_versions")
    .select("id, body, created_at")
    .eq("room", room)
    .order("created_at", { ascending: false })
    .limit(5)
  if (error) throw error

  const versions: RoomVersion[] = (data ?? []).map((v) => ({ id: v.id, body: v.body, createdAt: v.created_at }))
  return json({ versions })
})
