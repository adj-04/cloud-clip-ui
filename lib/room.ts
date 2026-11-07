// Shared (client + server) room helpers. No secrets here.

// Room names: letters, digits, "_", "~", "-" (URL-safe, no encoding needed).
// The original spec allowed @ # $ % & too, but "#" starts a URL fragment and "%" starts
// an escape sequence, so links like /clip/abcde12# silently break. Unreserved chars only.
export const ROOM_RE = /^[A-Za-z0-9_~-]{3,64}$/

export const LIMITS = {
  textChars: 10_000,
  fileBytes: 10 * 1024 * 1024, // 10 MB
  roomBytes: 1024 * 1024 * 1024, // 1 GB
  textTtlDays: 7,
  fileTtlDays: 5,
  minPassword: 4,
} as const

export function isValidRoom(room: string | null | undefined): room is string {
  return typeof room === "string" && ROOM_RE.test(room)
}

/** 5 lowercase letters + 2 digits + 1 symbol, e.g. "xqfvt48~". */
export function generateRoomName(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz"
  const digits = "0123456789"
  const symbols = "-_~"
  const pick = (s: string) => s[cryptoRandomInt(s.length)]
  let room = ""
  for (let i = 0; i < 5; i++) room += pick(letters)
  for (let i = 0; i < 2; i++) room += pick(digits)
  room += pick(symbols)
  return room
}

function cryptoRandomInt(max: number): number {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0] % max
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

// ------------------------------------------------------------ API shapes

export interface RoomFile {
  id: string
  name: string
  size: number
  mime: string
  oneTime: boolean
  createdAt: string
  expiresAt: string
  /** Inline signed URL for previews (absent for one-time files). */
  url?: string
  /** Signed URL that forces a download (absent for one-time files). */
  downloadUrl?: string
}

export interface RoomText {
  /** null when the text is one-time and must be revealed explicitly. */
  body: string | null
  oneTime: boolean
  updatedAt: string
  expiresAt: string
}

export interface RoomState {
  room: string
  locked: boolean
  text: RoomText | null
  files: RoomFile[]
  storageUsed: number
}

export interface RoomVersion {
  id: number
  body: string
  createdAt: string
}
