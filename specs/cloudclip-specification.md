Goal: Generate a production-ready, single-file React component (CloudClipUI.jsx) plus supporting assets (design tokens / Tailwind classes) that implements the exact UI and behavior described below. Output must be high-fidelity, accessible, responsive, and ready to paste into a React + Tailwind project. Include inline comments, placeholder API hooks, and a short README snippet explaining integration points. Deliver both light and dark theme variants. Follow every detail — microcopy, spacing, states, animations, and behavior.

1) Project overview (one-sentence)

A minimal, modern anonymous clipboard UI with a top navbar (CloudClip + theme toggle), a central rounded card with a two-way mode switch (Text | File), an input area (text box or drag/drop file zone), a “one-time view” checkbox, and a primary Send/Post button — with per-room behavior (auto-generated room when visiting root; cloudclip.com/<room> loads that room).

2) Deliverables (explicit)

CloudClipUI.jsx — default-export React functional component using Tailwind CSS classes (no other UI frameworks).

design-tokens.json (or comment block) — exact color tokens, spacing, radii, font sizes, and Tailwind config hints.

Two exported preview screenshots (PNG): Light theme and Dark theme.

README.md snippet (within component comments) with integration notes and placeholder API functions: generateRoom(), fetchRoomData(room), postText(room, payload), uploadFile(room, file, onProgress), deleteAfterView(room, id).

Small test checklist and example room strings.

3) Output format & constraints

React (functional component), Tailwind v3+ utility classes.

Do not add external UI libraries. Inline SVG icons allowed (sun, moon, upload, file, copy, trash). Use Inter, system-ui fonts.

Keep code self-contained in one file (helper hooks allowed inside file). Provide explicit TODO comments for backend wiring.

Component props: roomName?: string | null, initialData?: { type: 'text'|'file', value: string, filename?:string, expiresAt?: string, locked?: boolean }, onRoomGenerated?: (room) => void. Defaults must handle root behavior (generate room if roomName missing).

4) Visual design tokens (use these exact values)

Light theme

background: #FFFFFF

page-bg: #F8FAFC (card background subtle)

card-bg: #FFFFFF

text-primary: #0F172A (very dark)

text-muted: #64748B

accent (primary): #0EA5E9 (sky-500)

accent-dark: #0369A1

Dark theme

background: #071326

page-bg: #0B1220

card-bg: #0F1724

text-primary: #E6EEF6

text-muted: #93A6B8

accent: #06B6D4

UI specifics

border radius: 12px (rounded-lg)

main card max-width: 760px (use max-w-3xl / custom) and horizontally centered with px-4 padding.

elevation: soft shadow 0 6px 20px rgba(2,6,23,0.08) in light, subtle inner glow in dark.

base font-size: 16px (Tailwind default) — use text-base for body.

line heights and spacing: comfortable whitespace (use p-6 on card, gap-4).

5) Layout & exact component structure

Top-level page layout (mobile-first):

Navbar (height ~64px) — left: CloudClip logo/text (bold). Right: theme toggle circle button (sun/moon icon). On small screens, both visible inline. Also include a small Copy Room Link icon/button near the right when in a room.

CloudClip text: font-weight semibold, text-lg (20px).

Theme toggle: 44×28 px pill or 40px circular button with accessible aria-pressed.

Main card (centered) — visually distinct rounded rectangle with slight shadow; inside vertical stack:

Room bar (tiny row above tabs): shows roomName (monospace), a small Copy button, and a Lock badge if room is locked. If no roomName passed, component generates one and calls onRoomGenerated(room). Show example format tooltip: 5 letters + 2 digits + 1 symbol (e.g. abcde12@).

Mode Switcher (tabs): a small segmented control with two halves: Text (left), File (right). Default Text active. Height ~44px, rounded full, selected tab with accent background and soft shadow.

Content area (switches depending on mode):

Text mode: resizable textarea with placeholder “Paste or type text here...”. Minimum height 140px. Show small character counter bottom-right (e.g., 0 / 10000 or — if unlimited). Show Last updated small caption if content present. If clipboard already has text, show it in read-only mode with a subtle Edit icon if the room is editable.

File mode: a drag-and-drop dropzone (dashed border) with large centered upload icon, text: Drop your file here or click to upload (max 10 MB / file). Show accepted types hint below (All file types allowed). Show file list if file(s) already uploaded: each with filename, size, expiration (expires in 4 days), download button, and optionally a progress bar during upload. On dragover, dropzone background lightly tints and dashed border thickens.

Options row (below content area, small text): left: checkbox Enable one-time view (auto-delete after first access) with small tooltip When enabled, the item will be permanently deleted after the first viewer downloads/reads it. Right: small muted text showing TTL info: Text TTL: 7 days · File TTL: 5 days.

Action row: large primary button centered Send / Post (use bg-gradient-to-r from-sky-400 to-cyan-400 in light; neon cyan glow in dark). Button states:

Normal: clickable.

Loading: spinner inside the button; disabled.

Success: show success toast Posted to <roomName> · Copy link and change button temporarily to Posted.

Error: show inline error text in red below button (e.g., File exceeds 10 MB limit).

Footer small: muted help text: Room is public and editable by default. Lock the room to prevent edits.

6) Microcopy & strings (exact)

Navbar title: CloudClip

Theme toggle tooltip: Toggle light / dark

Room tooltip: Room: <roomName> · Copy (copy button text: Copy link)

Mode tabs: Text | File

Text placeholder: Paste or type text here...

File drop placeholder: Drop your file here or click to upload (max 10 MB)

Checkbox label: Enable one-time view (auto-delete after first access)

TTL info: Text TTL: 7 days · File TTL: 5 days

Send button: Send / Post (secondary small: Cancel if editing).

