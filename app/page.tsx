import { redirect } from "next/navigation"
import { generateRoomName } from "@/lib/room"

// Visiting "/" creates a fresh room (5 letters + 2 digits + 1 symbol) and opens it.
export const dynamic = "force-dynamic"

export default function Home() {
  redirect(`/clip/${generateRoomName()}`)
}
