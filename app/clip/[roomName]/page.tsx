import type { Metadata } from "next"
import { notFound } from "next/navigation"
import CloudClip from "@/components/cloudclip/CloudClip"
import { isValidRoom } from "@/lib/room"

type Props = { params: Promise<{ roomName: string }> }

function decode(raw: string) {
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const room = decode((await params).roomName)
  return { title: `${room} · CloudClip`, robots: { index: false, follow: false } }
}

export default async function RoomPage({ params }: Props) {
  const room = decode((await params).roomName)
  if (!isValidRoom(room)) notFound()
  return <CloudClip room={room} />
}