Success toast: Posted to <roomName> — URL copied to clipboard

Error messages (exact):

Upload failed — file too large (max 10 MB).

Upload failed — room storage limit reached (1 GB).

Network error — try again.

7) Interaction & behavior (explicit)

Room generation: If roomName is not present in URL/props, generate room = <5 lowercase letters><2 digits><1 symbol> appended as _letters(5)+digits(2)+symbol(1) example — abcde12@. Use symbol set: @ # $ % & - (pick randomly). Format must be exactly five letters, then two digits, then one symbol. Immediately update the URL via history API (pushState) to /room and call onRoomGenerated(room).

Mode switching: instantaneous client-side; preserve typed text or file selection when switching back and forth (persist in local component state).

One-time view: send a boolean flag to server with the payload. UI should show a warning tooltip if enabled: This file/text will be deleted after someone views it once. After successful Post, disable the Edit controls and show View Once badge on posted object.

If something already exists in the room: show the existing item in a read-first view:

For text: show read-only text block with Edit button if room is editable. If locked, hide Edit and show Locked badge.

For files: show filename, preview icon, size, Download button, and uploader info Uploaded X hours ago. If view once is enabled and has been viewed, show This item was viewed and removed.

File upload: use pre-signed URLs (placeholder in code). Show upload progress bar, support cancel. Enforce max file size 10 MB and show error if exceeded. Show total room storage warning when close to 1 GB.

Copy link: copy https://cloudclip.com/<room> to clipboard and show a temporary tooltip Copied!.

Locking behavior: show a small lock icon if the room is locked; if the room is locked and user is the creator (not handled in anonymous flow) show Unlock option — otherwise read-only.

Real-time: include optional polling hook defaulting to 5 seconds to fetch room updates. (Add comment: replace with WebSocket/AppSync for production.)

Keyboard: Tab order logical; Enter submits when focus is inside textarea and Ctrl+Enter posts (desktop). Escape closes modals/popovers.

8) Animations & micro-interactions (exact)

Mode tab switch: 180ms ease-out slide+fade for active indicator.

Button hover: 140ms transform translateY(-2px) + subtle shadow increase.

Dropzone dragover: 120ms border thickness + background lighten transition.

Toasts: slide from top-right, auto-dismiss after 4s, with a close x.

Focus rings: visible, outline with accent color (not removed).

9) Accessibility (a11y) requirements

All controls must have ARIA labels (theme toggle aria-pressed, copy button aria-label="Copy room link", tabs role="tablist" and role="tab").

Sufficient contrast: text-to-background >= 4.5:1 for body text.

Keyboard navigation fully supported (tab, shift+tab, Enter, Space).

Live regions: success/error toasts must be announced (role="status" or aria-live="polite").

File dropzone: provide an alternative clickable button and aria-label for keyboard-only users.

10) Responsive behavior (exact)

Mobile (≤640px): navbar compact; room name displayed below title; card paddings p-4; buttons full-width. Tabs stack horizontally full-width; textarea min-height 120px. Copy and toggle icons shown as compact icons (no text).

Tablet (641–1024px): card centered with max-w-lg.

Desktop (≥1024px): card max-w-3xl, room bar shows full roomName with Copy and Lock badges inline.

11) Edge cases and error states (explicit)

File larger than 10 MB → block upload and show Upload failed — file too large (max 10 MB).

Room storage >1 GB (server-side) → show Room storage limit reached (1 GB) and disable upload.

If server returns 429/RateLimit → show Too many requests — try again in a moment.

If view once item is viewed: show This item was viewed and removed. If the user attempts to re-open after view-once, show empty clipboard with a small note This item was deleted after being viewed.

Network lost during upload: show retry button.

12) Code & API scaffolding requirements (inside the file)

Use useState, useEffect, useRef. Provide a usePolling hook defaulting to 5s.

Provide placeholder async functions with comments:

async function generateRoom() { /* returns string of format aaaaa11@ */ }
async function fetchRoomData(room) { /* GET /api/rooms/:room */ }
async function postText(room, payload) { /* POST (text) */ }
async function uploadFile(room, file, onProgress) { /* upload; return metadata */ }


Use fetch API or axios (prefer fetch) for placeholders. Clearly mark where to replace with real endpoints / presigned URL flow.

Include copy-to-clipboard helper with fallback.

13) Acceptance criteria (testable)

Landing on / generates a room 5letters2digits1symbol appended to URL with pushState.

cloudclip.com/<room> renders the same card. If initialData provided, the card shows the content in read mode.

Text posting: clicking Send / Post in Text mode calls postText() with { text, oneTime } and shows success toast.

File posting: selecting or dropping file <10MB triggers upload with progress bar, and the uploadFile() placeholder is called. Large files rejected.

Theme toggle instantly switches to light/dark and persists in localStorage.

14) Example room generation rule (explicit)

ALWAYS generate a string exactly matching: [a-z]{5}[0-9]{2}[@#$%&-] (5 lowercase letters, then 2 digits, then one symbol from @ # $ % & -). Example: xqfvt48#.

15) Small README snippet (inside component comment)

How to wire backend: explain DynamoDB + S3 + Lambda/App Gateway (brief) and mention TTL rules: text 7 days (DynamoDB TTL) and files S3 lifecycle 5 days. (Keep short — focus on UI integration: endpoints expected and payload shapes.)

16) Final note to v0.dev

Produce a single file CloudClipUI.jsx ready to drop into a React + Tailwind project with clearly labeled regions (UI, state, api stubs, styles, tokens).

Also provide two preview PNGs (light and dark) and design-tokens.json snippet.

Include clear inline comments instructing the developer where to plug real APIs, where to replace polling with WebSocket, and how to change color tokens.
