import "server-only"
import { NextResponse } from "next/server"
import { isValidRoom } from "@/lib/room"
import { db } from "./supabase"
import { verifyPassword } from "./password"

export const PASSWORD_HEADER = "x-room-password"

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } })
}

export function error(message: string, status: number, extra: Record<string, unknown> = {}) {
  return json({ message, ...extra }, status)
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

/** Wraps a route handler: converts HttpError / unexpected errors into JSON responses. */
export function handle<Ctx>(fn: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await fn(req, ctx)
    } catch (e) {
      if (e instanceof HttpError) return error(e.message, e.status, e.extra)
      console.error(e)
      return error("Network error — try again.", 500)
    }
  }
}

export async function readRoomParam(params: Promise<{ room: string }>): Promise<string> {
  const { room: raw } = await params
  let room = raw
  try {
    room = decodeURIComponent(raw)
  } catch {
    /* keep raw */
  }
  if (!isValidRoom(room)) throw new HttpError(400, "Invalid room name")
  return room
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new HttpError(400, "Body must be valid JSON")
  }
}

/**
 * Loads the room row and checks the room password if the room is locked.
 * Returns { exists, locked }. Throws 401 { locked: true } if a password is required and wrong/missing.
 */
export async function authorizeRoom(req: Request, room: string) {
  const { data, error: err } = await db().from("rooms").select("password_hash").eq("name", room).maybeSingle()
  if (err) throw err
  const hash: string | null = data?.password_hash ?? null
  if (hash) {
    const given = req.headers.get(PASSWORD_HEADER)
    if (!given || !(await verifyPassword(given, hash))) {
      throw new HttpError(401, given ? "Wrong password." : "This room is locked.", { locked: true })
    }
  }
  return { exists: !!data, locked: !!hash }
}

export async function ensureRoom(room: string) {
  const { error: err } = await db().from("rooms").upsert({ name: room }, { onConflict: "name", ignoreDuplicates: true })
  if (err) throw err
}
