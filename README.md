# QuickMark - Smart Bookmark Manager

A real-time bookmark manager built with Next.js, Supabase, and Tailwind CSS. Users can sign in with Google, save bookmarks, and see changes sync across tabs in real-time.

**Live URL:** [https://quick-mark-rosy.vercel.app](https://quick-mark-rosy.vercel.app)

## Features

- **Google OAuth** - Sign up and log in using Google (no email/password)
- **Add Bookmarks** - Save any URL with a custom title
- **Private Bookmarks** - Each user only sees their own bookmarks (enforced by Row Level Security)
- **Real-time Sync** - Bookmarks update instantly across all open tabs (Supabase Realtime)
- **Delete Bookmarks** - Remove bookmarks with one click
- **Responsive Design** - Works on desktop and mobile

## Tech Stack

- **Next.js 16** (App Router)
- **Supabase** (Auth, PostgreSQL Database, Realtime)
- **Tailwind CSS 4** for styling
- **TypeScript**
- **Deployed on Vercel**

## Project Structure

```
src/
├── app/
│   ├── auth/
│   │   ├── callback/route.ts    # OAuth callback handler
│   │   └── signout/route.ts     # Sign out handler
│   ├── login/page.tsx           # Login page with Google OAuth
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Main dashboard (server component)
│   └── globals.css
├── components/
│   ├── Navbar.tsx               # Navigation with user info & sign out
│   ├── AddBookmarkForm.tsx      # Form to add new bookmarks
│   └── BookmarkList.tsx         # Bookmark list with real-time updates
├── lib/
│   ├── supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server Supabase client
│   └── types.ts                 # TypeScript types
└── middleware.ts                # Auth session refresh & route protection
```

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd QuickMark
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)

2. **Create the bookmarks table** - Go to SQL Editor and run:

```sql
CREATE TABLE bookmarks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own bookmarks
CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own bookmarks
CREATE POLICY "Users can insert own bookmarks"
  ON bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own bookmarks
CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-set user_id on insert
ALTER TABLE bookmarks ALTER COLUMN user_id SET DEFAULT auth.uid();
```

3. **Enable Realtime** - Go to Database > Replication, and enable replication for the `bookmarks` table.

4. **Set up Google OAuth:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or use existing)
   - Enable the Google+ API
   - Go to Credentials > Create Credentials > OAuth Client ID
   - Application type: Web application
   - Add authorized redirect URI: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
   - Copy the Client ID and Client Secret
   - In Supabase Dashboard: Go to Authentication > Providers > Google
   - Enable Google provider and paste Client ID and Client Secret

### 3. Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Find these values in Supabase Dashboard > Settings > API.

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy to Vercel

1. Push code to GitHub
2. Import repo in [Vercel](https://vercel.com)
3. Add the two environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
4. Deploy
5. **Important:** After deploying, add your Vercel URL to:
   - Supabase Dashboard > Authentication > URL Configuration > Site URL: `https://your-app.vercel.app`
   - Supabase Dashboard > Authentication > URL Configuration > Redirect URLs: `https://your-app.vercel.app/auth/callback`
   - Google Cloud Console > OAuth Client > Authorized redirect URIs (Supabase callback stays the same)

## Problems I Ran Into and How I Solved Them

### 1. Auth Session Not Persisting After OAuth Redirect
**Problem:** After signing in with Google, users were redirected back but the session wasn't being picked up, causing infinite redirect loops.

**Solution:** Implemented proper cookie-based session management using `@supabase/ssr` instead of the older `@supabase/auth-helpers-nextjs`. The key was creating separate Supabase clients for server components (using `cookies()` from `next/headers`) and client components (using `createBrowserClient`). The middleware refreshes the session on every request to keep it alive.

### 2. Real-time Updates Not Working Initially
**Problem:** Adding a bookmark in one tab wasn't showing up in another tab. The Supabase Realtime subscription wasn't receiving events.

**Solution:** Two things needed to happen: (1) Enable replication for the `bookmarks` table in Supabase Dashboard > Database > Replication, and (2) Use a filter on the subscription (`filter: user_id=eq.${userId}`) so each client only listens for their own bookmark changes. Without enabling replication, Postgres doesn't broadcast change events.

### 3. Row Level Security Blocking Inserts
**Problem:** When adding a bookmark, the insert was failing silently due to RLS policies. The `user_id` wasn't being set automatically.

**Solution:** Added `ALTER TABLE bookmarks ALTER COLUMN user_id SET DEFAULT auth.uid()` so Supabase automatically sets the `user_id` to the authenticated user's ID on insert. Combined with the RLS `INSERT` policy using `WITH CHECK (auth.uid() = user_id)`, this ensures users can only create bookmarks under their own account without needing to send the user ID from the client.

### 4. Middleware Redirect Loops
**Problem:** The middleware was protecting all routes including static assets and the auth callback route, causing redirect loops.

**Solution:** Used Next.js middleware `matcher` config to exclude static files (`_next/static`, `_next/image`, `favicon.ico`, image files) and explicitly allowed the `/auth` and `/login` paths through without requiring authentication.

### 5. Duplicate Bookmarks Appearing on Add
**Problem:** When adding a bookmark, it would appear twice - once from the optimistic/server response and once from the real-time subscription.

**Solution:** Added a deduplication check in the real-time INSERT handler: `if (prev.some((b) => b.id === payload.new.id)) return prev;`. This ensures that even if the client gets the bookmark from both the initial fetch and the real-time event, only one copy appears in the list.
