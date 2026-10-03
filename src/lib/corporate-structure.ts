/**
 * PillarPath corporate structure — the single source of truth for the
 * company's departments, roles, responsibilities, and permission matrix.
 *
 * The Tower (corporate HQ UI), the org chart, and the server-side RBAC all
 * read from here. The database tables (migration 0009) are seeded from this
 * file by `seedCorporateStructure()` in corporate-server.ts.
 *
 * Authority levels run 1–10. Level 10 is the Chief Executive Officer.
 * Only level 10 may grant or revoke corporate roles.
 */

export interface CorporateDepartment {
  slug: string;
  name: string;
  tagline: string;
  icon: string;
  sortOrder: number;
  /** What this department owns, in plain language. */
  mandate: string;
  /** The Tower room name. */
  room: string;
}

export interface CorporateRole {
  slug: string;
  title: string;
  department: string;
  level: number;
  summary: string;
  responsibilities: string[];
  /** Permission grants: "resource:action", "resource:*", or "*" (all). */
  permissions: string[];
}

/** Permission resources and what they gate. */
export const PERMISSION_RESOURCES: Record<string, string> = {
  overview: "Corporate HQ dashboard and company KPIs",
  team: "Team directory and membership",
  roles: "Granting and revoking corporate roles",
  users: "Customer account records",
  products: "Storefront product catalog",
  orders: "Customer orders and fulfillment",
  suppliers: "Supplier accounts and sourcing",
  finance: "Revenue, payouts, and accounting",
  units: "Pillar Units economy and treasury",
  content: "Studio content, lessons, and curriculum",
  teachers: "Teacher verifications and classrooms",
  support: "Customer support tickets",
  marketing: "Campaigns and brand assets",
  settings: "Platform configuration",
  deployments: "Builds, releases, and system health",
  screening: "Product safety screening queue",
  analytics: "Business analytics and reports",
  messages: "Tower secure messaging (team channels and DMs)",
  announcements: "Company-wide announcements (#announcements)",
};

export const PERMISSION_ACTIONS: Record<string, string> = {
  view: "See it",
  manage: "Create and edit (implies view)",
  approve: "Approve or reject pending items",
  publish: "Push content or products live",
  configure: "Change system-level configuration",
};

export const DEPARTMENTS: CorporateDepartment[] = [
  {
    slug: "executive",
    name: "Executive",
    tagline: "Sets the course",
    icon: "🏛️",
    sortOrder: 0,
    mandate: "Company vision, strategy, and final authority on every major decision.",
    room: "The Corner Office",
  },
  {
    slug: "finance",
    name: "Finance & Treasury",
    tagline: "Guards the vault",
    icon: "🏦",
    sortOrder: 1,
    mandate: "Revenue, accounting, payouts, and the Pillar Units treasury.",
    room: "The Vault Wing",
  },
  {
    slug: "engineering",
    name: "Engineering",
    tagline: "Builds the world",
    icon: "🛠️",
    sortOrder: 2,
    mandate: "The app, the platform, deployments, and system reliability.",
    room: "The Lab",
  },
  {
    slug: "product",
    name: "Product & Design",
    tagline: "Draws the map",
    icon: "🧭",
    sortOrder: 3,
    mandate: "Roadmap, product decisions, and the design system.",
    room: "The Drafting Room",
  },
  {
    slug: "sales",
    name: "Sales & Partnerships",
    tagline: "Stocks the shelves",
    icon: "🤝",
    sortOrder: 4,
    mandate: "Supplier relationships, sourcing, partnerships, and revenue deals.",
    room: "The Trading Floor",
  },
  {
    slug: "support",
    name: "Customer Success",
    tagline: "Answers the call",
    icon: "🎧",
    sortOrder: 5,
    mandate: "Family and teacher support — every ticket answered with care.",
    room: "The Help Desk",
  },
  {
    slug: "marketing",
    name: "Marketing & Growth",
    tagline: "Spreads the word",
    icon: "📣",
    sortOrder: 6,
    mandate: "Brand, campaigns, and growing the Society.",
    room: "The Studio",
  },
  {
    slug: "content",
    name: "Content & Curriculum",
    tagline: "Writes the story",
    icon: "📚",
    sortOrder: 7,
    mandate: "Learning content, curriculum, and the Creative Studio universe.",
    room: "The Library",
  },
  {
    slug: "trust",
    name: "Trust & Safety",
    tagline: "Keeps it safe",
    icon: "🛡️",
    sortOrder: 8,
    mandate: "Child safety, product screening, compliance, and teacher verification.",
    room: "The Watchtower",
  },
  {
    slug: "people",
    name: "People & HR",
    tagline: "Grows the team",
    icon: "🌱",
    sortOrder: 9,
    mandate: "Hiring, team health, and the humans behind PillarPath.",
    room: "The Commons",
  },
];

