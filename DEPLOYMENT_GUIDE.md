# Lumidex Deployment Guide for lumidex.app

## Overview
This guide will walk you through deploying your Lumidex Pokemon card collection application to production using GitHub, Vercel, and your custom domain `lumidex.app`.

## Prerequisites
- ✅ GitHub account ready
- ✅ Vercel account ready  
- ✅ Domain `lumidex.app` owned
- ✅ Supabase project configured
- ✅ Pokemon TCG API key obtained
- ✅ Google OAuth client configured

## Step 1: Prepare GitHub Repository

### 1.1 Create New Repository
1. Go to [GitHub](https://github.com) and click "New repository"
2. Repository name: `lumidex`
3. Description: "European Pokemon Card Collection Tracker"
4. Set to **Public** (required for free Vercel deployment)
5. Do NOT initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 1.2 Initialize and Push Local Repository
Run these commands in your project directory:

```bash
# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Lumidex Pokemon card collection app"

# Add remote origin (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/lumidex.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 2: Configure Production Environment Variables

### 2.1 Production Environment Configuration
Create these environment variables in Vercel (Step 3 will show where):

**Supabase Configuration:**
```
NEXT_PUBLIC_SUPABASE_URL=https://xwlmuufqiscsdegiszyr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3bG11dWZxaXNjc2RlZ2lzenlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyOTk2NTMsImV4cCI6MjA2ODg3NTY1M30.jx9PQcLnK8Asi3Ee2R629jKhGvP5gJcQfBW_BJmvgQE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3bG11dWZxaXNjc2RlZ2lzenlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI5OTY1MywiZXhwIjoyMDY4ODc1NjUzfQ.SQ0LNSsYnXWzs7naQTuH8e_SkLOl46XTi9uJqxreDRk
```

**Pokemon TCG API:**
```
POKEMON_TCG_API_KEY=d21064be-f874-428d-9f0b-d6780fb2b2bd
```

**Application Configuration:**
```
NEXT_PUBLIC_APP_URL=https://lumidex.app
NEXT_PUBLIC_APP_NAME=Lumidex - European Card Tracker
NODE_ENV=production
```

**Google OAuth:**
```
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=296510934037-6bk8662fu3sbfhfajc143s6knm5jk5n7.apps.googleusercontent.com
```

**Optional (set empty for now):**
```
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=
SENTRY_DSN=
```

## Step 3: Set up Vercel Project

### 3.1 Create Vercel Project
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository (`YOUR_USERNAME/lumidex`)
4. Configure project:
   - **Framework Preset:** Next.js
   - **Root Directory:** ./
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install`

### 3.2 Add Environment Variables
1. In Vercel project settings, go to "Environment Variables"
2. Add each variable from Step 2.1
3. Set environment to "Production"
4. Click "Save"

### 3.3 Deploy Initial Version
1. Click "Deploy" in Vercel
2. Wait for build to complete
3. Note your temporary Vercel URL (e.g., `lumidex-xyz.vercel.app`)

## Step 4: Configure Custom Domain

### 4.1 Add Domain in Vercel
1. In Vercel project settings, go to "Domains"
2. Add domain: `lumidex.app`
3. Vercel will provide DNS records to configure

### 4.2 Configure DNS Settings
Configure these DNS records with your domain provider:

**For root domain (lumidex.app):**
```
Type: A
Name: @
Value: 76.76.19.61
TTL: 3600
```

**For www subdomain:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600
```

**Note:** DNS changes can take 24-48 hours to propagate globally.

## Step 5: Update Supabase Authentication Settings

### 5.1 Configure Site URL and Redirect URLs
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to Authentication > URL Configuration
4. Update:
   - **Site URL:** `https://lumidex.app`
   - **Redirect URLs:** Add `https://lumidex.app/auth/callback`

### 5.2 Update Additional Redirect URLs
Add these URLs to allowed redirects:
- `https://lumidex.app/auth/callback`
- `https://www.lumidex.app/auth/callback`
- `https://lumidex.app/auth/signin`
- `https://lumidex.app/auth/signup`

## Step 6: Update Google OAuth Configuration

### 6.1 Google Cloud Console Configuration
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services > Credentials
3. Select your OAuth 2.0 client
4. Update **Authorized redirect URIs:**
   - Add: `https://lumidex.app/auth/callback`
   - Add: `https://www.lumidex.app/auth/callback`
5. Update **Authorized JavaScript origins:**
   - Add: `https://lumidex.app`
   - Add: `https://www.lumidex.app`

## Step 7: SSL Certificate and Security

### 7.1 SSL Certificate
- Vercel automatically provides SSL certificates
- Certificates are auto-renewed
- Force HTTPS is enabled by default

### 7.2 Security Headers
Your `vercel.json` already includes security headers:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: origin-when-cross-origin

## Step 8: Testing and Verification

### 8.1 Functionality Testing Checklist
After deployment, test these features:

**Authentication:**
- [ ] User registration with email
- [ ] User login with email
- [ ] Google OAuth login
- [ ] Password reset functionality
- [ ] Auth callback redirects work correctly

**Core Features:**
- [ ] Pokemon card search and display
- [ ] Collection management (add/remove cards)
- [ ] Wishlist functionality
- [ ] Trading features
- [ ] Price tracking and history
- [ ] User profiles and achievements

**API Endpoints:**
- [ ] `/api/sync/cards` - Card synchronization
- [ ] `/api/sync/pricing` - Price updates
- [ ] `/api/achievements/check` - Achievement processing
- [ ] `/api/friends/with-card` - Social features

### 8.2 Performance Testing
- [ ] Page load times under 3 seconds
- [ ] Image optimization working
- [ ] Caching headers functioning
- [ ] Mobile responsiveness

### 8.3 SEO and Analytics
- [ ] Meta tags and Open Graph data
- [ ] Sitemap accessibility
- [ ] Google Analytics tracking (if configured)

## Step 9: DNS Propagation and Final Verification

### 9.1 Check DNS Propagation
Use tools like:
- [DNS Checker](https://dnschecker.org/)
- [WhatsMyDNS](https://whatsmydns.net/)

Search for `lumidex.app` to ensure global propagation.

### 9.2 Final Domain Testing
1. Test `https://lumidex.app` loads correctly
2. Test `https://www.lumidex.app` redirects to main domain
3. Verify SSL certificate is valid
4. Test all major functionality on production domain

## Step 10: Post-Deployment Monitoring

### 10.1 Set Up Monitoring
Consider adding:
- Vercel Analytics (built-in)
- Sentry for error tracking
- Google Analytics for user analytics
- Uptime monitoring service

### 10.2 Regular Maintenance
- Monitor Vercel deployment logs
- Check Supabase database performance
- Update dependencies regularly
- Monitor Pokemon TCG API usage

## Troubleshooting

### Common Issues

**Domain not resolving:**
- Check DNS propagation (can take 24-48 hours)
- Verify DNS records are correct
- Clear browser cache

**Authentication errors:**
- Verify Supabase Site URL matches production domain
- Check Google OAuth redirect URIs
- Ensure environment variables are set correctly

**Build failures:**
- Check Vercel build logs
- Verify all environment variables are set
- Ensure no TypeScript errors

**API errors:**
- Check Supabase service role key
- Verify Pokemon TCG API key is valid
- Monitor API rate limits

## Security Considerations

1. **Environment Variables:** Never commit `.env.local` to GitHub
2. **API Keys:** Regularly rotate API keys
3. **Database:** Enable RLS (Row Level Security) in Supabase
4. **CORS:** Configure proper CORS settings
5. **Headers:** Security headers are configured in `vercel.json`

## Performance Optimization

1. **Images:** Next.js Image component with WebP/AVIF formats
2. **Caching:** Static assets cached for 1 year
3. **Compression:** Enabled in `next.config.js`
4. **Bundle Analysis:** Use `npm run build:analyze`

## Support and Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Pokemon TCG API Documentation](https://docs.pokemontcg.io/)

---

## Quick Reference Commands

**Deploy updates:**
```bash
git add .
git commit -m "Update: description of changes"
git push origin main
```

**Check deployment status:**
- Visit Vercel Dashboard
- Monitor build logs
- Check function logs for API issues

**Rollback deployment:**
- Use Vercel Dashboard to redeploy previous version
- Or revert Git commit and push

---

*This guide was created for the Lumidex Pokemon card collection application deployment to lumidex.app*