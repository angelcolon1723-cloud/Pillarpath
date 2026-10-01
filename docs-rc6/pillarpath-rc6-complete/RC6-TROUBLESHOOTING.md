# RC6 Troubleshooting & Common Issues

**Version:** RC6  
**Last Updated:** September 27, 2026  

---

## 🆘 General Support Workflow

1. **Check logs**
   ```bash
   # Docker: docker logs pillarpath-app
   # Local: npm run dev (shows live logs)
   # Vercel: vercel logs [deployment-url]
   ```

2. **Check environment variables**
   ```bash
   echo "DATABASE_URL: $DATABASE_URL"
   echo "JWT_SECRET length: ${#JWT_SECRET}"
   ```

3. **Test database connection**
   ```bash
   psql $DATABASE_URL -c "SELECT 1;"
   ```

4. **Check Sentry** (if configured)
   - Go to https://sentry.io and review error logs

5. **Query audit logs** (compliance/debugging)
   ```sql
   SELECT * FROM audit_events ORDER BY created_at DESC LIMIT 20;
   ```

---

## 🐛 Common Issues & Solutions

### ❌ "Port 8080 Already in Use"

**Error:**
```
Error: listen EADDRINUSE: address already in use :::8080
```

**Solutions:**

#### Windows
```powershell
# Find process using port 8080
netstat -ano | findstr :8080

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

#### macOS/Linux
```bash
# Find process
lsof -i :8080

# Kill process
kill -9 <PID>
```

#### Alternative: Change Port
```bash
# In .env.local
PORT=3000

# Then restart
npm run dev
```

---

### ❌ "Cannot Connect to Database"

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Causes & Solutions:**

#### 1. PostgreSQL Not Running
```bash
# macOS: Start PostgreSQL
brew services start postgresql

# Docker: Start container
docker-compose up postgres -d

# Windows: Start service
net start postgresql-x64-15
```

#### 2. Wrong CONNECTION URL
```bash
# Check DATABASE_URL is set
echo $DATABASE_URL

# Should look like:
# postgresql://pillarpath:password@localhost:5432/pillarpath

# Test connection with psql
psql "postgresql://pillarpath:password@localhost:5432/pillarpath" -c "SELECT 1;"
```

#### 3. Database Doesn't Exist
```bash
# Create database
psql -U postgres -c "CREATE DATABASE pillarpath OWNER pillarpath;"

# Or via connection string:
createdb -h localhost -U pillarpath pillarpath
```

#### 4. Wrong Credentials
```bash
# Check password in .env.local
# Default for docker-compose is: pillarpath-dev-password-change-in-prod

# Reset password (as superuser)
psql -U postgres -c "ALTER USER pillarpath WITH PASSWORD 'new-password';"
```

**Test Command:**
```bash
psql $DATABASE_URL -c "SELECT version();"
```

---

### ❌ "JWT Secret Not Set or Too Short"

**Error:**
```
Error: JWT_SECRET must be at least 32 characters
```

**Solution:**
```bash
# Generate new secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET"

# Add to .env.local
echo "JWT_SECRET=$JWT_SECRET" >> .env.local