const V = "view";
const M = "manage";

export const ROLES: CorporateRole[] = [
  // ---------------------------------------------------------------- Executive
  {
    slug: "ceo",
    title: "Chief Executive Officer",
    department: "executive",
    level: 10,
    summary: "The founder's seat. Final authority on vision, strategy, and every major decision.",
    responsibilities: [
      "Set company vision, mission, and multi-year strategy",
      "Final approval on finance, partnerships, and platform direction",
      "Grant and revoke corporate roles across every department",
      "Represent PillarPath to partners, schools, and the public",
    ],
    permissions: ["*"],
  },
  {
    slug: "coo",
    title: "Chief Operating Officer",
    department: "executive",
    level: 9,
    summary: "Runs the day-to-day machine so the CEO can steer the ship.",
    responsibilities: [
      "Own daily operations across support, sales, and fulfillment",
      "Coordinate departments against company priorities",
      "Manage the team directory and departmental staffing",
      "Step in with executive authority when the CEO is unavailable",
    ],
    permissions: [
      "overview:view", "overview:manage",
      "team:view", "team:manage",
      "users:view", "support:manage",
      "analytics:view", "settings:view",
      "products:view", "orders:view",
    ],
  },
  {
    slug: "cto",
    title: "Chief Technology Officer",
    department: "executive",
    level: 9,
    summary: "Owns the technology — the app, the platform, and the systems it runs on.",
    responsibilities: [
      "Set technical strategy and architecture direction",
      "Own deployments, releases, and system reliability",
      "Lead the engineering organization",
      "Approve platform configuration changes",
    ],
    permissions: [
      "overview:view",
      "deployments:view", "deployments:manage", "deployments:configure",
      "settings:view",
      "team:view",
      "analytics:view",
    ],
  },
  {
    slug: "cfo",
    title: "Chief Financial Officer",
    department: "executive",
    level: 9,
    summary: "Owns the money — revenue, accounting, and the Units treasury.",
    responsibilities: [
      "Own financial planning, accounting, and reporting",
      "Approve payouts, refunds, and treasury movements",
      "Guard the Pillar Units economy's integrity",
      "Report company financial health to the CEO",
    ],
    permissions: [
      "overview:view",
      "finance:view", "finance:manage", "finance:approve",
      "units:view", "units:manage",
      "orders:view",
      "analytics:view", "analytics:manage",
      "team:view",
    ],
  },
  {
    slug: "cmo",
    title: "Chief Marketing Officer",
    department: "executive",
    level: 9,
    summary: "Owns the story the world hears about PillarPath.",
    responsibilities: [
      "Set brand and growth strategy",
      "Own campaigns from concept to launch",
      "Approve public-facing content and messaging",
      "Grow the Society: families, teachers, and partners",
    ],
    permissions: [
      "overview:view",
      "marketing:view", "marketing:manage", "marketing:publish",
      "content:view", "content:manage",
      "analytics:view",
      "team:view",
    ],
  },
  // ------------------------------------------------------------------ Finance
  {
    slug: "vp-finance",
    title: "VP of Finance",
    department: "finance",
    level: 8,
    summary: "Runs the finance engine under the CFO.",
    responsibilities: [
      "Manage budgets, forecasts, and financial reporting",
      "Oversee accounting operations",
      "Review Units treasury movements",
    ],
    permissions: ["overview:view", "finance:view", "finance:manage", "units:view", "analytics:view"],
  },
  {
    slug: "accountant",
    title: "Accountant",
    department: "finance",
    level: 6,
    summary: "Keeps the books clean and the numbers honest.",
    responsibilities: [
      "Maintain financial records and reconciliations",
      "Process supplier invoices and payouts",
      "Support audits and tax preparation",
    ],
    permissions: ["overview:view", "finance:view", "orders:view"],
  },
  {
    slug: "treasury-analyst",
    title: "Treasury Analyst — Units Economy",
    department: "finance",
    level: 6,
    summary: "Watches over the Pillar Units economy like a central banker.",
    responsibilities: [
      "Monitor Units issuance, circulation, and redemption",
      "Flag anomalies: fraud, exploits, or economy imbalance",
      "Model the health of the Units economy over time",
    ],
    permissions: ["overview:view", "units:view", "units:manage", "finance:view", "analytics:view"],
  },
  // -------------------------------------------------------------- Engineering
  {
    slug: "vp-engineering",
    title: "VP of Engineering",
    department: "engineering",
    level: 8,
    summary: "Leads the builders.",
    responsibilities: [
      "Lead engineering managers and set delivery pace",
      "Own release quality and system reliability",
      "Plan technical hiring with People & HR",
    ],
    permissions: ["overview:view", "deployments:view", "deployments:manage", "team:view", "settings:view"],
  },
  {
    slug: "engineering-manager",
    title: "Engineering Manager",
    department: "engineering",
    level: 7,
    summary: "Turns the roadmap into shipped software.",
    responsibilities: [
      "Run the engineering team's rituals and delivery",
      "Review and approve code going to production",
      "Mentor engineers and unblock their work",
    ],
    permissions: ["overview:view", "deployments:view", "deployments:manage", "team:view"],
  },
  {
    slug: "senior-engineer",
    title: "Senior Engineer",
    department: "engineering",
    level: 6,
    summary: "Builds the hard things and sets the technical bar.",
    responsibilities: [
      "Design and build core platform features",
      "Review code and uphold engineering standards",
      "Own critical systems end to end",
    ],
    permissions: ["overview:view", "deployments:view"],
  },
  {
    slug: "engineer",
    title: "Engineer",
    department: "engineering",
    level: 5,
    summary: "Ships features that families touch every day.",
    responsibilities: [
      "Build and maintain product features",
      "Fix bugs and improve performance",
      "Write tests and documentation",
    ],
    permissions: ["overview:view", "deployments:view"],
  },
  {
    slug: "qa-engineer",
    title: "QA Engineer",
    department: "engineering",
    level: 5,
    summary: "The last line of defense before families see it.",
    responsibilities: [
      "Test releases across web and mobile",
      "Hunt regressions and edge cases",
      "Maintain the test suite and QA checklists",
    ],
    permissions: ["overview:view", "deployments:view"],
  },
  {
    slug: "devops-engineer",
    title: "DevOps Engineer",
    department: "engineering",
    level: 6,
    summary: "Keeps the lights on and the deploys flowing.",
    responsibilities: [
      "Manage infrastructure, CI/CD, and environments",
      "Monitor uptime and respond to incidents",
      "Own backups, secrets, and access hygiene",
    ],
    permissions: ["overview:view", "deployments:view", "deployments:manage", "deployments:configure"],
  },
  // ------------------------------------------------------------------- Product
  {
    slug: "head-of-product",
    title: "Head of Product",
    department: "product",
    level: 8,
    summary: "Decides what gets built and why.",
    responsibilities: [
      "Own the product roadmap and prioritization",
      "Turn company strategy into shippable plans",
      "Align engineering, design, and content on what matters",
    ],
    permissions: ["overview:view", "content:view", "content:manage", "products:view", "analytics:view", "team:view"],
  },
  {
    slug: "product-manager",
    title: "Product Manager",
    department: "product",
    level: 7,
    summary: "Owns a slice of the product from idea to launch.",
    responsibilities: [
      "Write specs and define success for features",
      "Work daily with engineering and design",
      "Measure what shipped and iterate",
    ],
    permissions: ["overview:view", "content:view", "content:manage", "products:view"],
  },
  {
    slug: "product-designer",
    title: "Product Designer",
    department: "product",
    level: 6,
    summary: "Makes PillarPath feel like the future.",
    responsibilities: [
      "Design flows, screens, and interactions",
      "Evolve the cosmic design system",
      "Prototype and test with real families",
    ],
    permissions: ["overview:view", "content:view", "content:manage"],
  },
  // --------------------------------------------------------------------- Sales
  {
    slug: "vp-sales",
    title: "VP of Sales",
    department: "sales",
    level: 8,
    summary: "Turns relationships into revenue.",
    responsibilities: [
      "Own the sales number and the sales playbook",
      "Lead account executives and partnership managers",
      "Open enterprise and school-district deals",
    ],
    permissions: [
      "overview:view",
      "suppliers:view", "suppliers:manage",
      "products:view", "products:manage",
      "orders:view",
      "analytics:view",
      "team:view",
    ],
  },
  {
    slug: "sales-manager",
    title: "Sales Manager",
    department: "sales",
    level: 7,
    summary: "Coaches the closers.",
    responsibilities: [
      "Run the sales pipeline and forecasts",
      "Coach account executives on deals",
      "Report on what's working and what isn't",
    ],
    permissions: ["overview:view", "suppliers:view", "products:view", "orders:view", "team:view"],
  },
  {
    slug: "account-executive",
    title: "Account Executive",
    department: "sales",
    level: 6,
    summary: "Closes deals with schools, districts, and partners.",
    responsibilities: [
      "Run demos and negotiate agreements",
      "Own a book of partner accounts",
      "Hit quarterly revenue targets",
    ],
    permissions: ["overview:view", "suppliers:view", "orders:view"],
  },
  {
    slug: "partnerships-manager",
    title: "Partnerships Manager",
    department: "sales",
    level: 7,
    summary: "Builds the supplier and affiliate bench.",
    responsibilities: [
      "Source and onboard product suppliers",
      "Negotiate fulfillment and margin terms",
      "Manage ongoing supplier relationships",
    ],
    permissions: ["overview:view", "suppliers:view", "suppliers:manage"],
  },
  {
    slug: "sdr",
    title: "Sales Development Rep",
    department: "sales",
    level: 5,
    summary: "Opens the doors.",
    responsibilities: [
      "Prospect schools, districts, and partners",
      "Qualify leads for account executives",
      "Keep the CRM honest",
    ],
    permissions: ["overview:view", "suppliers:view"],
  },
  // ------------------------------------------------------------------- Support
  {
    slug: "head-of-customer-success",
    title: "Head of Customer Success",
    department: "support",
    level: 8,
    summary: "Owns every family's experience when something goes wrong.",
    responsibilities: [
      "Set support quality standards and response targets",
      "Lead support leads and specialists",
      "Turn support insights into product fixes",
    ],
    permissions: ["overview:view", "support:view", "support:manage", "users:view", "team:view", "team:manage"],
  },
  {
    slug: "support-lead",
    title: "Support Lead",
    department: "support",
    level: 7,
    summary: "Runs the floor and handles the hard cases.",
    responsibilities: [
      "Triage and route the ticket queue",
      "Handle escalations from specialists",
      "Coach the support team",
    ],
    permissions: ["overview:view", "support:view", "support:manage", "users:view", "team:view"],
  },
  {
    slug: "support-specialist-2",
    title: "Support Specialist II",
    department: "support",
    level: 6,
    summary: "Solves the tricky ones.",
    responsibilities: [
      "Resolve complex family and teacher issues",
      "Handle billing and Units questions",
      "Document solutions for the knowledge base",
    ],
    permissions: ["overview:view", "support:view", "support:manage", "users:view"],
  },
  {
    slug: "support-specialist-1",
    title: "Support Specialist I",
    department: "support",
    level: 5,
    summary: "The friendly first voice families hear.",
    responsibilities: [
      "Answer tickets, chats, and calls",
      "Guide families through the app",
      "Escalate what needs a specialist",
    ],
    permissions: ["overview:view", "support:view", "support:manage", "users:view"],
  },
  // ------------------------------------------------------------------ Marketing
  {
    slug: "marketing-manager",
    title: "Marketing Manager",
    department: "marketing",
    level: 7,
    summary: "Runs the campaigns that grow the Society.",
    responsibilities: [
      "Plan and execute marketing campaigns",
      "Own the content calendar",
      "Measure and report campaign performance",
    ],
    permissions: ["overview:view", "marketing:view", "marketing:manage", "analytics:view", "team:view"],
  },
  {
    slug: "growth-marketer",
    title: "Growth Marketer",
    department: "marketing",
    level: 6,
    summary: "Finds the levers that compound.",
    responsibilities: [
      "Run experiments across acquisition channels",
      "Optimize onboarding and activation funnels",
      "Own SEO and referral loops",
    ],
    permissions: ["overview:view", "marketing:view", "marketing:manage", "analytics:view"],
  },
  {
    slug: "brand-designer",
    title: "Brand Designer",
    department: "marketing",
    level: 6,
    summary: "Keeps PillarPath beautiful everywhere it appears.",
    responsibilities: [
      "Design brand assets, merch, and campaign creative",
      "Guard brand consistency across channels",
      "Support product design on marketing surfaces",
    ],
    permissions: ["overview:view", "marketing:view", "content:view"],
  },
  {
    slug: "social-media-manager",
    title: "Social Media Manager",
    department: "marketing",
    level: 5,
    summary: "The voice of PillarPath in the wild.",
    responsibilities: [
      "Run social channels day to day",
      "Create content families actually enjoy",
      "Manage community and respond publicly",
    ],
    permissions: ["overview:view", "marketing:view", "marketing:manage"],
  },
  // ------------------------------------------------------------------- Content
  {
    slug: "head-of-content",
    title: "Head of Content",
    department: "content",
    level: 8,
    summary: "Owns the learning universe.",
    responsibilities: [
      "Set content and curriculum strategy",
      "Own the Creative Studio's creative direction",
      "Publish what ships to families",
    ],
    permissions: ["overview:view", "content:view", "content:manage", "content:publish", "teachers:view", "team:view"],
  },
  {
    slug: "curriculum-designer",
    title: "Curriculum Designer",
    department: "content",
    level: 6,
    summary: "Turns money lessons into kid magic.",
    responsibilities: [
      "Design learning paths and missions",
      "Write lesson content with teachers",
      "Measure learning outcomes",
    ],
    permissions: ["overview:view", "content:view", "content:manage", "teachers:view"],
  },
  {
    slug: "content-producer",
    title: "Content Producer",
    department: "content",
    level: 5,
    summary: "Makes the things kids love.",
    responsibilities: [
      "Produce stories, videos, and studio content",
      "Maintain the content pipeline",
      "Coordinate with designers and educators",
    ],
    permissions: ["overview:view", "content:view", "content:manage"],
  },
  // --------------------------------------------------------------------- Trust
  {
    slug: "compliance-officer",
    title: "Compliance Officer",
    department: "trust",
    level: 8,
    summary: "Keeps PillarPath on the right side of every law.",
    responsibilities: [
      "Own COPPA, FERPA, and financial compliance",
      "Approve teacher verifications",
      "Set safety policy with the CEO",
    ],
    permissions: [
      "overview:view",
      "screening:view", "screening:approve",
      "content:view",
      "users:view",
      "teachers:view",
      "team:view",
    ],
  },
  {
    slug: "child-safety-specialist",
    title: "Child Safety Specialist",
    department: "trust",
    level: 7,
    summary: "The kids come first — always.",
    responsibilities: [
      "Review products and content for child safety",
      "Investigate safety reports",
      "Train every team on child-safety standards",
    ],
    permissions: ["overview:view", "screening:view", "screening:approve", "content:view"],
  },
  {
    slug: "safety-reviewer",
    title: "Safety Reviewer",
    department: "trust",
    level: 6,
    summary: "Every product passes through here before a family sees it.",
    responsibilities: [
      "Screen supplier products against the safety rubric",
      "Quarantine anything uncertain — no exceptions",
      "Verify certifications (CPSIA, CPC, ASTM) where required",
    ],
    permissions: ["overview:view", "screening:view", "screening:approve"],
  },
  // -------------------------------------------------------------------- People
  {
    slug: "head-of-people",
    title: "Head of People",
    department: "people",
    level: 8,
    summary: "Takes care of the people who take care of the mission.",
    responsibilities: [
      "Own hiring, onboarding, and team health",
      "Manage the team directory with department leads",
      "Build the culture as the company grows",
    ],
    permissions: ["overview:view", "team:view", "team:manage"],
  },
  {
    slug: "recruiter",
    title: "Recruiter",
    department: "people",
    level: 6,
    summary: "Finds the next Pillars.",
    responsibilities: [
      "Source and screen candidates",
      "Run interview loops with hiring managers",
      "Own the hiring pipeline",
    ],
    permissions: ["overview:view", "team:view"],
  },
];

