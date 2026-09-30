/**
 * Direct social sign-in providers for PillarPath's OWN Better Auth instance.
 *
 * Server-only (imports node:crypto for the Apple JWT). Each provider is
 * enabled purely by the presence of its env credentials — nothing is
 * configured (and no button is shown) until King adds that provider's keys.
 *
 * Built-in Better Auth providers: google, apple, facebook, tiktok, twitter.
 * Custom via genericOAuth: instagram (Meta's Instagram Login runs on
 * Facebook's OAuth endpoints), snapchat (Snap Kit Login Kit).
 *
 * Redirect URIs to register with each provider (production):
 *   built-ins : https://pillarpath.vercel.app/api/auth/callback/<id>
 *   custom    : https://pillarpath.vercel.app/api/auth/oauth2/callback/<id>
 */
import { createSign } from "node:crypto";
import { genericOAuth } from "better-auth/plugins";

export type DirectProviderKind = "social" | "oauth2";

export type DirectProviderDef = {
  /** Better Auth provider id (also the callback path segment). */
  id: string;
  /** Human label for the sign-in button. */
  label: string;
  kind: DirectProviderKind;
  /** Env var holding the OAuth client id. */
  idKey: string;
  /** Env var holding the OAuth client secret (Apple: see below). */
  secretKey: string;
};

export const DIRECT_PROVIDER_DEFS: readonly DirectProviderDef[] = [
  { id: "google", label: "Google", kind: "social", idKey: "GOOGLE_CLIENT_ID", secretKey: "GOOGLE_CLIENT_SECRET" },
  { id: "apple", label: "Apple", kind: "social", idKey: "APPLE_CLIENT_ID", secretKey: "APPLE_CLIENT_SECRET" },
  { id: "facebook", label: "Facebook", kind: "social", idKey: "FACEBOOK_CLIENT_ID", secretKey: "FACEBOOK_CLIENT_SECRET" },
  { id: "tiktok", label: "TikTok", kind: "social", idKey: "TIKTOK_CLIENT_ID", secretKey: "TIKTOK_CLIENT_SECRET" },
  { id: "twitter", label: "X", kind: "social", idKey: "X_CLIENT_ID", secretKey: "X_CLIENT_SECRET" },
  { id: "instagram", label: "Instagram", kind: "oauth2", idKey: "INSTAGRAM_CLIENT_ID", secretKey: "INSTAGRAM_CLIENT_SECRET" },
  { id: "snapchat", label: "Snapchat", kind: "oauth2", idKey: "SNAPCHAT_CLIENT_ID", secretKey: "SNAPCHAT_CLIENT_SECRET" },
];

/** Read an env var, treating empty/whitespace as unset. */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

// ── Apple client secret ─────────────────────────────────────────────────────
// Sign in with Apple needs a client secret JWT (ES256, 6-month max validity).
// Rather than making King mint and rotate it by hand, we mint it at startup
// from the long-lived pieces: Team ID + Key ID + .p8 private key. A literal
// APPLE_CLIENT_SECRET (a pre-minted JWT) is also accepted and wins when set.
let cachedAppleSecret: { value: string; exp: number } | null = null;

export function getAppleClientSecret(clientId: string): string | undefined {
  const literal = env("APPLE_CLIENT_SECRET");
  if (literal) return literal;
  const teamId = env("APPLE_TEAM_ID");
  const keyId = env("APPLE_KEY_ID");
  const privateKey = env("APPLE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  if (!teamId || !keyId || !privateKey) return undefined;

  const now = Math.floor(Date.now() / 1000);
  if (cachedAppleSecret && cachedAppleSecret.exp - now > 86_400) {
    return cachedAppleSecret.value;
  }
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url");
  const exp = now + 15_777_000; // 6 months (Apple's max)
  const payload = Buffer.from(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp,
      aud: "https://appleid.apple.com",
      sub: clientId,
    }),
  ).toString("base64url");
  const signer = createSign("sha256");
  signer.update(`${header}.${payload}`);
  const signature = signer.sign({ key: privateKey, format: "pem" }).toString("base64url");
  const jwt = `${header}.${payload}.${signature}`;
  cachedAppleSecret = { value: jwt, exp };
  return jwt;
}

/** True when this provider has everything it needs to run. */
export function isDirectProviderEnabled(def: DirectProviderDef): boolean {
  const clientId = env(def.idKey);
  if (!clientId) return false;
  if (def.id === "apple") return Boolean(getAppleClientSecret(clientId));
  return Boolean(env(def.secretKey));
}

/** Provider list safe to send to the browser (no secrets). */
export function getEnabledDirectProviders(): { id: string; label: string; kind: DirectProviderKind }[] {
  return DIRECT_PROVIDER_DEFS.filter(isDirectProviderEnabled).map(({ id, label, kind }) => ({
    id,
    label,
    kind,
  }));
}

/** Better Auth `socialProviders` config — only enabled built-ins. */
export function buildDirectSocialProviders(): Record<string, { clientId: string; clientSecret: string }> {
  const out: Record<string, { clientId: string; clientSecret: string }> = {};
  for (const def of DIRECT_PROVIDER_DEFS) {
    if (def.kind !== "social" || !isDirectProviderEnabled(def)) continue;
    const clientId = env(def.idKey) as string;
    const clientSecret =
      def.id === "apple" ? (getAppleClientSecret(clientId) as string) : (env(def.secretKey) as string);
    out[def.id] = { clientId, clientSecret };
  }
  return out;
}

// ── Custom OAuth providers (no Better Auth built-in) ───────────────────────

type CustomOAuthDef = {
  providerId: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
};

const CUSTOM_OAUTH: readonly CustomOAuthDef[] = [
  {
    // Instagram Login (Meta): new apps must use Facebook's OAuth endpoints
    // with Instagram scopes. Requires the Instagram product on King's Meta app.
    providerId: "instagram",
    authorizationUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    userInfoUrl: "https://graph.facebook.com/me?fields=id,name,email",
    scopes: ["instagram_business_basic"],
  },
  {
    // Snap Kit Login Kit. Requires an approved Snap Kit app.
    providerId: "snapchat",
    authorizationUrl: "https://accounts.snapchat.com/login/oauth2/authorize",
    tokenUrl: "https://accounts.snapchat.com/login/oauth2/access_token",
    userInfoUrl: "https://kit.snapchat.com/v1/me",
    scopes: [],
  },
];

/** genericOAuth plugin instance for the enabled custom providers (or null). */
export function buildCustomOAuthPlugin() {
  const configs = CUSTOM_OAUTH.filter((c) => {
    const def = DIRECT_PROVIDER_DEFS.find((d) => d.id === c.providerId);
    return def && isDirectProviderEnabled(def);
  }).map((c) => {
    const def = DIRECT_PROVIDER_DEFS.find((d) => d.id === c.providerId) as DirectProviderDef;
    return {
      providerId: c.providerId,
      clientId: env(def.idKey) as string,
      clientSecret: env(def.secretKey) as string,
      authorizationUrl: c.authorizationUrl,
      tokenUrl: c.tokenUrl,
      userInfoUrl: c.userInfoUrl,
      scopes: c.scopes,
    };
  });
  return configs.length > 0 ? genericOAuth({ config: configs }) : null;
}

/** All direct provider ids (built-in + custom) for account-linking trust. */
export function directProviderIds(): string[] {
  return DIRECT_PROVIDER_DEFS.filter(isDirectProviderEnabled).map((d) => d.id);
}
