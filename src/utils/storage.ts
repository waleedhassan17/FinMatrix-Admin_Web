// ═══════════════════════════════════════════════════════
// FinMatrix Admin — Session Storage
// ═══════════════════════════════════════════════════════
// Ported from the customer site's src/utils/storage.ts, with two changes.
//
//   1. The keys are namespaced '@finmatrix-admin/*', not '@finmatrix/*'. In
//      production the two sites sit on different origins and could not see each
//      other's localStorage anyway — but in development both run on localhost,
//      where the origin is the port and localStorage is NOT partitioned by it.
//      Sharing the key means signing into one app silently hands its token to
//      the other, and a tenant session read into this console half-authenticates
//      it instead of failing cleanly.
//   2. There is no stored portal role. The console has one door.
//
// Two properties carried over deliberately:
//
//   - These are SYNCHRONOUS. Route guards need to answer "is there a token?"
//     during render, without an await.
//   - Every access is guarded. localStorage THROWS — it does not return null —
//     when a browser blocks site data (Safari private mode, hardened privacy
//     settings). An unguarded read would crash the app at boot rather than send
//     the user to sign-in.

const ACCESS_TOKEN_KEY = '@finmatrix-admin/accessToken';
const REFRESH_TOKEN_KEY = '@finmatrix-admin/refreshToken';

function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked — the session simply will not survive a reload */
  }
}

function removeKeys(...keys: string[]): void {
  try {
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    /* storage blocked — nothing was persisted to begin with */
  }
}

export const setTokens = (accessToken: string, refreshToken: string): void => {
  writeKey(ACCESS_TOKEN_KEY, accessToken);
  writeKey(REFRESH_TOKEN_KEY, refreshToken);
};

export const getAccessToken = (): string | null => readKey(ACCESS_TOKEN_KEY);

export const getRefreshToken = (): string | null => readKey(REFRESH_TOKEN_KEY);

export const clearTokens = (): void =>
  removeKeys(ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY);

/** Cheap synchronous "might we be signed in?" test for route guards. */
export const hasSession = (): boolean => getAccessToken() !== null;

// ─── Notification preferences ───────────────────────
// Mirrors the app's AdminSettings screen, which keeps these under
// '@finmatrix-admin/notifPrefs' in AsyncStorage. Per-device convenience only:
// nothing here is authoritative and nothing is sent to the server.

const NOTIF_PREFS_KEY = '@finmatrix-admin/notifPrefs';

export interface NotificationPrefs {
  newCompanies: boolean;
  paymentSubmissions: boolean;
  trialRequests: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newCompanies: true,
  paymentSubmissions: true,
  trialRequests: true,
};

export const getNotificationPrefs = (): NotificationPrefs => {
  const raw = readKey(NOTIF_PREFS_KEY);
  if (!raw) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    // Spread over the defaults: a preference added in a later release must not
    // read as `undefined` for someone whose stored object predates it.
    return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
};

export const setNotificationPrefs = (prefs: NotificationPrefs): void =>
  writeKey(NOTIF_PREFS_KEY, JSON.stringify(prefs));
