# Automonk — Implementation Checklist (PRD v4.1)

Last updated: 2026-03-20

---

## Phase 1 — Core pipeline (Instagram, single client) ✅
- [x] Project scaffold, folder structure, package.json
- [x] PostgreSQL schema (all tables including `client_settings`, `post_stats`, `client_strategy`)
- [x] Claude API: idea generation + master script + platform adaptation
- [x] Satori + resvg renderer (HTML/CSS → PNG without headless browser)
- [x] InstagramAdapter: publish carousel + fetch stats + delete
- [x] BullMQ scheduler + Redis integration
- [x] Docker Compose: app / worker / bot / postgres / redis services
- [x] Telegram bot: `/start` help menu

---

## Phase 2 — All platforms, single client ✅
- [x] Generic `PlatformAdapter` interface
- [x] `FacebookAdapter` (Meta Graph API) — publish / stats / delete / validateCredentials / refreshToken / formatContent
- [x] `YouTubeAdapter` — stats via YouTube Analytics API; publish() and deletePost() intentionally throw (manual workflow per PRD)
- [x] `LinkedInAdapter` (LinkedIn API v2) — full adapter
- [x] `TwitterAdapter` (Twitter API v2) — full adapter
- [x] `ThreadsAdapter` (Threads API) — full adapter
- [x] YouTube content package builder: adapted community post text (≤500 chars) + 10 slide PNGs rendered and uploaded to MinIO
- [x] YouTube manual post Telegram notification: "📦 YouTube package ready for client X"
- [x] Per-platform Claude adaptation driven by `client_settings`
- [x] Per-platform hashtag sets and CTA preferences from `client_settings`
- [x] Multi-platform scheduling and confirmation via BullMQ

---

## Phase 3 — Multi-client + full settings control ✅
- [x] Multi-client data model (full isolation per client)
- [x] Full `client_settings` implementation (all 9 settings: platforms, posting times, niche/tone, template, hashtags, CTA, frequency, approval mode, weekly opt)
- [x] Per-client approval mode: supervised → auto-publish
- [x] **Auto supervised → auto-publish after 14 days**: daily cron at 00:05 UTC checks `onboarded_at <= NOW() - INTERVAL '14 days'` and upgrades
- [x] Per-client idea generation frequency cron
- [x] Per-client platform toggling (operator-managed)
- [x] Per-client template path stored in `platform_accounts.template_path`

---

## Phase 4 — Optimization loop ✅
- [x] Weekly stats fetch from all 6 platform adapters (every Sunday 23:00)
- [x] Claude per-client strategy analysis (`strategyAnalyzer.js`) — top topics, hook styles, CTA performance, best times, platform comparison
- [x] Versioned `client_strategy` storage and injection into all future Claude prompts
- [x] Weekly Telegram summary: best post, key strategy shift, dashboard link

---

## Phase 5 — Web dashboard (partial) ⚠️

### Done ✅
- [x] Vite + React + Tailwind dashboard with brand-compliant dark theme
- [x] JWT auth with operator and client roles (`requireAuth`, `requireOperator`, `requireClientAccess`)
- [x] REST API: stats, schedules, posts, clients, platform-accounts, pipeline routes
- [x] Operator: client list + create/archive (`Clients.jsx`)
- [x] Operator: per-client detail with all 9 settings (`ClientDetail.jsx`)
- [x] Operator: pipeline view — list posts with approve / reject / delete variant per platform (`Pipeline.jsx`)
- [x] Operator: scheduler calendar — 7-day grid view with week navigation and client filter (`Scheduler.jsx`)
- [x] Operator: analytics — cross-platform charts, per-client stats, strategy section (`Analytics.jsx`)
- [x] Operator: platform OAuth connections UI — connect / disconnect per client (`Connections.jsx`)
- [x] Operator: manual carousel creator — 3-step wizard with 5 template styles, slide editor, schedule (`CreateCarousel.jsx`)
- [x] Operator: pipeline trigger button per client (calls `POST /api/pipeline/trigger`)
- [x] Strategy viewer embedded in `ClientDetail.jsx` — shows current strategy with top themes and content recommendations

