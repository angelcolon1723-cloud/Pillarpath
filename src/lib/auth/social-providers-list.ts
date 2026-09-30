import { createServerFn } from "@tanstack/react-start";
import type { DirectProviderKind } from "./direct-providers.server";

export type SocialProviderInfo = {
  id: string;
  label: string;
  /** "social" -> authClient.signIn.social; "oauth2" -> authClient.signIn.oauth2 */
  kind: DirectProviderKind;
};

/**
 * Which direct social providers are configured right now (env-driven).
 * The handler dynamically imports the server-only module so no secrets or
 * node:crypto ever enter the browser bundle.
 */
export const getEnabledSocialProviders = createServerFn({ method: "GET" }).handler(
  async (): Promise<SocialProviderInfo[]> => {
    const { getEnabledDirectProviders } = await import("./direct-providers.server");
    return getEnabledDirectProviders();
  },
);
