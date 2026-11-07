import { BUCKET, db } from "@/lib/server/supabase"
import { json } from "@/lib/server/http"

// Called daily by Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer $CRON_SECRET".
// Also keeps the free Supabase project active, so it never gets paused for inactivity.
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ message: "Unauthorized" }, 401)
  }

  const now = Date.now()
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString()

  // Files to purge: expired, claimed one-time files (after 10 min), abandoned uploads (after 1 h).
  const { data, error } = await db()
    .from("files")
    .select("id, path")
    .or(
      [
        `expires_at.lt."${iso(0)}"`,
        `consumed_at.lt."${iso(10 * 60 * 1000)}"`,
        `and(uploaded.eq.false,created_at.lt."${iso(60 * 60 * 1000)}")`,
      ].join(","),
    )
    .limit(1000)
  if (error) return json({ message: error.message }, 500)

  let removed = 0
  const rows = data ?? []
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const { error: rmErr } = await db().storage.from(BUCKET).remove(batch.map((r) => r.path))
    if (rmErr) return json({ message: rmErr.message, removed }, 500)
    const { error: delErr } = await db().from("files").delete().in("id", batch.map((r) => r.id))
    if (delErr) return json({ message: delErr.message, removed }, 500)
    removed += batch.length
  }

  const { error: rowsErr } = await db().rpc("cleanup_expired_rows")
  if (rowsErr) return json({ message: rowsErr.message, removed }, 500)

  return json({ ok: true, filesRemoved: removed })
}
