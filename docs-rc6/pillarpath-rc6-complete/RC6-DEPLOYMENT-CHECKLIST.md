# RC6 Deployment Checklist

**Target Launch Date:** [Your Date]  
**Project:** PillarPath Creative Studio v1  
**Version:** RC6 (Release Candidate 6)  

---

## 🎯 Pre-Deployment (2 Weeks Before)

### Infrastructure Setup
- [ ] **PostgreSQL Database**
  - [ ] Provision database (AWS RDS / DigitalOcean / Railway / Render)
  - [ ] Create `pillarpath` user with strong password
  - [ ] Create `pillarpath` database
  - [ ] Enable automated backups (daily minimum)
  - [ ] Test connection from app container
  - [ ] Document DATABASE_URL

- [ ] **Redis Cache (Optional but recommended)**
  - [ ] Provision Redis instance
  - [ ] Configure password authentication
  - [ ] Enable persistence (RDB or AOF)
  - [ ] Document REDIS_URL

- [ ] **DNS & SSL**
  - [ ] Domain registered (e.g., pillarpath.example.com)
  - [ ] DNS pointed to deployment (Vercel / DigitalOcean / AWS)
  - [ ] SSL certificate provisioned (auto via Let's Encrypt if using custom domain)
  - [ ] Verify HTTPS works

### Authentication & Security
- [ ] **JWT Secret**
  - [ ] Generate: `openssl rand -base64 32`
  - [ ] Store in password manager
  - [ ] Add to `.env.local` / deployment platform
  - [ ] Document rotation policy (every 90 days)

- [ ] **Secrets Management**
  - [ ] Set up vault (AWS Secrets Manager / HashiCorp Vault)
  - [ ] Rotate all API keys to unique, strong values
  - [ ] Enable audit logging for secret access
  - [ ] Document who has access to what

- [ ] **OAuth Providers (Optional)**
  - [ ] [ ] Google OAuth
    - [ ] Create Google Cloud project
    - [ ] Generate OAuth credentials
    - [ ] Set redirect URIs to `https://yourdomain.com/auth/google/callback`
    - [ ] Add CLIENT_ID & CLIENT_SECRET to env
  - [ ] [ ] GitHub OAuth (if offering developer login)
  - [ ] [ ] Apple Sign-In (if targeting iOS)

### Payment Processing (Required for Marketplace)
- [ ] **Stripe Setup**
  - [ ] Create Stripe account (https://stripe.com)
  - [ ] Get API keys (test + live)
  - [ ] Add STRIPE_SECRET_KEY & STRIPE_PUBLISHABLE_KEY to env
  - [ ] Create webhook endpoint in Stripe dashboard
    - [ ] URL: `https://yourdomain.com/api/webhooks/stripe`
    - [ ] Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
  - [ ] Get STRIPE_WEBHOOK_SECRET
  - [ ] Test webhook with stripe-cli locally
  - [ ] Add VAT/tax rules (if selling physical products)

- [ ] **Dropship Integration (Optional)**
  - [ ] [ ] Sign up for print-on-demand provider
    - [ ] Printful, Teespring, Redbubble, or custom
  - [ ] Get API key and webhook token
  - [ ] Add DROPSHIP_API_KEY & DROPSHIP_WEBHOOK_TOKEN to env
  - [ ] Create webhook endpoint
    - [ ] URL: `https://yourdomain.com/api/webhooks/dropship`
  - [ ] Test order creation → print → shipment flow

### Email & Communication
- [ ] **Email Service**
  - [ ] Set up SendGrid / Mailgun / SES
  - [ ] Add SENDGRID_API_KEY (or equivalent) to env
  - [ ] Add SENDGRID_FROM_EMAIL (noreply@yourdomain.com)
  - [ ] Create email templates (onboarding, purchase confirmation, etc.)
  - [ ] Test sending from Node.js
  - [ ] Configure SPF, DKIM, DMARC records

- [ ] **SMS (Optional, for phone verification)**
  - [ ] [ ] Set up Twilio account
  - [ ] [ ] Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER

### Compliance & Legal
- [ ] **COPPA / Privacy**
  - [ ] [ ] Review COPPA requirements (US kids under 13)
  - [ ] [ ] Add parental consent flow
  - [ ] [ ] Add privacy policy to site
  - [ ] [ ] Implement age verification (birthday + parent email)
  - [ ] [ ] Set REQUIRE_PARENTAL_CONSENT=true in env

- [ ] **GDPR / Data Protection**
  - [ ] [ ] Add data retention policy (e.g., 7 years)
  - [ ] [ ] Implement user data export endpoint
  - [ ] [ ] Implement user data deletion endpoint
  - [ ] [ ] Add Terms of Service
  - [ ] [ ] Document data processing agreements

- [ ] **Accessibility (WCAG 2.1 AA)**
  - [ ] [ ] Run WAVE / Axe accessibility audit
  - [ ] [ ] Verify keyboard navigation works
  - [ ] [ ] Check color contrast ratios
  - [ ] [ ] Test with screen reader (NVDA / JAWS)

---

## 🏗️ Infrastructure Deployment (1 Week Before)

### Choose Deployment Platform

#### Option A: Vercel (Recommended for Jamstack)
- [ ] Push code to GitHub repository
- [ ] Connect GitHub to Vercel
- [ ] Add environment variables
- [ ] Set database to Vercel Postgres or external
- [ ] Deploy
- [ ] Test endpoints

#### Option B: Docker (Any Cloud)
- [ ] Build Docker image: `docker build -t pillarpath:rc6 .`
- [ ] Push to registry (Docker Hub / AWS ECR / DigitalOcean)
- [ ] Set up container orchestration:
  - [ ] Docker Compose (simple)
  - [ ] Kubernetes (production-grade)
  - [ ] DigitalOcean App Platform (managed)
  - [ ] AWS ECS / Fargate (AWS native)
  - [ ] Railway / Render (simple PaaS)

#### Option C: Node.js with Process Manager (PM2)
- [ ] Install PM2: `npm install -g pm2`
- [ ] Create `ecosystem.config.js`
- [ ] Deploy to server
- [ ] Set up reverse proxy (nginx)
- [ ] Configure SSL (Let's Encrypt)

### Database Migrations
- [ ] Verify all migrations run successfully
- [ ] Check migration logs
- [ ] Run manual test queries
- [ ] Verify all tables exist:
  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
  ```

### Environment Variables
- [ ] [ ] DATABASE_URL set and tested
- [ ] [ ] JWT_SECRET set (32+ chars)
- [ ] [ ] NODE_ENV=production
- [ ] [ ] All secrets in vault (not in git)
- [ ] [ ] .env.local added to .gitignore
- [ ] [ ] HTTPS/SSL enabled

---

## 🧪 Testing (1 Week Before Launch)

### Functional Testing
- [ ] **Authentication**
  - [ ] Sign up with email/password
  - [ ] Sign in with email/password
  - [ ] OAuth (Google/GitHub/Apple)
  - [ ] Session persistence across page reload
  - [ ] Logout clears session
  - [ ] Forgot password flow

- [ ] **Family Setup**
  - [ ] Create parent account
  - [ ] Add child profile
  - [ ] Multiple children
  - [ ] Parental consent flow

- [ ] **Creative Studio**
  - [ ] Open coloring tool
  - [ ] Draw/paint on canvas
  - [ ] Save project
  - [ ] Load saved project
  - [ ] Delete project
  - [ ] Share project (if enabled)

- [ ] **Marketplace**
  - [ ] Browse products
  - [ ] Add to cart
  - [ ] Checkout flow
  - [ ] Stripe payment (test card: 4242 4242 4242 4242)
  - [ ] Order confirmation email
  - [ ] Order history visible in dashboard

- [ ] **Pillar Units Economy**
  - [ ] Earn units (daily challenge, activity)
  - [ ] View unit balance
  - [ ] Spend units on marketplace item
  - [ ] Transaction history shows correctly

- [ ] **Admin/Corporate Dashboard**
  - [ ] Log in as corporate admin
  - [ ] View audit logs
  - [ ] View user metrics
  - [ ] Manage roles (optional)

### Performance Testing
- [ ] Load time < 3 seconds (desktop)
- [ ] Load time < 5 seconds (mobile 4G)
- [ ] Lighthouse score > 90 (Performance, Accessibility, Best Practices, SEO)
- [ ] Database queries < 100ms average
- [ ] API endpoints respond < 200ms

### Security Testing
- [ ] [ ] Run OWASP ZAP security scan
  - [ ] No SQL injection vulnerabilities
  - [ ] No XSS vulnerabilities
  - [ ] No CSRF issues
  - [ ] HTTPS enforced
  - [ ] Security headers present (CSP, X-Frame-Options, etc.)

- [ ] [ ] SSL/TLS test (https://www.ssllabs.com/ssltest/)
  - [ ] Grade A or A+ (not A-, B, or lower)
  - [ ] Certificate valid and not expired

- [ ] [ ] Authentication security
  - [ ] Password not exposed in network tab
  - [ ] Session token httpOnly, Secure, SameSite=Strict
  - [ ] No sensitive data in localStorage
  - [ ] JWT token expires (15-30 min)

### Mobile Testing
- [ ] Test on iPhone (iOS 14+)
- [ ] Test on Android (Android 10+)
- [ ] Responsive layout (320px - 2560px)
- [ ] Touch events work correctly
- [ ] Images scale properly
- [ ] No horizontal scroll on mobile

### Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS 14+)
- [ ] Chrome Mobile (Android 10+)

---

## 📊 Monitoring Setup (Before Launch)

### Error Tracking
- [ ] **Sentry Setup**
  - [ ] Create Sentry project
  - [ ] Add Sentry SDK to code
  - [ ] Set SENTRY_DSN & SENTRY_ENVIRONMENT
  - [ ] Test error reporting
  - [ ] Configure alerts for critical errors

### Performance Monitoring
- [ ] **APM (Application Performance Monitoring)**
  - [ ] Set up Sentry Performance / DataDog / New Relic
  - [ ] Monitor database query performance
  - [ ] Set up performance budgets (API response time, page load)
  - [ ] Configure alerts for slow endpoints

### Logging
- [ ] Cloud logging enabled (CloudWatch / StackDriver / Datadog)
- [ ] Structured logging (JSON format)
- [ ] Log retention policy (30 days minimum)
- [ ] Access logs captured (nginx/load balancer)

### Uptime Monitoring
- [ ] Set up uptime monitoring (Pingdom / UptimeRobot / Datadog)
- [ ] Monitor all critical endpoints
- [ ] Configure alerts for downtime
- [ ] Document SLA (99.9% uptime target)

### Database Monitoring
- [ ] Connection pool monitoring
- [ ] Slow query log enabled
- [ ] Backup status monitoring
- [ ] Disk space alerts

---

## 🚀 Launch Day

### Pre-Launch (24 Hours Before)
- [ ] Final code review
- [ ] All tests passing (unit, integration, e2e)
- [ ] All environment variables verified
- [ ] Database backup taken
- [ ] Incident response team briefed
- [ ] Communication channels open (Slack, PagerDuty)

### Go/No-Go Decision (4 Hours Before)
- [ ] [ ] Team sync meeting
- [ ] [ ] Verify staging environment works 100%
- [ ] [ ] Load test passed (simulate peak traffic)
- [ ] [ ] All stakeholders approve
- [ ] [ ] Rollback plan ready

### Launch (T-0)
- [ ] Final backup of database
- [ ] Deploy to production
- [ ] Verify all services healthy
- [ ] Test critical user journeys
- [ ] Monitor error rates (Sentry)
- [ ] Check performance metrics
- [ ] Verify emails sending
- [ ] Verify payments processing (test transaction)
- [ ] Social media notification prepared

### Post-Launch (T+1 Hour)
- [ ] Monitor error dashboard continuously
- [ ] Check database performance
- [ ] Review user feedback (support email)
- [ ] Verify backup system working
- [ ] Document any issues found

### Post-Launch (T+24 Hours)
- [ ] Retrospective on deployment
- [ ] Document any issues encountered
- [ ] Review performance metrics
- [ ] Plan follow-up improvements
- [ ] Update incident playbook

---

## 📈 Post-Launch (Week 1-4)

### Monitoring & Stability
- [ ] Error rate < 0.1%
- [ ] 99.9% uptime maintained
- [ ] Database performance stable
- [ ] No major security incidents
- [ ] Payment processing working reliably

### User Feedback
- [ ] Monitor support email / chat
- [ ] Track user-reported bugs
- [ ] Gather feature requests
- [ ] Note usability issues

### Optimization
- [ ] Optimize slow database queries
- [ ] Cache frequently accessed data
- [ ] Reduce bundle size (if needed)
- [ ] A/B test onboarding flow

### Scale Preparation
- [ ] Document traffic patterns
- [ ] Identify bottlenecks
- [ ] Plan for 10x traffic growth
- [ ] Update auto-scaling rules (if cloud)

---

## 🎓 Documentation Checklist

### For Developers
- [ ] README.md updated
- [ ] API documentation (if offering API)
- [ ] Database schema documented
- [ ] Deployment guide completed
- [ ] Troubleshooting guide written

### For Support Team
- [ ] Support FAQ created
- [ ] Common issues documented
- [ ] Refund policy documented
- [ ] Contact escalation path clear

### For Users
- [ ] Help center / knowledge base
- [ ] Video tutorials (onboarding)
- [ ] Terms of Service & Privacy Policy
- [ ] Accessibility statement

---

## ✅ Launch Readiness Checklist

**Green Light to Launch?**
- [ ] All infrastructure tests passing
- [ ] All functional tests passing
- [ ] All security tests passing
- [ ] Performance meets requirements
- [ ] Monitoring configured
- [ ] Team trained and ready
- [ ] Backup and disaster recovery tested
- [ ] Legal/compliance review completed

**Launch Decision:** ✅ **READY TO DEPLOY**

---

## 📞 On-Call Support (Launch Week)

- **Primary On-Call:** [Name & Phone]
- **Secondary On-Call:** [Name & Phone]
- **Manager On-Call:** [Name & Phone]
- **Escalation:** [Manager Name & Contact]

**Critical Contacts:**
- [ ] Database provider support
- [ ] CDN provider support
- [ ] Payment processor (Stripe) support
- [ ] Hosting provider (Vercel/AWS/etc) support

---

## 🔄 Post-Launch Iteration (Weeks 2-4)

### Metrics to Track
- Daily active users (DAU)
- Monthly active users (MAU)
- User retention rate (Day 1, 7, 30)
- Average session duration
- Marketplace conversion rate
- Payment success rate
- Customer acquisition cost (CAC)

### Planned Improvements
1. [ ] [Add your post-launch features here]
2. [ ] [Add your post-launch features here]
3. [ ] [Add your post-launch features here]

---

**Document Last Updated:** September 27, 2026  
**Version:** RC6  
**Prepared By:** [Your Name]  
**Approved By:** [Manager Name]
