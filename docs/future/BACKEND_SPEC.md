# RageRadar — Backend & Cloud Architecture Spec

> **Version:** 0.1.0 (Draft)
> **Last Updated:** 2026-07-06
> **Status:** Planning
> **Depends on:** [ARCHITECTURE.md](./ARCHITECTURE.md), [PRIVACY.md](./PRIVACY.md), [ROADMAP.md](./ROADMAP.md)

---

## Table of Contents

1. [Overview](#overview)
2. [User Modes](#user-modes)
3. [Cloudflare Stack](#cloudflare-stack)
4. [Authentication Flow](#authentication-flow)
5. [Data Schema (D1)](#data-schema-d1)
6. [Object Storage (R2)](#object-storage-r2)
7. [API Endpoints (Workers)](#api-endpoints-workers)
8. [Leaderboard System](#leaderboard-system)
9. [Privacy & Consent](#privacy--consent)
10. [Migration Path](#migration-path)

---

## Overview

RageRadar currently operates as a **100% local application** — all camera/mic processing, rage scoring, and session storage happen in the browser (IndexedDB). This spec introduces an **optional cloud layer** for authenticated users, enabling:

- **Rage clip cloud storage** (R2)
- **Cross-device session sync** (D1)
- **Community leaderboards** (D1 + Workers)
- **User profiles** (D1)

Guest users retain the full local experience without any cloud dependency.

`
+-----------------------+       +---------------------------+
|    GUEST MODE         |       |    AUTHENTICATED MODE     |
|-----------------------|       |---------------------------|
| Camera + Mic input    |       | Camera + Mic input        |
| Local fusion engine   |       | Local fusion engine       |
| IndexedDB sessions    |       | IndexedDB + D1 cloud sync |
| No clips saved        |       | Rage clips -> R2          |
| No leaderboard        |       | Leaderboard access        |
| No login required     |       | Google / Discord OAuth    |
+-----------------------+       +---------------------------+
`

---

## User Modes

### Guest Mode (Default)

- No login required.
- Full access to: real-time rage meter, session timeline, alerts, settings.
- Sessions stored in **IndexedDB only** (browser-local).
- **Cannot** save rage clips to cloud.
- **Cannot** access or appear on leaderboards.
- **Cannot** sync data across devices/browsers.
- Privacy: Zero data leaves the browser.

### Authenticated Mode

- Login via **Google OAuth 2.0** or **Discord OAuth 2.0**.
- Everything in Guest Mode, plus:
  - Rage clips automatically uploaded to **Cloudflare R2**.
  - Session summaries synced to **Cloudflare D1** for cross-device access.
  - Appear on **community leaderboards** (opt-in per category).
  - User profile with display name and avatar.
- Privacy: Only session **summary stats** and **clips** leave the browser. Raw camera/mic data is **never** uploaded.

### Mode Switching

- Users can upgrade from Guest to Authenticated at any time via a login prompt.
- Existing local sessions can be optionally bulk-synced to cloud upon first login.
- Authenticated users can log out and continue in Guest mode without losing local data.

---

## Cloudflare Stack

The backend runs entirely on the Cloudflare platform, leveraging the existing `wrangler.toml` configuration:

| Service | Purpose | Billing Model |
|---------|---------|---------------|
| **Workers** | API gateway, auth proxy, leaderboard logic | Free tier: 100K req/day |
| **D1** | User accounts, session metadata, leaderboard rankings | Free tier: 5GB, 5M reads/day |
| **R2** | Rage clip video storage (WebM blobs) | Free tier: 10GB, 10M reads/month |
| **KV** | Auth session tokens, rate limiting counters | Free tier: 100K reads/day |

`
Browser (Frontend)
    |
    v
Cloudflare Workers (API Gateway)
    |--- /auth/*        --> Google/Discord OAuth flow
    |--- /api/clips/*   --> R2 (presigned upload/download)
    |--- /api/sessions  --> D1 (session sync)
    |--- /api/leaderboard --> D1 (rankings query)
    |--- /api/profile   --> D1 (user profile CRUD)
    |
    +-- KV: session tokens, rate limits
    +-- D1: users, sessions, leaderboard
    +-- R2: rage clip files (WebM)
`

---

## Authentication Flow

### Providers

| Provider | Client ID Source | Scopes | User Data Retrieved |
|----------|-----------------|--------|---------------------|
| **Google** | Google Cloud Console | `openid`, `email`, `profile` | Email, display name, avatar URL |
| **Discord** | Discord Developer Portal | `identify`, `email` | Username, discriminator, avatar hash |

### OAuth 2.0 Authorization Code Flow

`
1. User clicks "Login with Google/Discord"
2. Browser redirects to provider's /authorize endpoint
3. User grants consent
4. Provider redirects back to Workers callback URL with auth code
5. Worker exchanges code for access token (server-side)
6. Worker fetches user profile from provider API
7. Worker upserts user in D1
8. Worker creates a session token, stores in KV (TTL: 30 days)
9. Worker sets HttpOnly secure cookie with session token
10. Browser receives 302 redirect back to app with auth cookie set
`

### Session Management

- **Token format:** Opaque random string (`crypto.randomUUID()`)
- **Storage:** KV with 30-day TTL
- **Validation:** Every authenticated API request checks the cookie against KV
- **Logout:** Deletes KV entry + clears cookie

### Frontend Integration

`javascript
// Check auth status on app load
const res = await fetch('/auth/me', { credentials: 'include' });
if (res.ok) {
  const user = await res.json();
  // Show authenticated UI: avatar, leaderboard tab, clip upload
} else {
  // Show guest UI: local-only, login prompt in settings
}
`

---

## Data Schema (D1)

### `users` Table

`sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,          -- UUID
  provider      TEXT NOT NULL,             -- 'google' | 'discord'
  provider_id   TEXT NOT NULL,             -- Provider's user ID
  email         TEXT,                      -- Optional, from OAuth
  display_name  TEXT NOT NULL,             -- Shown on leaderboard
  avatar_url    TEXT,                      -- Profile picture URL
  created_at    INTEGER NOT NULL,          -- Unix timestamp ms
  updated_at    INTEGER NOT NULL,          -- Unix timestamp ms
  UNIQUE(provider, provider_id)
);
`

### `sessions` Table (Cloud Sync)

`sql
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,          -- Same UUID as IndexedDB
  user_id       TEXT NOT NULL REFERENCES users(id),
  started_at    INTEGER NOT NULL,          -- Unix timestamp ms
  ended_at      INTEGER,                   -- Unix timestamp ms
  duration_ms   INTEGER NOT NULL,          -- Active duration
  avg_rage      REAL NOT NULL,             -- Average rage score
  max_rage      REAL NOT NULL,             -- Peak rage score
  spikes        INTEGER NOT NULL DEFAULT 0,-- Count of scores >= 80
  game_profile  TEXT,                      -- Game name (Phase 2)
  clip_key      TEXT,                      -- R2 object key (if clip saved)
  histogram     TEXT,                      -- JSON array of 10-bin distribution
  synced_at     INTEGER NOT NULL           -- When this was uploaded
);

CREATE INDEX idx_sessions_user ON sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_leaderboard ON sessions(avg_rage ASC, started_at DESC);
`

### `leaderboard_optins` Table

`sql
CREATE TABLE leaderboard_optins (
  user_id       TEXT PRIMARY KEY REFERENCES users(id),
  opted_in      INTEGER NOT NULL DEFAULT 0,  -- 0 = out, 1 = in
  categories    TEXT NOT NULL DEFAULT '[]',  -- JSON array of opted categories
  updated_at    INTEGER NOT NULL
);
`

---

## Object Storage (R2)

### Bucket Structure

`
rageradar-clips/
  {user_id}/
    {session_id}.webm          -- Rage clip video (15s, ~2-5MB)
    {session_id}_thumb.jpg     -- Thumbnail (auto-generated, ~50KB)
`

### Upload Flow

1. Frontend requests a **presigned upload URL** from Workers:
   `POST /api/clips/upload-url` → returns `{ url, key }`
2. Frontend uploads the WebM blob directly to R2 via the presigned URL.
3. Frontend confirms upload to Workers:
   `POST /api/clips/confirm` → Worker updates D1 `sessions.clip_key`

### Clip Limits

| Constraint | Value |
|------------|-------|
| Max clip duration | 15 seconds |
| Max file size | 10 MB |
| Max clips per user | 100 (oldest auto-deleted) |
| Supported format | WebM (VP8/VP9 + Opus) |

### Download Flow

- Authenticated users fetch their own clips via presigned download URLs.
- Leaderboard clips (if shared) are served via public R2 URLs with cache headers.

---

## API Endpoints (Workers)

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/google` | Redirect to Google OAuth |
| GET | `/auth/discord` | Redirect to Discord OAuth |
| GET | `/auth/callback/google` | Google OAuth callback |
| GET | `/auth/callback/discord` | Discord OAuth callback |
| GET | `/auth/me` | Get current user (from cookie) |
| POST | `/auth/logout` | Clear session |

### Sessions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sessions` | List user's synced sessions |
| POST | `/api/sessions` | Sync a completed session to cloud |
| DELETE | `/api/sessions/:id` | Delete a synced session |

### Clips

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/clips/upload-url` | Get presigned R2 upload URL |
| POST | `/api/clips/confirm` | Confirm clip upload |
| GET | `/api/clips/:sessionId` | Get presigned download URL |
| DELETE | `/api/clips/:sessionId` | Delete a clip from R2 |

### Leaderboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/leaderboard/:category` | Get top N rankings |
| PUT | `/api/leaderboard/optin` | Opt in/out of leaderboard |

---

## Leaderboard System

### Categories

| Category | Metric | Description |
|----------|--------|-------------|
| **Calmest Gamer** | Lowest `avg_rage` (min 5 sessions) | Weekly ranking of players with the lowest average rage |
| **Iron Will** | Longest session without a spike (rage < 60) | Most time spent gaming without tilting |
| **Redemption Arc** | Biggest week-over-week avg rage improvement | Player who improved the most compared to last week |

### Rules

- Leaderboard participation is **opt-in** (not automatic upon login).
- Display names are shown (no email/real name unless chosen).
- Users can opt out at any time, removing their entries.
- Minimum **5 sessions** required to appear on any leaderboard.
- Rankings refresh **daily** (computed by a scheduled Worker cron).

### Anti-Cheat

- Sessions shorter than 2 minutes are excluded from leaderboard calculations.
- Rage score data is validated server-side (avg must be within 0-100 range, spikes count must be consistent with histogram).
- Anomalous patterns (e.g., 100 sessions all with 0.0 avg rage) are flagged for review.

---

## Privacy & Consent

> **This section supplements [PRIVACY.md](./PRIVACY.md), which must be updated when this spec is implemented.**

### What NEVER leaves the browser

| Data | Storage |
|------|---------|
| Raw webcam video frames | Processed in-memory only, never saved |
| Raw microphone audio stream | Processed in-memory only, never saved |
| face-api.js expression tensors | Discarded after scoring |
| Second-by-second rage data points | IndexedDB only (local) |

### What CAN be uploaded (authenticated users only)

| Data | Destination | User Consent |
|------|-------------|--------------|
| Session summary stats (avg, max, duration) | D1 | Implicit (by logging in) |
| Rage clips (15s WebM video) | R2 | Explicit (user triggers recording) |
| Display name + avatar | D1 | From OAuth profile |
| Leaderboard participation | D1 | Explicit opt-in toggle |

### Data Retention

- **Cloud sessions:** Retained until user deletes or deletes account.
- **Rage clips:** Auto-deleted after 90 days, or when user deletes.
- **Account deletion:** Full cascade delete of all D1 records + R2 objects within 24 hours.
- **KV tokens:** Auto-expire after 30 days (TTL).

### GDPR / Data Rights

- Users can export all their data via `GET /api/profile/export` (JSON dump).
- Users can delete their account via `DELETE /api/profile` (cascade).
- No data is shared with third parties.
- No analytics or tracking beyond what is described above.

---

## Migration Path

### From Current Architecture (Local-Only)

The cloud layer is **additive** — it does not replace any existing local functionality:

1. **Phase 1 (Current):** 100% local. IndexedDB. No server.
2. **Phase 2a — Auth:** Add Google + Discord OAuth via Workers. Login button in settings panel. `/auth/*` endpoints.
3. **Phase 2b — Cloud Sync:** Add D1 schema. Sync session summaries on stop (if logged in). `/api/sessions` endpoints.
4. **Phase 2c — Clips:** Add R2 bucket. Implement `MediaRecorder` clip capture + upload. `/api/clips` endpoints.
5. **Phase 2d — Leaderboard:** Add leaderboard tables. Scheduled Worker cron for ranking. `/api/leaderboard` endpoints. Leaderboard UI tab.

### Offline Resilience

- If the user is authenticated but offline, sessions save to IndexedDB as usual.
- A sync queue (stored in IndexedDB) retries cloud upload when connectivity returns.
- Clips are saved locally first, then uploaded in the background.

---

## 📌 Development Reference

> **RTK & Context7 Policy**
>
> Use **RTK** for all CLI operations. Consult **Context7** for Cloudflare Workers, D1, R2, and KV API patterns before implementation.
>
> Relevant Context7 library IDs:
> - Cloudflare Workers: query via `resolve-library-id`
> - Hono (recommended Workers framework): `/honojs/hono`
>
> **No library integration should begin without first consulting Context7 for the latest API patterns and best practices.**
