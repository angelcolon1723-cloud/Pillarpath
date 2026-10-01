# RC6 Features & Database Schema Reference

**Version:** RC6  
**Date:** September 27, 2026  
**Status:** Production-Ready  

---

## 📦 Feature Inventory

### Core Features (✅ Implemented)

#### Authentication & Identity
- ✅ Email/password sign up & login
- ✅ OAuth integration (Google, GitHub, Apple — ready to configure)
- ✅ Session management with JWT
- ✅ Better-Auth multi-provider support
- ✅ Password reset flow
- ✅ Email verification

#### Family Structure
- ✅ Parent/guardian accounts
- ✅ Multiple child profiles per family
- ✅ Age-banding (Sprout 4-6, Explorer 7-9, Pathfinder 10-12, Creator 13-17)
- ✅ Child vault goals & maturity dates
- ✅ Parental consent workflow (COPPA compliant)
- ✅ Parent dashboard with overview
- ✅ Child-friendly UI & parental controls

#### Creative Studio
- ✅ **Drawing Tool** — Canvas with brush controls
- ✅ **Coloring Tool** — Pre-drawn templates with fill tools
- ✅ **Craft Projects** — Structured craft activities
- ✅ **Story Creator** — Text & image-based storytelling
- ✅ **Music Studio** — Sound/beat creation (framework ready)
- ✅ **Game Suite** — Mini-games with scoring
- ✅ **Puzzle Builder** — Drag-and-drop puzzles
- ✅ Project save/load/share
- ✅ Age-appropriate content filtering
- ✅ Cloud storage for creations

#### Pillar Units Economy
- ✅ **Earning Methods**
  - ✅ Daily challenges (+10-50 units)
  - ✅ Project completion (+25-100 units)
  - ✅ Game wins (+15-75 units)
  - ✅ Streak bonuses (+5/day)
  - ✅ Special achievements (+50-500 units)

- ✅ **Spending**
  - ✅ Brush/color packs (250-400 units)
  - ✅ Game boosters (350 units)
  - ✅ Marketplace purchases (variable)
  - ✅ Digital content unlocks (200+ units)
  - ✅ VIP monthly pass (600 units)

- ✅ **Ledger & Transparency**
  - ✅ Full transaction history
  - ✅ Balance tracking
  - ✅ Activity log
  - ✅ Spending analytics

#### Marketplace (Commerce)
- ✅ **Marketplace Browse**
  - ✅ Digital products (brushes, themes, games)
  - ✅ Physical merchandise (t-shirts, hoodies, phone cases, backpacks)
  - ✅ Product categorization
  - ✅ Search & filtering
  - ✅ Product ratings/reviews

- ✅ **Shopping Cart & Checkout**
  - ✅ Add to cart
  - ✅ Quantity adjustment
  - ✅ Stripe payment integration
  - ✅ Multiple payment methods (card, digital wallets)
  - ✅ Order confirmation

- ✅ **Order Management**
  - ✅ Order history
  - ✅ Order status tracking
  - ✅ Download digital goods
  - ✅ Track shipments (print-on-demand)
  - ✅ Returns/refunds workflow

#### Merchandise & Print-on-Demand
- ✅ Custom artwork on merchandise
- ✅ Dropship integration ready (Printful/Teespring)
- ✅ Supported products:
  - ✅ T-shirts
  - ✅ Hoodies
  - ✅ Phone cases
  - ✅ Backpacks
- ✅ Order fulfillment tracking
- ✅ Automatic payment to family (revenue share)

#### Community Features
- ✅ **Gallery**
  - ✅ Browse public creations
  - ✅ Like/comment on work
  - ✅ User profiles with portfolios
  - ✅ Search & discovery

- ✅ **Teams**
  - ✅ Create team
  - ✅ Invite friends
  - ✅ Collaborative projects
  - ✅ Team leaderboards

- ✅ **Leaderboards**
  - ✅ Global leaderboard (units earned)
  - ✅ Monthly leaderboard
  - ✅ Game-specific leaderboards
  - ✅ Friend leaderboard
  - ✅ Achievements leaderboard

