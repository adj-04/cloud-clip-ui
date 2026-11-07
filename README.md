# CloudClip

An anonymous cloud clipboard: open a room, paste text or drop files, and open the same room on any other device.

**Live:** _add your Vercel URL here_

## Features

- **Rooms by URL.** Visiting `/` creates a room like `abcde12~`; `/clip/<room>` opens it.
- **Text and files.** Up to 10,000 characters of text, and files up to 10 MB each (1 GB per room).
- **Live sync.** Changes appear instantly on every open device (Supabase Realtime), with a count of devices online.
- **One-time view.** Text or files that are deleted for everyone after the first read or download.
- **Locked rooms.** Optional password; locked rooms can't be read or edited without it.
- **QR code.** Scan to open the room on your phone.
- **Previews.** Images, PDFs, video, audio, and text/code files.
- **History.** The last 5 versions of the text, restorable.
- **Auto-expiry.** Text after 7 days, files after 5 days (daily cleanup job).
- **Other.** Light/dark theme, paste-a-screenshot upload, keyboard shortcuts, mobile layout.

## Architecture

```
Browser (Next.js + React + Tailwind)
   │  fetch /api/...            │  PUT file (signed URL)       │  Realtime "changed" pings + presence
   ▼                            ▼                              ▼
Vercel serverless functions ──► Supabase Postgres + Storage ◄── Supabase Realtime
(app/api/*, secret key)         (RLS on, private bucket)
   ▲
Vercel Cron (daily) → /api/cron/cleanup → deletes expired files and rows
```

- The browser never talks to the database directly. All reads and writes go through API routes that hold the secret key and check room passwords.
- Files upload **straight to Supabase Storage** using short-lived signed URLs, so they never pass through Vercel.
- Realtime only broadcasts a "something changed" ping, never the content. Other devices then refetch through the API, so locked rooms don't leak data.

## Setup (free, ~20 minutes)

### 1. Supabase (database + file storage)
1. Create a free account at [supabase.com](https://supabase.com), then click **New project**. Pick the region closest to you (e.g. Mumbai).
2. Open **SQL Editor → New query**, paste all of [`supabase/schema.sql`](supabase/schema.sql), and click **Run**.
3. From **Project Settings**, copy these three values:
   - **Data API → Project URL**
   - **API Keys → Publishable key** (or the legacy `anon` key)
   - **API Keys → Secret key** (or the legacy `service_role` key)

### 2. Run locally
```bash
pnpm install
cp .env.example .env.local     # fill in the 4 values
pnpm dev                       # http://localhost:3000
```

### 3. Deploy on Vercel
1. Push the repo to GitHub.
2. In [vercel.com](https://vercel.com), click **Add New → Project** and import the repo. Vercel detects Next.js automatically.
3. Under **Environment Variables**, add all 4 variables from `.env.example`.
4. Click **Deploy**.

The daily cleanup cron in `vercel.json` is registered automatically. Its daily query also keeps the free Supabase project from pausing.

## API

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/rooms/:room` | Text + files (signed URLs) |
| POST | `/api/rooms/:room/text` | `{ text, oneTime }` save text |
| POST | `/api/rooms/:room/reveal` | Read and delete a one-time text |
| GET | `/api/rooms/:room/history` | Last 5 text versions |
| POST | `/api/rooms/:room/files` | `{ name, size, mime, oneTime }` → signed upload URL |
| POST | `/api/rooms/:room/files/:id` | Confirm upload finished |
| DELETE | `/api/rooms/:room/files/:id` | Delete a file |
| POST | `/api/rooms/:room/files/:id/claim` | One-time file → 60 s download URL |
| POST / DELETE | `/api/rooms/:room/lock` | Set/change password, or remove lock |
| GET | `/api/cron/cleanup` | Daily cleanup (Vercel Cron only) |

Locked rooms need the header `x-room-password` on every request.

## Project structure

```
app/
  page.tsx                  "/" → new room
  clip/[roomName]/page.tsx  room page
  api/rooms/[room]/...      API routes
  api/cron/cleanup/         daily cleanup
components/cloudclip/       UI (CloudClip, FileList, Dialogs, ui)
lib/room.ts                 shared limits, types, room-name rules
lib/client/                 browser API client + realtime hook
lib/server/                 Supabase client, password hashing, auth helpers
supabase/schema.sql         tables, bucket, SQL functions
```
