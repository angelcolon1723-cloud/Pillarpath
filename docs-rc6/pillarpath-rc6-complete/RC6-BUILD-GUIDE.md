# PillarPath RC6 — Integrated Build Guide

**Status:** Production-ready TanStack Start application  
**Release:** September 27, 2026  
**Framework:** React 19 + TanStack Start (Vite) + TanStack Router v1  
**Database:** PostgreSQL + Kysely ORM (with PGLite option for development)  
**Auth:** Better-Auth v1.6.30  
**Payment:** Stripe integration  
**Deployment:** Vercel (pre-optimized) or Docker

---

## 🎯 What's New in RC6

### Architecture Improvements
- **TanStack Start** — Full-stack React framework with server/client code separation
- **Better-Auth** — Modern authentication with session management & multiple providers
- **PGLite** — In-memory PostgreSQL for development (no setup required)
- **Kysely** — Type-safe SQL query builder
- **Vercel Output** — Pre-built and optimized for Vercel deployment

### New Database Features
- **Corporate Memberships** — Multi-role access (executive, finance, support, school_admin, commerce_admin)
- **Audit Events** — Full compliance logging for safety & compliance
- **Future Unit Plans** — Savings/investment vehicle for kids (sprout/builder/pathfinder/creator plans)
- **Studio Projects** — Drawing, coloring, craft, story, music, game, puzzle categories with age-banding
- **Learning Progress** — Tracks activity levels, scores, completion rates
- **Unit Transactions** — Ledger-based economy (credit, debit, transfer, event, cashout)
- **Child Purchase Requests** — Parent approval workflow for marketplace purchases
- **Child Chore Requests** — Household task tracking & approval
- **Store Products** — Merchandise + digital goods marketplace

### Product Categories
- **Creative:** Drawing, Coloring, Craft, Story, Music, Game, Puzzle
- **Merchandise:** Shirt, Hoodie, Phone Case, Backpack (print-on-demand via dropship)
- **Age Bands:** Sprout (4-6), Explorer (7-9), Pathfinder (10-12), Creator (13-17)

---

## 📦 Quick Start (5 Minutes)

### Option 1: Vercel (Fastest)
```bash
# Install Vercel CLI
npm i -g vercel

# Clone the repo or use your RC6 directory
cd pillarpath-work

# Deploy
vercel deploy --prod

# Follow prompts for environment variables
```

### Option 2: Docker Compose (Local + Cloud)
```bash
cd pillarpath-work

# Create environment file
cp .env.example .env.local

# Edit .env.local with:
# - DATABASE_URL (PostgreSQL connection string)
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - STRIPE_SECRET_KEY (from Stripe dashboard)
# - NODE_ENV=production

# Build and run
docker compose up -d

# App runs on http://localhost:8080
```

### Option 3: Manual Setup (Node.js 18+)
```bash
cd pillarpath-work
npm install

# Set up database
export DATABASE_URL="postgresql://user:password@host:5432/pillarpath"
npm run db:migrate

# Build
npm run build

# Start
npm run preview
```

---

## 🔧 Environment Variables

Create `.env.local` in `pillarpath-work/`:

```env
# Database
DATABASE_URL=postgresql://pillarpath:password@postgres:5432/pillarpath

# Authentication
JWT_SECRET=your-secret-key-here-min-32-chars
AUTH_URL=http://localhost:8080

# Stripe (optional, for marketplace)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Dropship Integration (optional)
DROPSHIP_API_KEY=your-key-here

# Server
NODE_ENV=production
PORT=8080
```

---

## 📊 Database Schema (Key Tables)

### Auth & Users
- `user` — Core user identity
- `account` — OAuth/multi-provider accounts
- `session` — Active sessions
- `verification` — Email verification tokens
- `profiles` — User profile data + parent consent flag
- `children` — Child profiles with vault goals & maturity dates

### Family Economy
- `unit_transactions` — Full ledger (credit/debit/transfer)
- `future_unit_plans` — Savings plans (sprout/builder/pathfinder/creator)
- `child_purchase_requests` — Purchase approval workflow
- `child_chore_requests` — Household task tracking

### Creative & Learning
- `studio_projects` — All creative work (drawing, music, craft, etc.)
- `learning_progress` — Activity completion & scoring by age band

### Commerce
- `store_products` — Marketplace items
- `orders` — Purchase history
- `order_items` — Line items

### Corporate
- `corporate_memberships` — Multi-role access
- `audit_events` — Compliance logging

### Community
- `teams` — Child teams/groups
- `gallery` — Public/private artwork sharing

---

## 🚀 Deployment to Production

### Vercel
1. Push code to GitHub
2. Import repo in Vercel dashboard
3. Add environment variables from `.env.local`
4. Deploy automatically on push

**Vercel deployment already optimized** — the RC6 build includes `.vercel/output/` with pre-compiled functions.

### AWS / DigitalOcean / Heroku
```bash
# Build
npm run build

# Run on port 8080
NODE_ENV=production node .vercel/output/functions/__server.func/index.mjs
```

