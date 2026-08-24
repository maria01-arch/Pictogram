# Pictogram — "Share Life"

A mobile-first, creator-owned alternative to Instagram. Built on Next.js (App
Router) + Supabase, with a strict **Tap-to-Play** media policy and aggressive
client-side compression to keep Supabase egress/storage bills low.

Built to be developed entirely from a phone (Termux). Every file below is
self-contained — copy it in as-is, no build step required to *read* it.

---

## 1. Folder structure

```
pictogram/
├── README.md
├── package.json
├── tailwind.config.ts
├── .env.local.example
├── supabase/
│   └── schema.sql              # Full DB schema + RLS + 24h story cleanup
└── src/
    ├── app/
    │   ├── layout.tsx           # Root layout, fonts, theme provider, bottom nav
    │   ├── globals.css          # Design tokens (light/dark), Tailwind layers
    │   ├── page.tsx             # "/"  -> Home Feed
    │   ├── chat/
    │   │   └── page.tsx         # "/chat" -> conversation list + active thread
    │   └── profile/
    │       └── account-health/
    │           └── page.tsx     # "/profile/account-health" -> strikes + appeals
    ├── components/
    │   ├── TapToPlayVideo.tsx   # Core differentiator #1
    │   ├── PostCard.tsx         # Single feed item (image or video)
    │   ├── HomeFeed.tsx         # Chronological feed renderer
    │   ├── ConversationList.tsx # Chat sidebar / list (mobile: full screen)
    │   └── ChatWindow.tsx       # Active thread, realtime via Supabase channels
    ├── lib/
    │   ├── supabaseClient.ts    # Singleton Supabase client
    │   ├── compressImage.ts     # Core differentiator #2 (image -> webp)
    │   └── compressVideo.ts     # Core differentiator #2 (video -> lightweight webm)
    └── types/
        └── database.ts          # Hand-written types matching schema.sql
```

## 2. Setup (Termux-friendly)

```bash
npx create-next-app@latest pictogram --typescript --tailwind --app
cd pictogram
npm install @supabase/supabase-js @supabase/ssr
# then copy every file from this export into the matching path
```

`.env.local` (copy from `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Run the schema against your Supabase project:

```bash
# paste supabase/schema.sql into the Supabase SQL editor, or:
supabase db execute -f supabase/schema.sql
```

## 3. Design system (why it looks the way it does)

- **Palette**: near-black indigo surface (`#0B0F19` / `#131826`) in dark mode,
  soft off-white (`#F7F9FC` / `#FFFFFF`) in light mode, both driven by the
  same blue → cyan gradient used in the Pictogram logo (`#2547F4 → #17C3EC`).
- **Type**: Space Grotesk for display/headings (a little geometric, a little
  camera-lens-y), Inter for body/UI text. Both loaded via `next/font/google`
  so there's zero extra network cost beyond the one subset used.
- **Signature element**: the Tap-to-Play overlay is not a generic triangle.
  It's a segmented aperture/iris (matching the blades in the logo mark) that
  rotates open when tapped, right before the video starts streaming. It's the
  one animated flourish in the whole app — everything else stays quiet.

## 4. Architecture notes on the core differentiators

1. **Tap-to-Play** — `<video preload="none">` is never given a `src` until
   the user taps. Before that, we render `thumbnail_url` (a small pre-generated
   JPEG/WebP frame) blurred behind a CSS `backdrop-filter`, so nothing streams
   from Supabase Storage until there's real intent.
2. **Compression** — `compressImage.ts` resizes on a `<canvas>` to a max width
   of 1080px and re-encodes as `.webp` at ~0.8 quality before upload.
   `compressVideo.ts` re-encodes on a low-res offscreen canvas via
   `MediaRecorder` (VP9/VP8 webm) — no ffmpeg.wasm, no multi-MB wasm download,
   keeps things Termux/mobile-friendly.
3. **Account Health** — `account_strikes` table + `/profile/account-health`
   page. Every strike is visible to the user it belongs to (RLS-enforced),
   with a one-tap appeal flow instead of a silent shadowban.
4. **Ephemeral Stories** — `stories.expires_at` defaults to `now() + 24h`.
   A Postgres function + `pg_cron` job (or a scheduled Supabase Edge
   Function, see `schema.sql` bottom) purges expired rows and their Storage
   objects on a timer.
5. **Chat** — `conversations` / `conversation_participants` / `messages`
   tables, realtime via `supabase.channel(...).on('postgres_changes', ...)`.