export function getDepartment(slug: string): CorporateDepartment | undefined {
  return DEPARTMENTS.find((d) => d.slug === slug);
}

export function getRole(slug: string): CorporateRole | undefined {
  return ROLES.find((r) => r.slug === slug);
}

export function rolesForDepartment(deptSlug: string): CorporateRole[] {
  return ROLES.filter((r) => r.department === deptSlug).sort((a, b) => b.level - a.level);
}

/**
 * Check a grant list ("resource:action", "resource:*", "*") against a
 * required permission. "manage" implies "view".
 */
export function hasGrant(grants: string[], resource: string, action: string): boolean {
  if (grants.includes("*")) return true;
  if (grants.includes(`${resource}:*`)) return true;
  if (grants.includes(`${resource}:${action}`)) return true;
  if (action === "view" && grants.includes(`${resource}:manage`)) return true;
  return false;
}

/** Flatten a role's grants into the canonical "resource:action" list for display. */
export function expandGrants(role: CorporateRole): string[] {
  if (role.permissions.includes("*")) return ["* (all permissions)"];
  const out = new Set<string>();
  for (const g of role.permissions) {
    const [resource, action] = g.split(":");
    out.add(`${resource}:${action}`);
    if (action === "manage") out.add(`${resource}:view`);
  }
  return [...out].sort();
}
