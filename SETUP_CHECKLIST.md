# Lumidex Setup Checklist for lumidex.app

## Pre-Deployment Checklist

### ✅ Prerequisites Verification
- [ ] GitHub account is ready
- [ ] Vercel account is ready  
- [ ] Domain `lumidex.app` is owned and accessible
- [ ] Supabase project is configured and accessible
- [ ] Pokemon TCG API key is obtained and valid
- [ ] Google OAuth client is configured

### ✅ Local Environment Check
- [ ] Project builds successfully (`npm run build`)
- [ ] All environment variables in `.env.local` are configured
- [ ] Application runs without errors (`npm run dev`)
- [ ] Key features work in development:
  - [ ] User authentication (email + Google OAuth)
  - [ ] Card search and display
  - [ ] Collection management
  - [ ] API endpoints respond correctly

## Deployment Steps

### 🚀 Step 1: GitHub Repository Setup
- [ ] Create new GitHub repository named `lumidex`
- [ ] Set repository to **Public** (required for free Vercel)
- [ ] Initialize local git repository
- [ ] Push all code to GitHub main branch
- [ ] Verify all files are pushed correctly (check GitHub web interface)

**Commands:**
```bash
git init
git add .
git commit -m "Initial commit: Lumidex Pokemon card collection app"
git remote add origin https://github.com/YOUR_USERNAME/lumidex.git
git branch -M main
git push -u origin main
```

### 🔧 Step 2: Vercel Project Configuration
- [ ] Create new Vercel project from GitHub repository
- [ ] Select Next.js framework preset
- [ ] Configure build settings:
  - [ ] Root Directory: `./`
  - [ ] Build Command: `npm run build`
  - [ ] Install Command: `npm install`

### 🌍 Step 3: Environment Variables Setup
Add these environment variables in Vercel:

**Required Variables:**
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `POKEMON_TCG_API_KEY`
- [ ] `NEXT_PUBLIC_APP_URL=https://lumidex.app`
- [ ] `NEXT_PUBLIC_APP_NAME=Lumidex - European Card Tracker`
- [ ] `NODE_ENV=production`
- [ ] `NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID`

**Optional Variables:**
- [ ] `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID` (leave empty if not using)
- [ ] `SENTRY_DSN` (leave empty if not using)

### 🌐 Step 4: Domain Configuration
- [ ] Add `lumidex.app` domain in Vercel project settings
- [ ] Configure DNS records with domain provider:
  - [ ] A record: `@` → `76.76.19.61`
  - [ ] CNAME record: `www` → `cname.vercel-dns.com`
- [ ] Wait for DNS propagation (up to 48 hours)
- [ ] Verify domain resolves to Vercel

### 🔐 Step 5: Authentication Configuration

**Supabase Settings:**
- [ ] Update Site URL to `https://lumidex.app`
- [ ] Add redirect URLs:
  - [ ] `https://lumidex.app/auth/callback`
  - [ ] `https://www.lumidex.app/auth/callback`
  - [ ] `https://lumidex.app/auth/signin`
  - [ ] `https://lumidex.app/auth/signup`

**Google OAuth Settings:**
- [ ] Add authorized redirect URIs:
  - [ ] `https://lumidex.app/auth/callback`
  - [ ] `https://www.lumidex.app/auth/callback`
- [ ] Add authorized JavaScript origins:
  - [ ] `https://lumidex.app`
  - [ ] `https://www.lumidex.app`

### ✅ Step 6: Deployment & Testing
- [ ] Deploy project in Vercel
- [ ] Verify build completes successfully
- [ ] Test temporary Vercel URL works
- [ ] Test custom domain once DNS propagates
- [ ] Verify SSL certificate is active

## Post-Deployment Testing

### 🧪 Core Functionality Tests
- [ ] Home page loads correctly
- [ ] User registration works
- [ ] Email login works
- [ ] Google OAuth login works
- [ ] Password reset functionality
- [ ] Card search returns results
- [ ] Collection management (add/remove cards)
- [ ] Wishlist functionality
- [ ] Trading features accessible
- [ ] User profile loads
- [ ] Price data displays correctly

### 📱 Responsive & Performance Tests
- [ ] Mobile responsiveness (test on phone/tablet)
- [ ] Page load speed under 3 seconds
- [ ] Images load and optimize correctly
- [ ] Navigation works on all screen sizes
- [ ] Touch interactions work on mobile

### 🔍 API Endpoint Tests
Test these API endpoints manually:
- [ ] `/api/sync/cards` - Card data synchronization
- [ ] `/api/sync/pricing` - Price updates
- [ ] `/api/achievements/check` - Achievement system
- [ ] `/api/friends/with-card` - Social features

### 🛡️ Security Tests
- [ ] HTTPS redirect works (http://lumidex.app → https://lumidex.app)
- [ ] Security headers present (check browser dev tools)
- [ ] Authentication redirects work correctly
- [ ] Unauthorized access properly blocked

## Troubleshooting Quick Fixes

### Domain Issues
**Problem:** Domain not resolving
- [ ] Check DNS propagation at [dnschecker.org](https://dnschecker.org/)
- [ ] Verify DNS records are correct
- [ ] Clear browser DNS cache
- [ ] Wait up to 48 hours for global propagation

### Authentication Issues
**Problem:** Login/OAuth not working
- [ ] Verify Supabase Site URL matches production domain
- [ ] Check Google OAuth redirect URIs include production URLs
- [ ] Ensure all environment variables are set in Vercel
- [ ] Test with incognito browser window

### Build/Deployment Issues
**Problem:** Build fails in Vercel
- [ ] Check Vercel build logs for specific errors
- [ ] Verify all environment variables are set
- [ ] Test local build: `npm run build`
- [ ] Check for TypeScript errors
- [ ] Verify all dependencies are in package.json

### Performance Issues
**Problem:** Slow loading times
- [ ] Check Next.js Image optimization is working
- [ ] Verify CDN caching headers
- [ ] Check bundle size with `npm run build:analyze`
- [ ] Monitor Vercel function execution times

## Success Criteria

✅ **Deployment is successful when:**
- [ ] `https://lumidex.app` loads without errors
- [ ] All core features work as expected
- [ ] Authentication works for both email and Google OAuth
- [ ] Mobile experience is responsive and functional
- [ ] Page load times are under 3 seconds
- [ ] SSL certificate is valid and secure
- [ ] No console errors in browser developer tools

## Maintenance Tasks

### 🔄 Regular Monitoring
- [ ] Monitor Vercel deployment logs weekly
- [ ] Check Supabase database usage monthly
- [ ] Review API usage and rate limits
- [ ] Update dependencies quarterly
- [ ] Monitor domain renewal dates

### 📊 Performance Monitoring
- [ ] Review Vercel Analytics data
- [ ] Monitor Core Web Vitals scores
- [ ] Check error rates in Sentry (if configured)
- [ ] Review user feedback and support requests

---

## Quick Reference

**Production URL:** https://lumidex.app  
**Vercel Dashboard:** https://vercel.com/dashboard  
**Supabase Dashboard:** https://supabase.com/dashboard  
**GitHub Repository:** https://github.com/YOUR_USERNAME/lumidex  

**Emergency Rollback:**
1. Go to Vercel Dashboard
2. Select project → Deployments
3. Find previous working deployment
4. Click "..." → "Redeploy"

---

*Complete this checklist step by step for a successful Lumidex deployment to lumidex.app*