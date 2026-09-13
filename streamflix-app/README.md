# StreamFlix

A React + Vite streaming platform frontend, wired end-to-end to Supabase (auth, watchlist,
ratings, watch history, friends, real-time chat, watch parties) and ready for Stripe checkout
and your own video stream sources.

## 1. Install

```bash
npm install
```

## 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env` with your real values:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_GOOGLE_CLIENT_ID=...
VITE_STRIPE_PUBLISHABLE_KEY=...
```

- **Supabase URL / anon key**: Project Settings → API in your Supabase dashboard.
- **Google Client ID**: only needed if you also call Google's SDK directly somewhere;
  the actual OAuth flow here goes through **Supabase Auth's Google provider**, which
  you enable in Supabase Dashboard → Authentication → Providers → Google (paste your
  Google OAuth Client ID/Secret there, not just in `.env`).
- **Stripe key**: from your Stripe dashboard, test or live publishable key.

## 3. Set up the database

Run `supabase-schema.sql` (included in this delivery) in the Supabase SQL editor.
It creates: `profiles`, `titles`, `episodes`, `ratings`, `watchlist`, `watch_history`,
`friendships`, `messages`, `watch_parties`, `watch_party_members`, plus RLS policies.

Then populate `titles` and `episodes` with your real content and stream links.
`episodes.stream_urls` is a JSON column — put your server URLs there, e.g.:

```json
{ "server1": "https://your-cdn.example.com/ep1.m3u8", "server2": "https://backup.example.com/ep1.mp4" }
```

The player and server-switcher buttons read directly from whatever keys exist in that object.

## 4. Enable Realtime

In Supabase Dashboard → Database → Replication, enable Realtime on the `messages` and
`watch_parties` tables so chat and Watch Party sync work live.

## 5. Run it

```bash
npm run dev
```

## 6. Stripe checkout (not yet live)

The Subscription page has working UI and button states, but the actual checkout call is
a placeholder (see the `handleCheckout` function in `src/pages/Subscription.jsx`). To make
it real:

1. Create a Supabase Edge Function (or any backend endpoint) that takes a Stripe price ID,
   creates a Checkout Session, and returns `session.url`.
2. Replace the `alert(...)` in `handleCheckout` with a `fetch` to that endpoint, then
   `window.location.href = session.url`.
3. Add a Stripe webhook that listens for `checkout.session.completed` and sets
   `profiles.is_premium = true` for that user.

## File structure

```
src/
├── components/     Navbar, SearchBar, VideoPlayer, ContentRail, Footer, ProtectedRoute, ErrorBoundary
├── pages/           Home, Browse (movies/series), TitleDetail, Settings, Subscription, Friends, StaticPage
├── contexts/        AuthContext, I18nContext, ThemeContext
├── lib/             supabaseClient.js, api.js (all DB calls), config.js (env-driven constants)
├── i18n/            strings.js (English/French/Arabic)
└── styles/          global.css (design tokens + shared classes)
```

## Notes on what's real vs. placeholder

**Fully wired to Supabase:** auth/session, profile + auto user_code, watchlist, ratings +
average recompute, watch history/continue watching, friend requests, real-time chat, watch
party session creation.

**UI-complete, backend-pending (by design, per your request):**
- Stream URLs — you're adding these directly in Supabase.
- Stripe checkout call — button and states work, actual payment call is stubbed.
- Image/voice message upload — bubbles render correctly, actual file upload to Supabase
  Storage isn't wired (needs you to create a storage bucket + policy first).
- Watch Party playback sync — session creation and DB row work; the actual "seek together"
  logic needs `subscribeToParty` (already in `lib/api.js`) hooked into the `VideoPlayer`
  component once you're ready to test it with two real accounts.