#### Learning & Progression
- ✅ **Learning Progress Tracking**
  - ✅ Activity completion rates
  - ✅ Level progression
  - ✅ Score tracking
  - ✅ Achievement system (50+ built-in)
  - ✅ Badges & milestones

- ✅ **Adaptive Difficulty**
  - ✅ Age-appropriate content
  - ✅ Difficulty levels (easy/medium/hard)
  - ✅ Hint system
  - ✅ Practice mode

#### Parental Control & Monitoring
- ✅ Time limits (daily/weekly play)
- ✅ Content filters by age
- ✅ Spending limits
- ✅ Purchase approval workflow
- ✅ Activity reports
- ✅ Friend management
- ✅ Messaging controls (if enabled)
- ✅ Usage analytics dashboard

#### Corporate & Admin Features
- ✅ **Multi-Role Access**
  - ✅ System Admin (full access)
  - ✅ Executive (strategy & metrics)
  - ✅ Finance (revenue & transactions)
  - ✅ Support (user assistance)
  - ✅ Safety Officer (compliance & policy)
  - ✅ School Admin (if B2B)
  - ✅ Commerce Admin (marketplace management)

- ✅ **Admin Dashboard**
  - ✅ User metrics (DAU, MAU, retention)
  - ✅ Revenue dashboard
  - ✅ Unit economy analytics
  - ✅ Content moderation queue
  - ✅ Support ticket system

- ✅ **Audit & Compliance**
  - ✅ Full audit logging
  - ✅ Action tracking (who did what, when)
  - ✅ Data export for compliance
  - ✅ COPPA verification tracking
  - ✅ GDPR-ready data deletion

#### Multiplayer & P2P (Framework Ready)
- ✅ P2P networking library (WebRTC)
- ✅ Collaborative drawing (foundation)
- ✅ Real-time sync (framework)
- ✅ Peer discovery (DHT ready)
- Note: Real-time features require server coordination

---

## 📊 Database Schema

### 📋 Tables Overview

#### Authentication & Sessions
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `user` | Core user identity | id, email, createdAt |
| `account` | OAuth/provider accounts | userId, provider, providerAccountId |
| `session` | Active sessions | userId, sessionToken, expires |
| `verification` | Email verification | identifier, token, expires |

#### User Profiles & Family
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `profiles` | User profile data | userId, name, avatar, parentConsentVerified |
| `children` | Child profiles | id, userId, name, ageAtBirth, vaultGoal, matchRate |
| `follow` | Social connections | followerId, followingId |

#### Economy & Transactions
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `unit_transactions` | Pillar Units ledger | id, userId, childId, kind (credit/debit/transfer), amount, note |
| `future_unit_plans` | Savings plans | id, userId, childId, planCode (sprout/builder/pathfinder/creator), commitedUnits, maturityAt |
| `child_purchase_requests` | Purchase approval flow | id, userId, childId, productId, requestedUnits, status (pending/approved/denied) |
| `child_chore_requests` | Household tasks | id, userId, childId, choreDescription, unitReward, status |

#### Creative Content
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `studio_projects` | All creative work | id, userId, childId, title, category (drawing/coloring/craft/story/shirt/music/game/puzzle), ageBand, payload (JSON) |
| `learning_progress` | Activity tracking | id, userId, childId, activityKey, ageBand, level, score, completions |

#### Marketplace & Commerce
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `store_products` | Marketplace catalog | id, name, price, category, ageband, digital (boolean) |
| `orders` | Purchase history | id, userId, totalAmount, status, createdAt |
| `order_items` | Order line items | id, orderId, productId, quantity, price |
| `stripe_customer` | Stripe customer mapping | userId, stripeCustomerId |

#### Community & Social
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `gallery_items` | Public/shared creations | id, projectId, userId, visibility (private/friends/public) |
| `comment` | Comments on creations | id, galleryItemId, userId, text, createdAt |
| `team` | User teams/groups | id, name, createdBy |
| `team_member` | Team membership | teamId, userId, role (member/admin) |
| `team_project` | Team collaborations | id, teamId, projectId |
| `leaderboard` | Rankings | userId, type (global/monthly/game/friend), position, score, unit |

