import { authorizeRoom, ensureRoom, handle, HttpError, json, readJson, readRoomParam } from "@/lib/server/http"
import { hashPassword } from "@/lib/server/password"
import { db } from "@/lib/server/supabase"
import { LIMITS } from "@/lib/room"

type Ctx = { params: Promise<{ room: string }> }

// POST /api/rooms/:room/lock { password } -> lock the room (or change password; needs current one).
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const room = await readRoomParam(params)
  await authorizeRoom(req, room) // if already locked, x-room-password must be the current password
  const { password } = await readJson<{ password?: unknown }>(req)

  if (typeof password !== "string" || password.length < LIMITS.minPassword) {
    throw new HttpError(400, `Password must be at least ${LIMITS.minPassword} characters.`)
  }
  if (password.length > 200) throw new HttpError(400, "Password is too long.")

  await ensureRoom(room)
  const { error } = await db().from("rooms").update({ password_hash: await hashPassword(password) }).eq("name", room)
  if (error) throw error
  return json({ locked: true })
})

// DELETE /api/rooms/:room/lock -> remove the password (needs current password).
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const room = await readRoomParam(params)
  const { exists } = await authorizeRoom(req, room)
  if (exists) {
    const { error } = await db().from("rooms").update({ password_hash: null }).eq("name", room)
    if (error) throw error
  }
  return json({ locked: false })
})
