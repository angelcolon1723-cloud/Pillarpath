import { getSql } from "@/lib/db";
import {
  CjDropshippingClient,
  createCjClientFromEnv,
  type TokenState,
} from "@/lib/suppliers/cjdropshipping";

/**
 * Database-backed CJ token store.
 *
 * CJ rate-limits getAccessToken to 1 QPS and server-side-caches the token
 * for 24h anyway — so fetching a fresh token per serverless invocation is
 * pure waste and trips the limiter when the user taps quickly. This store
 * persists one token row; the client reuses it until near expiry.
 */

interface TokenRow {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

export async function loadCjToken(): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null> {
  const sql = await getSql();
  const rows = await sql<TokenRow>`
    select access_token, refresh_token, expires_at::text as expires_at
    from cj_token_cache where id = 1`;
  if (!rows.length) return null;
  const expiresAt = new Date(rows[0].expires_at).getTime();
  if (Number.isFinite(expiresAt) && Date.now() > expiresAt - 24 * 3600 * 1000) {
    return null; // expired or expiring within a day — fetch fresh
  }
  return {
    accessToken: rows[0].access_token,
    refreshToken: rows[0].refresh_token,
    expiresAt,
  };
}

export async function saveCjToken(token: {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}): Promise<void> {
  const sql = await getSql();
  await sql`
    insert into cj_token_cache (id, access_token, refresh_token, expires_at)
    values (1, ${token.accessToken}, ${token.refreshToken}, to_timestamp(${token.expiresAt / 1000}))
    on conflict (id) do update set
      access_token = excluded.access_token,
      refresh_token = excluded.refresh_token,
      expires_at = excluded.expires_at,
      updated_at = now()`;
}

export async function clearCjToken(): Promise<void> {
  const sql = await getSql();
  await sql`delete from cj_token_cache where id = 1`;
}

/**
 * Prime a client's in-memory token from the DB cache. Call right after
 * constructing the client and before any API call — the client's fetchToken
 * will reuse it instead of hitting getAccessToken.
 */
export async function primeCjClientFromCache(
  client: CjDropshippingClient,
): Promise<void> {
  const cached = await loadCjToken().catch(() => null);
  if (cached) client.setToken(cached);
  // Wrap the client's token refresh so fresh tokens persist to the DB.
  const orig = client.setToken.bind(client);
  client.setToken = (t) => {
    orig(t);
    void saveCjToken(t).catch(() => {});
  };
  // If CJ rejects the token, drop the DB row so the next invocation fetches
  // fresh instead of retrying a known-bad token.
  client.onAuthFailure = async () => {
    await clearCjToken().catch(() => {});
  };
}

/**
 * Build a CJ client primed from the DB token cache. Returns null when no
 * CJ_API_KEY is configured. Fresh tokens fetched by the client are written
 * back to the cache automatically.
 */
export async function createCachedCjClient(): Promise<CjDropshippingClient | null> {
  const client = createCjClientFromEnv();
  if (!client) return null;
  await primeCjClientFromCache(client);
  return client;
}