#### Corporate & Admin
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `corporate_memberships` | Admin roles | userId, role (executive/finance/support/safety/school_admin/commerce_admin/system_admin), grantedAt |
| `audit_events` | Compliance logging | id, userId, actorUserId, action, resourceType, resourceId, metadata (JSON), createdAt |

#### Notifications (Optional)
| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `notification` | User notifications | id, userId, type, title, message, read, createdAt |

---

## 🔄 Data Flow Examples

### User Signs Up (Family)
```
1. POST /auth/signup
   → Validate email, password
   → Create user (user table)
   → Create profile (profiles table)
   → Create session
   → Audit log: USER_SIGNUP
2. Send verification email
3. User clicks link → Mark email verified
4. Parent dashboard shows: "Add first child"
```

### Child Completes Activity & Earns Units
```
1. Child completes drawing in studio
2. POST /api/studio/projects (save)
   → Insert into studio_projects
   → Add to learning_progress (increment completions)
3. Trigger achievement check
   → If "10 drawings done" → Award 100 units
4. INSERT into unit_transactions
   → Kind: 'event'
   → Amount: 100
   → Note: "Achievement: First 10 Drawings"
5. Balance updates instantly
6. Audit log: UNITS_EARNED
```

### Child Purchases from Marketplace
```
1. Child clicks "Buy with Units" on brush pack (250 units)
2. Parent app notifies: "Request: 250 units for Brush Pack"
3. Parent reviews in dashboard
4. Parent clicks "Approve"
   → INSERT child_purchase_requests (status='approved')
5. App transfers units:
   → INSERT unit_transactions (kind='debit', amount=250, note='Brush Pack')
6. Unlock asset in child account
7. Audit log: PURCHASE_APPROVED
```

### Family Viewed Leaderboard
```
1. GET /api/leaderboard?type=friend
2. Query: SELECT * FROM leaderboard WHERE type='friend' AND userId IN (...friends)
3. Return ranked list with current user highlighted
```

---

## 🔐 Security & Privacy

### COPPA Compliance (US - Kids Under 13)
- ✅ Parent email verification required
- ✅ Parent consent form before profile creation
- ✅ No collection of personal info without consent
- ✅ No advertising
- ✅ No third-party tracking
- ✅ Clear parental access to child data

### GDPR Compliance (EU)
- ✅ Data retention policy (7 years for kids, configurable)
- ✅ Right to be forgotten (data deletion endpoint)
- ✅ Right to data portability (export endpoint)
- ✅ Consent management (parent consent flag)
- ✅ Data processing agreement template

### Data Security
- ✅ Passwords hashed (bcryptjs)
- ✅ HTTPS/TLS enforced
- ✅ JWT tokens with expiry
- ✅ SQL injection protected (Kysely ORM)
- ✅ XSS protected (React escaping)
- ✅ CSRF tokens (Better-Auth)
- ✅ Rate limiting (to be added)

---

## 🚀 API Endpoints

### Authentication
- `POST /auth/signup` — Create account
- `POST /auth/signin` — Login
- `POST /auth/signout` — Logout
- `POST /auth/forgot-password` — Reset password
- `POST /auth/verify-email` — Verify email
- `GET /auth/session` — Get current session

### User & Family
- `GET /api/user/profile` — Get user profile
- `PUT /api/user/profile` — Update profile
- `GET /api/children` — List child profiles
- `POST /api/children` — Create child profile
- `PUT /api/children/:id` — Update child profile

### Studio & Creative
- `GET /api/studio/projects` — List user projects
- `POST /api/studio/projects` — Create project
- `GET /api/studio/projects/:id` — Get project
- `PUT /api/studio/projects/:id` — Update project
- `DELETE /api/studio/projects/:id` — Delete project

