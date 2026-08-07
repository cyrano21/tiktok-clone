# ORKY Reality Integration Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove misleading demo behavior from the production-facing ORKY experience and connect existing UI surfaces to real backend contracts.

**Architecture:** Keep the existing Fastify/Prisma API as the source of truth. Frontend services will expose typed loading/error/empty states instead of silently falling back to invented data. Unsupported commercial or external-platform capabilities will return explicit unavailable states until a real provider exists.

**Tech Stack:** Next.js 14, React Native Web, TypeScript, Fastify, Prisma, PostgreSQL, Redis, Docker Compose, Jest, Playwright.

## Global Constraints

- No fabricated profile, message, payment, analytics, or Discover content in production-facing screens.
- `CORS_ORIGINS` and `NEXT_PUBLIC_API_BASE_URL` are the canonical API configuration names.
- Production secrets must be required; no hardcoded JWT, database, Redis, or provider secrets.
- Only authorized admin/moderator roles may mutate tenant branding.
- Unsupported Shop payment and cross-posting providers must fail explicitly without creating a successful order/job.
- Every behavior change must have focused automated coverage and fresh typecheck/build/E2E verification.

---

### Task 1: Remove React Native Web warnings

**Files:**
- Modify: `src/components/shared/BottomSheet.tsx`
- Modify: `src/components/core/VideoPlayer.tsx`
- Modify: `__tests__/components/BottomSheet.test.tsx`

- [ ] Replace `TouchableWithoutFeedback` with `Pressable` while preserving backdrop and video press behavior.
- [ ] Move the backdrop test hook to a React Native Web-compatible test identifier and update the test to use Testing Library queries.
- [ ] Run the focused BottomSheet test and confirm no `TouchableWithoutFeedback` or unknown `testID` warning is emitted by that test.

### Task 2: Connect Discover to the backend

**Files:**
- Modify: `backend/src/routes/feed.routes.ts`
- Create: `src/services/discoverService.ts`
- Modify: `src/screens/ExploreScreen.tsx`
- Modify: `__tests__/screens-data-interactions.test.tsx`
- Create/modify: `__tests__/discover-service.test.ts`

- [ ] Add `GET /v1/feed/discover?category=&page=&limit=` with category validation and real Prisma video queries.
- [ ] Support `all`, `trending`, `music`, `comedy`, `sports`, `food`, and `beauty`; use trending flags/scores for trending and sound/hashtag/description matching for the topical categories.
- [ ] Map backend videos into Discover cards without Picsum fallback in the production service.
- [ ] Add loading, error, retry, and empty states in Discover; category changes must cancel stale results and reload from the API.
- [ ] Update tests to mock the service boundary and verify category changes produce distinct rendered cards.

### Task 3: Harden identity, branding, and auth

**Files:**
- Modify: `backend/src/routes/branding.routes.ts`
- Modify: `backend/src/controllers/auth.controller.ts`
- Modify: `backend/prisma/schema.prisma`
- Modify: `src/store/sessionStore.ts`
- Modify: `src/hooks/useMyProfile.ts`
- Add focused backend/frontend tests where existing test conventions allow.

- [ ] Require `admin` or `moderator` for all branding writes/resets, including `default`.
- [ ] Require `JWT_REFRESH_SECRET` in production and validate auth register/login/refresh payloads with Zod.
- [ ] Change Prisma branding defaults to ORKY values and add the corresponding migration when migrations are present.
- [ ] Ensure guest session state is neutral and profile fallback never invents metrics or posts.

### Task 4: Align production deployment

**Files:**
- Modify: `docker-compose.prod.yml`
- Modify: `next.config.js`
- Modify: `DEPLOY_COOLIFY.md`
- Modify: `README.md` if configuration references are stale.

- [ ] Use repository-root build context for the backend Dockerfile.
- [ ] Replace legacy variable names with `CORS_ORIGINS` and `NEXT_PUBLIC_API_BASE_URL`.
- [ ] Add production wiring for PostgreSQL, Redis, MinIO, LiveKit, Stripe, TikTok, and the scraper URL without insecure fallback values.
- [ ] Remove the hardcoded public backend URL from Next rewrites and fail clearly when production configuration is absent.
- [ ] Document Coolify variables and health checks without recording secret values.

### Task 5: Stop misleading commerce, messaging, and external-platform behavior

**Files:**
- Modify: `src/screens/shop/CheckoutScreen.tsx`
- Modify: `src/screens/inbox/InboxListScreen.tsx`
- Modify: `src/screens/inbox/ChatScreen.tsx`
- Create: `src/services/messageService.ts`
- Modify: `backend/src/routes/publish.routes.ts`
- Modify: `src/screens/studio/StudioScraperScreen.tsx`
- Modify relevant tests/E2E.

- [ ] Prevent Shop checkout from displaying success or creating local orders until a real payment/order API exists.
- [ ] Replace inbox and chat mock arrays/auto-replies with the existing authenticated message routes and explicit empty/error states.
- [ ] Reject unsupported cross-post platforms instead of creating jobs that no worker can publish.
- [ ] Restrict scraper iframe URLs to an HTTPS configured origin in production and show unavailable state when not deployed.

### Task 6: Verify and review

**Files:** all changed files.

- [ ] Run focused Jest tests.
- [ ] Run complete Jest, frontend typecheck, backend typecheck/build, and frontend build.
- [ ] Run Playwright desktop/mobile tests for profile, Discover, navigation, and no-warning smoke paths.
- [ ] Run `git diff --check` and obtain a code review.
- [ ] Leave changes uncommitted unless the user separately requests commit/push.
