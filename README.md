# Almanac

Pin-anchored feedback for any web page — built from `SEED.md`.

This repository implements the **six mandatory requirements (R1–R6)** and the
acceptance journey described in §4 of the seed. Differentiators (threads,
realtime, drag, versions, status filters) are deliberately deferred.

## Stack

- Next.js 15 (App Router) + TypeScript
- Supabase (Postgres + Auth Google) via `@supabase/ssr`
- Tailwind CSS
- Zod for input validation
- Deploy target: Vercel

## Project layout

```
app/                  routes (landing, auth, dashboard, projects, share)
components/           Editor, PageFrame, PinsOverlay, dashboard widgets
lib/                  Supabase helpers, anchor + message types, auth guard
supabase/migrations/  schema + RLS + share RPCs
middleware.ts         refreshes the Supabase session on every request
```

## Setup

### 1. Install

```sh
npm install
```

### 2. Provision Supabase

1. Create a project at <https://supabase.com>.
2. From the SQL editor (or the Supabase CLI), apply every file in
   `supabase/migrations/` in lexicographic order. Locally:
   ```sh
   supabase start
   supabase db reset
   ```
3. **Enable Google OAuth** in **Authentication → Providers → Google**:
   - Create an OAuth client in <https://console.cloud.google.com/apis/credentials>.
   - Set **Authorized redirect URI** to
     `https://<project-ref>.supabase.co/auth/v1/callback`.
   - Paste the client ID and secret back into Supabase.
4. In **Authentication → URL Configuration**:
   - Set **Site URL** to your deployment (e.g. `https://<app>.vercel.app`).
   - Add additional redirect URLs for local dev (`http://localhost:3000`) and
     any preview environments.

### 3. Environment variables

Set these locally (e.g. `.env.local`) and on Vercel for **Production** and
**Preview**:

```
NEXT_PUBLIC_SUPABASE_URL=<your supabase url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<your supabase service role key>
NEXT_PUBLIC_SITE_URL=<https://your-app.vercel.app or http://localhost:3000>
```

`SUPABASE_SERVICE_ROLE_KEY` is not used at runtime in the MVP — public share
reads/writes go through `SECURITY DEFINER` RPCs — but it is wired up for
future admin tooling. **Never commit it.**

### 4. Run locally

```sh
npm run dev
```

Open <http://localhost:3000>.

### 5. Deploy on Vercel

1. Import the repo from Git.
2. Set the four env vars above on **Production** and **Preview**.
3. Add `https://<app>.vercel.app/auth/callback` to Supabase Auth's redirect URL
   list.
4. Deploy. The first request will lazily refresh the session via
   `middleware.ts`.

## Acceptance checklist (R1–R6)

These are the exact steps an evaluator should follow on the deployed app.

### R1 — Sign in with Google
- [ ] Visit `/`. Click **Sign in with Google**, complete OAuth, land on
  `/dashboard` with email shown in the header.
- [ ] In a private window, visit `/dashboard`. You are redirected to `/login`.

### R2 — Upload and render
- [ ] On `/dashboard`, paste an HTML document (or upload a `.html` file) and
  give it a name.
- [ ] Submitting opens `/projects/<id>` and the page renders inside an iframe
  identical to the original (images, inline CSS, fonts visible).

### R3 — Find it again
- [ ] Return to `/dashboard`. The project appears in the list with status
  `active`.
- [ ] Reload `/dashboard`. Project persists.

### R4 — Share
- [ ] Inside `/projects/<id>`, click **Copy share link**. URL is
  `/share/<token>`.
- [ ] Open the link in a different browser that has no session. The page
  renders. Clicking **Add pin** redirects to `/login` (writes require auth by
  design).

### R5 — Anchored feedback
- [ ] After signing in (preferably with a second Google account), open the
  share link, click **Add pin**, then click somewhere on the page. A comment
  popover opens at that exact point. Type a comment and save.

### R6 — The pin sticks and is shared
- [ ] Back on the owner's `/projects/<id>`, the pin is visible at the same
  relative position, with the comment in the right sidebar.
- [ ] Resize the browser viewport — the pin stays anchored to the same
  relative point on the rendered content.
- [ ] As the owner, reply in the sidebar and click **Resolve**. Reload — both
  the reply and the resolved state persist.

## Notes on design choices

- The pin anchor is stored as `{ xPct, yPct, selector, selectorOffset,
  scrollHeight }` so it survives viewport changes. The owner-side overlay
  re-projects pins from those normalized values on every viewport update.
- The user HTML renders inside `<iframe sandbox="allow-scripts">` **without**
  `allow-same-origin`. That gives an opaque origin: the iframe cannot read or
  write the parent's cookies/storage, and the only channel back is
  `postMessage`. A short capture script is injected via `srcDoc` to send
  clicks/scrolls to the parent.
- `/share/<token>` reads go through the `get_project_by_share_token`
  SECURITY DEFINER function, so no anon SELECT policy ever exposes the
  `projects` table.
- Writes from the share link go through `add_pin_via_share_token` and
  `add_comment_via_share_token`, which require `auth.uid()` and validate the
  token before inserting.

## What is intentionally NOT implemented (SEED §6 — differentiators)

- Threaded comments UI (`comments.parent_id` exists in schema, no UI).
- Edit/soft-delete of comments (columns exist, no UI).
- Supabase Realtime presence/activity feed.
- Drag-to-reposition pins, pin clustering.
- Multiple pages per project in the UI (schema supports it, MVP UI uses one).
- Status filter / counters on the dashboard.
- Emoji reactions.

Any of these can be added without schema changes (except reactions).