### Missing / Incomplete ❌

#### Telegram alerts
- [ ] **12-hour approval pending reminder**: Cron job to detect posts stuck in `approval_pending` > 12 hours and send Telegram reminder (PRD §5, step 5)
- [ ] **Performance drop alert**: Detect >30% week-over-week reach decrease per platform in `strategyAnalyzer.js` and send Telegram alert (PRD §11, step 3)
- [ ] **Proactive token expiry validation**: Daily cron to call `adapter.validateCredentials()` for all active platform accounts and alert on failures before publish time (currently only checked at publish time in `publishWorker.js`)

#### YouTube manual workflow
- [ ] **YouTube package dashboard view**: Dedicated UI panel showing the adapted community post text + all 10 slide PNG thumbnails for a YouTube variant, with a copy-to-clipboard button for the text
- [ ] **"Mark as posted" for YouTube**: UI button + `PATCH /api/posts/variants/:id/youtube-posted` endpoint to record the YouTube community post ID after operator uploads manually and transition variant status to `posted`

#### Scheduler actions
- [ ] **Reschedule**: Allow operator to change `scheduled_at` for any queued variant (update DB + BullMQ delay)
- [ ] **Cancel scheduled post**: Cancel a BullMQ job and mark variant as `cancelled`
- [ ] **Post now**: Trigger immediate publish by setting delay to 0 on the BullMQ job

#### Delete post
- [ ] **Dashboard multi-platform delete modal**: When deleting a posted post, show checkboxes for each live platform (all checked by default), let operator deselect, then delete from selected platforms in one action (PRD §12; currently single-platform only per variant)

#### Client read-only view
- [ ] **Client dashboard UI**: Differentiate the dashboard by role — clients should see a simplified read-only view showing only their own post stats, upcoming schedule, and past carousel previews; no pipeline controls, no settings, no other clients

#### Template management
- [ ] **Template upload UI**: File upload in `Templates.jsx` — upload `.js` template file to MinIO/local, store path in `platform_accounts.template_path` for the selected client; currently page is a stub with no functionality

#### Content preview
- [ ] **Carousel slide viewer in pipeline**: Click any post in Pipeline to view its rendered slide images (fetched from MinIO URLs in `post_variants.image_urls`)

#### Strategy history
- [ ] **Historical strategy versions**: `ClientDetail.jsx` strategy tab only shows the latest version — add a version list so operator can browse and compare past strategy documents

---

## Infrastructure & Quality
- [ ] **CI/CD pipeline**: GitHub Actions (or similar) — lint, test, Docker build, deploy on push to main
- [ ] **Unit / integration tests**: Core pipeline functions, adapter methods, API endpoints
- [ ] **Nginx reverse proxy config**: Expose only dashboard and API externally; internal Docker network for everything else
- [ ] **Environment variable validation on startup**: Fail fast if required env vars (Claude key, DB credentials, etc.) are missing

---

## Quick Reference — What works end-to-end today

| Feature | Status |
|---|---|
| Full content pipeline (idea → publish) | ✅ Working |
| Telegram `/carousel`, `/stats`, `/delete` | ✅ Working |
| Delete post with per-platform selection (Telegram) | ✅ Working |
| 5 carousel template styles | ✅ Working |
| Manual carousel from dashboard | ✅ Working |
| Auto supervised→auto after 14 days | ✅ Working |
| Weekly optimization + strategy | ✅ Working |
| Token expiry alert on publish failure | ✅ Working |
| YouTube package rendered + Telegram alert | ✅ Working |
| 12-hour pending approval reminder | ❌ Not built |
| Performance drop alert (>30%) | ❌ Not built |
| Proactive token validation cron | ❌ Not built |
| YouTube "mark as posted" UI | ❌ Not built |
| Scheduler reschedule / cancel / post-now | ❌ Not built |
| Dashboard multi-platform delete modal | ❌ Not built |
| Client read-only UI | ❌ Not built |
| Template upload UI | ❌ Not built |
| Carousel viewer in pipeline | ❌ Not built |
