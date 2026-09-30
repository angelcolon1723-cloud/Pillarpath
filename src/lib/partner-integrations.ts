export type PartnerKind = "marketing" | "dropshipping" | "commerce" | "creative";

export type PartnerIntegration = {
  id: string;
  name: string;
  kind: PartnerKind;
  description: string;
  envKey: string;
  status: "ready" | "configure";
};

/**
 * Connector catalog for PillarPath's family-commerce ecosystem.
 * These are integration targets, not claims that PillarPath currently has
 * a commercial affiliation with every provider listed here.
 */
export const PARTNER_INTEGRATIONS: PartnerIntegration[] = [
  { id: "stripe", name: "Stripe", kind: "commerce", description: "Parent checkout and paid Studio upgrades.", envKey: "STRIPE_SECRET_KEY", status: "ready" },
  { id: "shopify", name: "Shopify", kind: "commerce", description: "Optional catalog/order sync for a PillarPath-owned storefront.", envKey: "SHOPIFY_ACCESS_TOKEN", status: "configure" },
  { id: "printful", name: "Printful", kind: "dropshipping", description: "Print-on-demand apparel and creative merchandise.", envKey: "PRINTFUL_API_KEY", status: "configure" },
  { id: "printify", name: "Printify", kind: "dropshipping", description: "Print-on-demand products and custom designs.", envKey: "PRINTIFY_API_TOKEN", status: "configure" },
  { id: "cjdropshipping", name: "CJdropshipping", kind: "dropshipping", description: "Product sourcing and supplier fulfillment.", envKey: "CJ_API_KEY", status: "configure" },
  { id: "spocket", name: "Spocket", kind: "dropshipping", description: "Supplier discovery and curated fulfillment.", envKey: "SPOCKET_API_KEY", status: "configure" },
  { id: "impact", name: "impact.com", kind: "marketing", description: "Partner and affiliate program management.", envKey: "IMPACT_API_KEY", status: "configure" },
  { id: "awin", name: "Awin", kind: "marketing", description: "Affiliate network connectivity and publisher tracking.", envKey: "AWIN_API_TOKEN", status: "configure" },
  { id: "klaviyo", name: "Klaviyo", kind: "marketing", description: "Parent-approved lifecycle email and commerce messaging.", envKey: "KLAVIYO_API_KEY", status: "configure" },
  { id: "mailchimp", name: "Mailchimp", kind: "marketing", description: "Optional email audience and campaign sync.", envKey: "MAILCHIMP_API_KEY", status: "configure" },
  { id: "meta", name: "Meta", kind: "marketing", description: "Optional campaign measurement and audience tooling.", envKey: "META_ACCESS_TOKEN", status: "configure" },
  { id: "google-ads", name: "Google Ads", kind: "marketing", description: "Optional acquisition campaign measurement.", envKey: "GOOGLE_ADS_TOKEN", status: "configure" },
  { id: "tiktok", name: "TikTok for Business", kind: "marketing", description: "Optional campaign measurement and creative distribution.", envKey: "TIKTOK_ACCESS_TOKEN", status: "configure" },
];
