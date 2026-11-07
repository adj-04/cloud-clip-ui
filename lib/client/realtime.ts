"use client"

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js"
import { useEffect, useRef, useState } from "react"

let browserClient: SupabaseClient | null = null

function getBrowserClient(): SupabaseClient | null {
  if (browserClient) return browserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  browserClient = createClient(url, key, { auth: { persistSession: false } })
  return browserClient
}

/**
 * Live sync for a room using Supabase Realtime *Broadcast* + *Presence*.
 * Only a "changed" ping is broadcast (never the content), so locked rooms leak nothing:
 * other devices refetch through the API, which checks the password.
 *
 * Returns notify() to tell other devices something changed, and how many devices are online.
 */
export function useRoomLive(room: string, onRemoteChange: () => void) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const callbackRef = useRef(onRemoteChange)
  callbackRef.current = onRemoteChange
  const [online, setOnline] = useState(1)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const supabase = getBrowserClient()
    if (!supabase) return

    const me = crypto.randomUUID()
    const channel = supabase.channel(`room:${room}`, {
      config: { broadcast: { self: false }, presence: { key: me } },
    })

    channel
      .on("broadcast", { event: "changed" }, () => callbackRef.current())
      .on("presence", { event: "sync" }, () => setOnline(Math.max(1, Object.keys(channel.presenceState()).length)))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setConnected(true)
          await channel.track({ at: Date.now() })
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnected(false)
        }
      })

    channelRef.current = channel
    return () => {
      channelRef.current = null
      setConnected(false)
      supabase.removeChannel(channel)
    }
  }, [room])

  const notify = () => {
    channelRef.current?.send({ type: "broadcast", event: "changed", payload: {} })
  }

  return { notify, online, connected }
}