# Verify
echo ${#JWT_SECRET}  # Should show 43-44 (base64 encoded 32 bytes)

# Restart app
npm run dev
```

---

### ❌ "Cannot Login - Session Not Persisting"

**Symptoms:**
- Sign in works, but gets logged out on page reload
- Session cookie not showing in DevTools

**Solutions:**

#### 1. Check Cookie Settings
```javascript
// In browser console
document.cookie // Should show auth.session cookie

// Check cookie properties
// Should have: HttpOnly, Secure (HTTPS), SameSite=Strict
```

#### 2. Check Localhost HTTPS
```bash
# If running on localhost, need ALLOW_INSECURE_HTTP=true
# In .env.local:
ALLOW_INSECURE_HTTP=true

# Restart
npm run dev
```

#### 3. Check JWT_SECRET Changed
```bash
# Session tokens expire if JWT_SECRET changes
# Clear browser cookies and sign in again

# Or force logout:
# Browser DevTools > Application > Cookies > Delete auth.session
```

#### 4. Check Session Table
```sql
SELECT * FROM session LIMIT 5;

-- If empty, sessions not being created
-- Check logs for errors during signup
```

---

### ❌ "Migrations Failed - Database Schema Empty"

**Error:**
```
Error: Table "user" does not exist
```

**Solutions:**

#### 1. Run Migrations Manually
```bash
npm run db:migrate

# Or with debugging
DEBUG=* npm run db:migrate
```

#### 2. Check Migration Files
```bash
ls -la migrations/
# Should show: 0001_auth.sql, 0002_pillarpath_commerce.sql, 0003_advanced_family_experience.sql
```

#### 3. Verify Migrations Ran
```sql
SELECT * FROM schema_migrations;
-- Should list all 3 migrations
```

#### 4. Manual Schema Reset (⚠️ Deletes All Data)
```bash
# Drop all tables
psql $DATABASE_URL -c "
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO pillarpath;
"

# Re-run migrations
npm run db:migrate
```

---

### ❌ "Stripe Webhook Not Firing"

**Symptoms:**
- Payment goes through but order not created
- Webhook tab in Stripe shows 0 deliveries

**Solutions:**

#### 1. Check Webhook Registered
```bash
# In Stripe dashboard:
# Developers > Webhooks > View details

# Endpoint should be: https://yourdomain.com/api/webhooks/stripe
# Events: payment_intent.succeeded, charge.refunded
```

#### 2. Test Webhook Locally
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Listen for webhooks
stripe listen --forward-to localhost:8080/api/webhooks/stripe

# Trigger test event
stripe trigger payment_intent.succeeded

# Check your app logs
npm run dev  # Should show webhook received
```

#### 3. Check Webhook Secret
```bash
# Get from Stripe dashboard
# Developers > Webhooks > Signing secret

# Add to .env.local
STRIPE_WEBHOOK_SECRET=whsec_xxxx...

# Restart app
npm run dev
```

#### 4. Check API Keys
```bash
# Verify keys are correct
echo "Publishable: $STRIPE_PUBLISHABLE_KEY"
echo "Secret: $STRIPE_SECRET_KEY"

# Both should start with correct prefix:
# pk_test_... or pk_live_...
# sk_test_... or sk_live_...
```

---

### ❌ "Auth Endpoints 404 - Not Found"

**Error:**
```
POST /auth/signup → 404 Not Found
```

**Solutions:**

#### 1. Check Better-Auth Configured
```bash
# Check src/lib/auth/server.ts exists
# Should export auth object

# Restart dev server
npm run dev
```

#### 2. Verify Auth Route Mounted
```bash
# In src/routes/api/auth/$.ts
# Should have: export const route = new Route(...)

# Check file exists and has content
cat src/routes/api/auth/\$.ts | head -20
```

#### 3. Clear Cache
```bash
# Clear .next cache
rm -rf .next

# Rebuild
npm run build

# Restart
npm run dev
```

---

### ❌ "Stripe Payment Form Not Showing"

**Symptoms:**
- Checkout page loads but payment input not visible
- JavaScript errors in console

**Solutions:**

#### 1. Check Stripe Publishable Key
```javascript
// In browser console
console.log(window.__STRIPE_PUBLISHABLE_KEY__)
// Should show: pk_test_xxxx...
```

#### 2. Check Stripe.js Loaded
```javascript
// In browser console
console.log(typeof Stripe)  // Should be 'function', not 'undefined'
```

#### 3. Check Environment Variable
```bash
echo $STRIPE_PUBLISHABLE_KEY

# Should NOT be empty
# Restart app if changed:
npm run dev
```

#### 4. Clear Browser Cache
```bash
# DevTools > Application > Clear site data
# Or Ctrl+Shift+Delete > Delete everything
# Refresh page
```

---

### ❌ "CORS Error - Cannot Call API"

**Error:**
```
Access to XMLHttpRequest... has been blocked by CORS policy
```

**Solutions:**

#### 1. Check Origin
```javascript
// Browser console
console.log(window.location.origin)
// Should match AUTH_URL in .env.local
```

#### 2. Check CORS Headers
```bash
# Make test request
curl -i -X OPTIONS http://localhost:8080/api/studio/projects

# Should show:
# Access-Control-Allow-Origin: *
# Access-Control-Allow-Methods: GET, POST, PUT, DELETE
```

#### 3. Check Content-Type
```javascript
// Client code should send:
// Content-Type: application/json
```

---

### ❌ "Out of Memory - Heap Size Exceeded"

**Error:**
```
JavaScript heap out of memory
```

**Solutions:**

#### 1. Increase Node Heap Size
```bash
# Default: 512MB
# Increase to 2GB
NODE_OPTIONS="--max-old-space-size=2048" npm run dev

# Or in .env.local
# NODE_OPTIONS=--max-old-space-size=2048
```

#### 2. Identify Memory Leak
```bash
# Check for large queries
# Query audit_events table is huge?
# Clear audit logs:
DELETE FROM audit_events WHERE created_at < NOW() - INTERVAL '30 days';
```

#### 3. Restart App
```bash
# Stop app: Ctrl+C
npm run dev  # Restart with fresh memory
```

---

### ❌ "Email Not Sending"

**Symptoms:**
- Sign up completes but no verification email
- No password reset emails

**Solutions:**

#### 1. Check Email Provider Configured
```bash
# In .env.local
echo $SENDGRID_API_KEY
echo $SENDGRID_FROM_EMAIL

# Both should be set
```

#### 2. Test Email Sending
```bash
# Check src/lib/email.ts
# Should have sendEmail() function

# Test from Node REPL
node -e "require('./src/lib/email.ts').sendEmail({...})"
```

#### 3. Check SendGrid Activity
```bash
# Log in to SendGrid dashboard
# Mail Settings > Event Notification > View Details
# Check if emails are bouncing
```

#### 4. Check Logs
```sql
-- Check audit log for email attempts
SELECT * FROM audit_events 
WHERE action LIKE '%EMAIL%' 
ORDER BY created_at DESC LIMIT 10;
```

---

### ❌ "Vercel Deploy Fails - Build Error"

**Error:**
```
Error: Build failed
```

**Solutions:**

#### 1. Check Node Version
```bash
# Vercel should use Node 22 (check in vercel.json)
echo "Node: $(node -v)"
echo "npm: $(npm -v)"
```

#### 2. Check Dependencies
```bash
# Delete node_modules
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Try build
npm run build
```

#### 3. Check Environment Variables
```bash
# In Vercel dashboard:
# Settings > Environment Variables
# All vars should be set (DATABASE_URL, JWT_SECRET, etc.)

# List vars locally
set | grep -E "DATABASE_URL|JWT_SECRET|STRIPE"
```

#### 4. Check Build Logs
```bash
# Vercel shows build logs when deployment fails
# Look for:
# - Module not found
# - Type errors
# - Missing environment variables
```

#### 5. Manual Build Test
```bash
npm run build
# If succeeds locally but fails on Vercel, likely env var issue
```

---

### ❌ "Images Not Loading - 404 Errors"

**Symptoms:**
- User avatars show broken image icon
- Project thumbnails not displaying

**Solutions:**

#### 1. Check Image URLs
```javascript
// In browser console
document.querySelectorAll('img').forEach(img => {
  console.log(img.src, img.style.visibility)
})
```

#### 2. Check CDN Configuration
```bash
# If using CDN for images:
# In .env.local
# CDN_URL=https://cdn.example.com

# Images should load from:
# https://cdn.example.com/image-id
```

#### 3. Check Database
```sql
-- Check if images stored correctly
SELECT id, title, payload->>'imageUrl' as image_url 
FROM studio_projects 
LIMIT 5;
```

#### 4. Clear Browser Cache
```bash
# DevTools > Network > Disable cache
# Refresh page
```

---

### ❌ "Child Account Won't Load - Infinite Loading"

**Symptoms:**
- Dashboard shows spinner forever
- No error in console

**Solutions:**

#### 1. Check Permissions
```sql
-- Verify child record exists and parent can access
SELECT * FROM children WHERE id = ?;

-- Check parent has permission
SELECT * FROM "user" WHERE id = (SELECT user_id FROM children WHERE id = ?);
```

#### 2. Check Database Queries
```bash
# Enable query logging
DEBUG=pg:query npm run dev

# Look for slow queries (> 1s)
```

#### 3. Clear Browser Storage
```javascript
// In console
localStorage.clear()
sessionStorage.clear()
location.reload()
```

#### 4. Check API Response
```bash
# Make direct API call
curl -X GET http://localhost:8080/api/children \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Should return array of children
```

---

### ❌ "Parental Consent Form Not Showing"

**Symptoms:**
- New parent account, no consent form appears
- Child account creation blocked without reason

**Solutions:**

#### 1. Check COPPA Setting
```bash
echo $REQUIRE_PARENTAL_CONSENT
# Should be 'true' for production

# In .env.local:
REQUIRE_PARENTAL_CONSENT=true
```

#### 2. Check Consent Flag in Database
```sql
SELECT user_id, parent_consent_verified 
FROM profiles 
WHERE user_id = 'your_user_id';

-- If parent_consent_verified = false, form should show
```

#### 3. Check Component Rendering
```javascript
// Browser DevTools > Elements
// Search for "consent" in HTML

// Should see form if not verified
```

#### 4. Force Re-check
```sql
-- Set flag to false to re-show form
UPDATE profiles 
SET parent_consent_verified = false 
WHERE user_id = 'your_user_id';
```

---

## 🔍 Debugging Techniques

### Enable Debug Logging
```bash
# Full debugging
DEBUG=* npm run dev

# Specific module
DEBUG=pillarpath:* npm run dev

# Database queries
DEBUG=pg:* npm run dev
```

### Check Network Requests
```bash
# Browser DevTools > Network tab
# Filter by:
# - XHR/Fetch only
# - Status 4xx/5xx for errors
# - > 1s for slow requests

# Right-click > Copy as cURL to test manually
```

### Database Query Performance
```sql
-- Check slow query log (PostgreSQL)
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
WHERE mean_exec_time > 100  -- > 100ms
ORDER BY mean_exec_time DESC;

-- Create index if needed
CREATE INDEX idx_studio_projects_user 
ON studio_projects(user_id, updated_at DESC);
```

### Browser Local Storage Inspection
```javascript
// See all stored data
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  console.log(`${key}: ${localStorage.getItem(key)}`);
}

// Check auth session
console.log(localStorage.getItem('auth.session'))
```

---

## 🚨 Critical Issues & Escalation

### Database Corruption
- **Symptom:** Random "column does not exist" errors
- **Action:** Restore from backup
- **Prevention:** Daily backups enabled

### Payment Processing Down
- **Symptom:** Stripe errors on checkout
- **Action:** Check Stripe status page (stripe.com/status)
- **Prevention:** Configure redundant payment provider

### Memory Leak
- **Symptom:** App gets slower, then crashes
- **Action:** Increase heap size, identify memory leak
- **Prevention:** Set memory alarms in monitoring

### SSL Certificate Expired
- **Symptom:** HTTPS errors in browser
- **Action:** Renew certificate (if Let's Encrypt, auto-renews)
- **Prevention:** 30-day notification set up

---

## 📞 Get Help

### Documentation
- Build Guide: `RC6-BUILD-GUIDE.md`
- Features & Schema: `RC6-FEATURES-AND-SCHEMA.md`
- Deployment Checklist: `RC6-DEPLOYMENT-CHECKLIST.md`

### External Resources
- TanStack Start Docs: https://tanstack.com/start
- Better-Auth Docs: https://better-auth.vercel.app
- PostgreSQL Docs: https://www.postgresql.org/docs
- Stripe Support: https://support.stripe.com

### Community
- GitHub Discussions: [Your Repo]
- Discord: [Your Server]
- Email Support: support@pillarpath.example.com

---

**Last Updated:** September 27, 2026  
**Version:** RC6  
**Maintained By:** [Your Team]