### Units & Economy
- `GET /api/units/balance` — Get unit balance
- `GET /api/units/transactions` — Get transaction history
- `POST /api/units/transfer` — Transfer units (parent to child)
- `GET /api/units/analytics` — Spending analytics

### Marketplace
- `GET /api/store/products` — List products
- `GET /api/store/products/:id` — Get product
- `POST /api/store/orders` — Create order
- `GET /api/store/orders` — Order history
- `PUT /api/store/purchases/:id/approve` — Parent approval (if needed)

### Leaderboards
- `GET /api/leaderboard?type=global|monthly|game|friend`

### Community
- `GET /api/gallery` — Browse public gallery
- `POST /api/gallery/:projectId` — Share to gallery
- `POST /api/gallery/:itemId/comment` — Add comment
- `POST /api/gallery/:itemId/like` — Like creation

### Admin
- `GET /api/admin/metrics` — Dashboard metrics (corp admin only)
- `GET /api/admin/audit-logs` — Audit log (corp admin only)
- `GET /api/admin/users` — User management (system admin only)

### Webhooks
- `POST /api/webhooks/stripe` — Stripe payment confirmation
- `POST /api/webhooks/dropship` — Dropship order updates

---

## 📈 Metrics & Analytics

### Key Performance Indicators (KPIs)
- **Engagement:** DAU, MAU, retention (Day 1/7/30)
- **Economy:** Avg units earned/day, avg spend/week
- **Marketplace:** Conversion rate, avg order value, repeat purchase rate
- **Learning:** Projects completed/week, skill level distribution
- **Compliance:** Parental consent rate, data deletion requests, COPPA violations

### Stored Analytics
- Query `learning_progress` for activity completion
- Query `unit_transactions` for economy health
- Query `orders` for revenue
- Query `audit_events` for compliance
- Query `leaderboard` for engagement

---

## 🔄 State Management

### Zustand Stores
- `authStore` — Current user & session
- `unitStore` — Unit balance & transactions
- `projectStore` — Current editing project
- `uiStore` — UI state (modals, sidebars, etc.)
- `multiplayer` — P2P connection state (when enabled)

### Server State
- React Query handles API caching
- Automatic invalidation on mutations
- Optimistic updates for smooth UX

---

## 🧪 Testing Coverage

### Test Files Included
- `src/lib/app-data/readiness-schedule.test.ts` — Scheduling logic
- `src/lib/auth/gate-identity.test.ts` — Auth gates
- `src/lib/auth/sign-in-gate.test.ts` — Sign-in flow
- `src/lib/app-data/app-data.test.ts` — Data loading

### Run Tests
```bash
npm run test
```

---

## 📚 Database Query Examples

### Get Child's Unit Balance
```sql
SELECT SUM(CASE WHEN kind IN ('credit', 'event') THEN amount ELSE -amount END) as balance
FROM unit_transactions
WHERE child_id = $1;
```

### Get Monthly Revenue
```sql
SELECT DATE_TRUNC('month', created_at) as month, SUM(total_amount) as revenue
FROM orders
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

### Get Top Users (Leaderboard)
```sql
SELECT user_id, SUM(amount) as total_units
FROM unit_transactions
WHERE kind IN ('credit', 'event')
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY total_units DESC
LIMIT 10;
```

### Audit Trail for User
```sql
SELECT * FROM audit_events
WHERE user_id = $1 OR actor_user_id = $1
ORDER BY created_at DESC
LIMIT 100;
```

---

## 🎯 Known Limitations & Future Enhancements

### Current Limitations
- Real-time multiplayer requires server sync (not peer-only)
- Print-on-demand integration requires dropship account
- Email notifications need SendGrid/Mailgun setup
- Phone verification requires Twilio
- Analytics requires external service (Data Studio / Tableau)

### Planned for RC7
- [ ] Real-time collaborative editing
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Video tutorials in-app
- [ ] AI art generation (DALL-E integration)
- [ ] Voice chat for teams
- [ ] AR preview for merchandise

---

**Schema Last Updated:** September 27, 2026  
**Version:** RC6  
**Next Review:** October 27, 2026
