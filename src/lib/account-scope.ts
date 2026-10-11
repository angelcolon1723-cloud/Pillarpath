/**
 * Per-account scoping for on-device data.
 *
 * PillarPath's local stores (family ledger, social, teacher workspace) and
 * the plaza's local saves historically persisted under ONE shared key per
 * store, so on a shared device whoever opened the app saw the previous
 * account's on-device entries — the leak behind King's rule that every
 * account gets its own independent dashboard and that's it. Server data
 * was never affected (every server function is role-gated); this module
 * fixes the on-device half.
 *
 * Every persisted key is now namespaced by the signed-in account:
 *   `<base>@<role>:<userId>`     e.g. `kiddo-ledger-v2@parent:9f2…`
 *   `<base>@signed-out`          no account resolved — nothing personal
 *                                is ever read from or written to this
 *                                scope by an account's views.
 *
 * The active scope is kept in memory and mirrored to localStorage so a
 * cold start hydrates under the LAST account's scope synchronously,
 * before the session resolves; `activateAccountScope()` (called by the
 * app shell once the session user is known) corrects it if a different
 * account signed in, and the shell then resets + rehydrates the stores.
 *
 * Legacy data: builds before this change wrote unscoped keys with no
 * owner stamp. On the first activation of a real account, those keys are
 * claimed into that account's scope and the unscoped copies are removed,
 * so the device owner's existing entries stay with their account instead
 * of being stranded — and are never left lying around for a different
 * account to inherit later. The claim runs exactly once per device.
 */

const SCOPE_STORAGE_KEY = "pp:account-scope-v1";
const LEGACY_CLAIM_MARKER = "pp:account-scope-legacy-claimed-v1";

/** Base keys written by pre-scoping builds (no owner stamp). */
const LEGACY_KEYS = [
  "kiddo-ledger-v2",
  "pillarpath-social-v1",
  "pillarpath-teacher-v1",
  "pillar-plaza-3d",
  "pillar-plaza-3d-rewards",
  "pillarpath-emotion-codex",
];

export const SIGNED_OUT_SCOPE = "signed-out";

let memoryScope: string | null = null;

function browserStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    /* storage blocked — treat as unavailable */
  }
  return null;
}

function readStoredScope(): string | null {
  const ls = browserStorage();
  if (!ls) return null;
  try {
    return ls.getItem(SCOPE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The scope every on-device read/write currently lands in. */
export function getAccountScope(): string {
  if (memoryScope !== null) return memoryScope;
  memoryScope = readStoredScope() ?? SIGNED_OUT_SCOPE;
  return memoryScope;
}

/** The storage key `base` resolves to under the active account scope. */
export function scopedStorageKey(base: string): string {
  return `${base}@${getAccountScope()}`;
}

function claimLegacyKeys(scope: string): void {
  const ls = browserStorage();
  if (!ls) return;
  try {
    if (ls.getItem(LEGACY_CLAIM_MARKER)) return;
    for (const base of LEGACY_KEYS) {
      const legacy = ls.getItem(base);
      if (legacy !== null) {
        const target = `${base}@${scope}`;
        if (ls.getItem(target) === null) ls.setItem(target, legacy);
        ls.removeItem(base);
      }
    }
    ls.setItem(LEGACY_CLAIM_MARKER, scope);
  } catch {
    /* a failed claim must never break sign-in; keys stay unscoped and
       unread (scoped reads simply miss) rather than leaking */
  }
}

/**
 * Point every on-device store at `userId`'s scope. Returns "changed" when
 * the scope actually moved — the caller must then reset the stores to
 * their fresh state and rehydrate, so nothing from the previous scope
 * survives in memory. Returns "unchanged" when the scope already matched
 * (the normal return-visit case; a plain rehydrate is enough).
 */
export function activateAccountScope(
  userId: string | null,
  role: string | null,
): "changed" | "unchanged" {
  const next =
    userId && role ? `${role}:${userId}` : SIGNED_OUT_SCOPE;
  if (next !== SIGNED_OUT_SCOPE) claimLegacyKeys(next);
  const prev = getAccountScope();
  if (next === prev) return "unchanged";
  memoryScope = next;
  const ls = browserStorage();
  if (ls) {
    try {
      ls.setItem(SCOPE_STORAGE_KEY, next);
    } catch {
      /* in-memory scope still applies for this session */
    }
  }
  return "changed";
}

/** Forget the active scope (sign-out). Stored per-account data is kept —
 *  it belongs to those accounts — but nothing remains pointed at the
 *  account that just left. */
export function clearAccountScope(): void {
  memoryScope = SIGNED_OUT_SCOPE;
  const ls = browserStorage();
  if (ls) {
    try {
      ls.removeItem(SCOPE_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

/**
 * A zustand `StateStorage` that routes every key through the active
 * account scope. The scope is resolved per call, so a scope change takes
 * effect immediately — no store needs to be recreated. Safe during SSR
 * (reads miss, writes no-op), matching the stores' previous behavior.
 */
export function createAccountScopedStorage(): {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
} {
  return {
    getItem: (name) => {
      const ls = browserStorage();
      if (!ls) return null;
      try {
        return ls.getItem(scopedStorageKey(name));
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      const ls = browserStorage();
      if (!ls) return;
      try {
        ls.setItem(scopedStorageKey(name), value);
      } catch {
        /* storage full/blocked — the in-memory store still works */
      }
    },
    removeItem: (name) => {
      const ls = browserStorage();
      if (!ls) return;
      try {
        ls.removeItem(scopedStorageKey(name));
      } catch {
        /* ignore */
      }
    },
  };
}