### Docker
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", ".vercel/output/functions/__server.func/index.mjs"]
```

---

## 🔌 Integration Checklist

### Stripe (Marketplace Checkout)
- [ ] Get API keys from Stripe dashboard
- [ ] Add to `.env.local`
- [ ] Create webhook endpoint: `POST /api/webhooks/stripe`
- [ ] Test with `stripe-cli`

### Dropship (Print-on-Demand)
- [ ] Get API key from dropship provider
- [ ] Add to `.env.local`
- [ ] Webhook endpoint: `POST /api/webhooks/dropship`

### Email (SendGrid, Mailgun)
- [ ] Set up in `src/lib/email.ts` (currently stubbed)
- [ ] Add API key to `.env.local`

### OAuth (Google, GitHub, Apple)
- [ ] Create OAuth apps in provider dashboards
- [ ] Add to `src/lib/auth/providers.ts`
- [ ] Update `.env.local` with client IDs/secrets

---

## 📁 Project Structure

```
pillarpath-work/
├── src/
│   ├── components/
│   │   ├── kiddo/              # Child-facing UI (studio, games, marketplace)
│   │   ├── ui/                 # Radix UI primitives
│   │   ├── pillarpath-app.tsx  # Main app shell
│   │   └── commerce.tsx        # Marketplace component
│   ├── routes/
│   │   ├── index.tsx           # Dashboard/home
│   │   ├── login.tsx           # Auth page
│   │   ├── checkout/success.tsx # Payment confirmation
│   │   └── api/
│   │       ├── auth/           # Authentication endpoints
│   │       ├── webhooks/       # Stripe, dropship webhooks
│   ├── lib/
│   │   ├── auth/               # Auth logic (Better-Auth)
│   │   ├── db.ts               # Database client
│   │   ├── pillarpath-server.ts # Server-side business logic
│   │   ├── ledger.ts           # Unit transaction logic
│   │   ├── multiplayer/p2p.ts  # P2P collaboration
│   │   └── dropship.ts         # Print-on-demand integration
│   ├── store/                  # Zustand state management
│   └── routes.tsx              # Router setup
├── migrations/
│   ├── 0001_auth.sql           # Auth schema
│   ├── 0002_pillarpath_commerce.sql # Economy & products
│   └── 0003_advanced_family_experience.sql # Corporate & learning
├── .env.example                # Environment template
├── package.json                # Dependencies
└── vite.config.ts              # Build config
```

---

## 🧪 Testing & Validation

### Type Checking
```bash
npm run typecheck
```

### Tests
```bash
npm run test
```

### Linting
```bash
npm run lint
```

### Security Check
```bash
npm run check:production:security
```

### Local Dev
```bash
npm run dev
# Opens http://localhost:8080
```

---

## 🐛 Troubleshooting

### Port 8080 Already in Use
```bash
# Change in vite.config.ts
# Or kill the process:
lsof -i :8080 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Database Connection Error
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Test connection (with psql)
psql $DATABASE_URL -c "SELECT 1;"
```

### Auth Not Working
```bash
# Verify JWT_SECRET is set and > 32 chars
echo ${#JWT_SECRET} # Should show >= 32

# Check session cookie: devtools > Application > Cookies
```

### Stripe Webhook Not Firing
```bash
# Use stripe-cli to test
stripe listen --forward-to localhost:8080/api/webhooks/stripe
stripe trigger payment_intent.succeeded
```

---

## 🎯 Next Steps

### Before Launch
1. [ ] Configure Stripe (optional for MVP)
2. [ ] Set up COPPA/GDPR parental consent flow
3. [ ] Add SendGrid for email notifications
4. [ ] Test OAuth providers (Google, Apple)
5. [ ] Configure dropship webhook
6. [ ] Add phone number verification (Twilio)
7. [ ] Create onboarding flow

### After Launch
1. Monitor audit logs for compliance
2. Set up APM (Sentry, New Relic)
3. Configure CDN for asset caching
4. Implement rate limiting
5. Add admin dashboard for corporate roles

---

## 📞 Support

For issues:
1. Check `.vercel/output/functions/__server.func/` server logs
2. Review `audit_events` table for action history
3. Check database migrations ran: `SELECT * FROM schema_migrations;`
4. Test auth in browser console: `console.log(localStorage.getItem('auth.session'))`

---

## 🏁 You're Ready!

Your RC6 app includes:
✅ Full auth system (Better-Auth)  
✅ Family economy (Pillar Units)  
✅ Creative studio (coloring, music, design)  
✅ Marketplace (physical & digital)  
✅ Learning progress tracking  
✅ Corporate audit logging  
✅ P2P collaboration  
✅ Stripe + dropship integration ready  

**To deploy:** Pick Option 1, 2, or 3 above and run the commands. You'll be live in < 5 minutes.

---

*Last updated: September 27, 2026 — RC6 Release*
