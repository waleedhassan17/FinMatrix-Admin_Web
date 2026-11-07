# FinMatrix Admin — Web

The FinMatrix **platform console**, in a browser. Approve companies, review
payment submissions, and watch revenue across every business on the platform.

It is the third client in the family, and the second console:

| | |
|---|---|
| [FinMatrix](https://github.com/waleedhassan17/FinMatrix) | the customer app (React Native) |
| FinMatrix-Web | the customer website (Vite + React) |
| [FinMatrix-Admin-App](https://github.com/waleedhassan17/FinMatrix-Admin-App) | the platform console on Android |
| **this repo** | the platform console on the web |

Reviewing a payment screenshot against a figure is table work, and a phone is
the wrong shape for it. This is that job on a screen with room.

## Running it

```bash
npm install
npm run dev        # http://localhost:5174
```

Port **5174**, not the website's 5173, so both can run at once.

## Which API it talks to

`src/networks/network/apiHelpers.ts`:

```ts
export const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  'https://finmatrix-api.duckdns.org/api/v1';
```

> **The default is production.** Approve and Reject on the Payments page settle
> real money for real customers. Point somewhere else before testing them:
>
> ```bash
> VITE_API_URL=http://localhost:3000/api/v1 npm run dev
> ```

**CORS.** The backend allows an origin only if it is in `CORS_ORIGINS`
(comma-separated, `credentials: true`, see its `main.ts`). It defaults to `*`
when unset — which is why local development often works before anyone notices —
but a deployed console needs `http://localhost:5174` and its production origin
added explicitly.

## Access

One door. Sign-in posts to `/auth/signin` with `portal: 'admin'`, which is the
door the server admits **both** company owners and the platform console
through — so an owner's correct password succeeds at the server, and
`authLogin` refusing any role that is not `super_admin` is the only thing
keeping them out. The refusal happens *before* tokens are stored, so nothing is
left behind. `authMe` applies the same check when restoring a session, which
catches a token left on this origin by a tenant build.

The server's `@Roles` guards remain the real boundary; both checks are UX.

## Layout

```
src/
  app/          Providers, router, lazyPages, queryClient, observability
  components/   ui/ primitives + layout/ (ported from FinMatrix-Web)
  config/       nav.ts — the six sidebar links
  features/
    auth/       SessionGate (boot + guards), useSignOut
    shell/      AppLayout, Sidebar, Topbar
  models/       platform, submission, revenue, trial, planFeatures (+ tests)
  networks/     network/apiHelpers, auth/, superAdmin/
  pages/        one folder per route
  store/        authSlice — identity only
  theme/        tokens.ts, status.ts — the design system
```

Redux holds **identity only**; TanStack Query holds every piece of server data.
The split exists because route guards and the axios interceptor need to know who
you are synchronously, during render, which a query cannot do.

### Three things that will bite

1. **The screenshot endpoint is auth-gated and streams binary.** A plain
   `<img src="…/screenshot">` sends no `Authorization` header and 401s. It is
   fetched as a blob and handed to `<img>` as an object URL — which the viewer
   must `revokeObjectURL` on close, or every screenshot opened stays in memory
   for the life of the tab. See `ScreenshotDialog` in `PaymentsPage`.
2. **`monthly[].month` is 0-indexed.** The server builds it with
   `getUTCMonth()`, so January is 0. Reading it as 1-indexed shifts every chart
   label back by one and looks entirely plausible. `models/revenue.ts` owns this
   and has the test.
3. **Every amount is in minor units (paisa).** Divide by 100. Prefer the
   server's pre-formatted `*Label` strings where they exist — but fall back to
   `formatMoney`, never to the raw field: `priceMonthly` is a DECIMAL string and
   prints as a bare `4500` next to the `Rs 139,500.00` on every other page.
4. **A width may not be named for a t-shirt size.** Tailwind resolves `max-w-*`
   against `--max-width`, then `--spacing`, then `--container` — spacing
   *first*. Our spacing scale is `xs…xxxxl`, so `max-w-sm` does not mean 24rem,
   it means `var(--spacing-sm)` — 12px. Nothing errors: the class exists and the
   CSS is valid, so the sign-in form simply renders 12px wide. Widths come from
   the `measure` scale instead — `max-w-form`, `-card`, `-panel`, `-dialog`,
   `-copy` — whose names sit outside the spacing range and outside Tailwind's
   own static utilities (`prose` is already taken, at 65ch). `check:tokens`
   fails the build on a t-shirt-sized width or height.

## Checks

```bash
npm run verify        # build + check:tokens + test — the gate
npm run lint          # oxlint
```

`check:tokens` is a hard gate: no hex literals, no `text-[14px]`, no
`fontSize`/`fontWeight`/`fontFamily` outside `theme/tokens.ts` and
`theme/status.ts`, and no t-shirt-sized width or height (see bite 4). Charts
satisfy it by reading `colors.*` and `typography.caption.fontSize` from the
tokens.

## Deploying

Vercel, from `vercel.json`:

- **SPA rewrite** — everything that is not a real file falls through to
  `index.html`. `/assets/` is excluded, so a chunk deleted by a later deploy
  404s instead of being served `index.html` with a JavaScript content type.
  `lazyWithReload` turns that 404 into one reload rather than an error screen.
- **Caching** — hashed assets `immutable` for a year; `index.html` always
  revalidated, which is what makes a deploy visible to an open tab.
- **Security headers** — `X-Frame-Options: DENY` and CSP `frame-ancestors
  'none'` (a console whose buttons settle real payments must not be
  frameable), plus `nosniff`, `Referrer-Policy: no-referrer`, a
  `Permissions-Policy` denying camera/mic/geolocation/payment/USB, and HSTS.

  There is deliberately **no full CSP**. A useful one needs `connect-src` to
  name the API origin, and that origin is a build-time variable
  (`VITE_API_URL`) while `vercel.json` is static — so a `default-src` policy
  committed here would silently break every request the day the API moves.
  Adding one means generating it per environment, not hardcoding it.

Environment variables are in `.env.example`; set `VITE_SENTRY_DSN` in the
Vercel project settings to turn error reporting on (without it the SDK is never
downloaded).

## Not built yet

The backend exposes these and neither console uses them. They are the obvious
next additions, in rough order of value:

- `PATCH /super-admin/companies/:id/feature-override` — the documented kill
  switch (`all_features_unlocked`, checked ahead of any plan logic)
- `GET /super-admin/companies/:id` — a company detail page
- `GET /super-admin/companies?isTrial=` — a trial filter
- `GET|POST /super-admin/subscriptions` — assign a plan to a company
- `POST /admin/payment-submissions/run-expiry-scan`

## Differences from FinMatrix-Web worth knowing

Three things were fixed rather than inherited:

- `--color-overlay` is declared in `@theme`. The customer site uses it in
  `ConfirmDialog` but never defines it, so its modal backdrops are transparent.
- `data-[state=open]:animate-in` was dropped — it comes from
  `tailwindcss-animate`, which is not installed in either project.
- localStorage keys are `@finmatrix-admin/*`. On `localhost` the origin is the
  port and localStorage is **not** partitioned by it, so sharing `@finmatrix/*`
  would let the two apps read each other's session in development.
