# Domain and Authentication Setup for lumidex.app

## Step 1: Custom Domain Configuration (After Vercel Deployment)

### 1.1 Add Domain in Vercel
Once your Vercel deployment completes:

1. Go to your Vercel project dashboard
2. Click **"Settings"** tab
3. Click **"Domains"** in the sidebar
4. Add domain: `lumidex.app`
5. Vercel will show you DNS records to configure

### 1.2 DNS Configuration
Configure these DNS records with your domain provider:

**Root Domain (lumidex.app):**
```
Type: A
Name: @ (or leave blank)
Value: 76.76.19.61
TTL: 3600 (or 1 hour)
```

**WWW Subdomain:**
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600 (or 1 hour)
```

**Note:** DNS propagation can take 24-48 hours globally, but often works within minutes.

---

## Step 2: Update Supabase Authentication

### 2.1 Supabase Dashboard Configuration
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `xwlmuufqiscsdegiszyr`
3. Navigate to **Authentication** → **URL Configuration**

### 2.2 Update Site URL
Change Site URL from:
```
http://localhost:3000
```
To:
```
https://lumidex.app
```

### 2.3 Update Redirect URLs
Add these redirect URLs (keep existing localhost ones for development):

**Existing (keep these):**
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/signin`
- `http://localhost:3000/auth/signup`

**Add these new ones:**
- `https://lumidex.app/auth/callback`
- `https://www.lumidex.app/auth/callback`
- `https://lumidex.app/auth/signin`
- `https://lumidex.app/auth/signup`
- `https://lumidex.app/auth/reset-password`

### 2.4 Update Email Templates (Optional)
Navigate to **Authentication** → **Email Templates** and update links in:
- Confirm signup template
- Reset password template
- Magic link template

Change any `{{ .SiteURL }}` references to use `https://lumidex.app`

---

## Step 3: Update Google OAuth Configuration

### 3.1 Google Cloud Console
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 client: `296510934037-6bk8662fu3sbfhfajc143s6knm5jk5n7`
4. Click to edit

### 3.2 Authorized JavaScript Origins
Add these origins (keep existing localhost for development):

**Existing (keep):**
- `http://localhost:3000`

**Add these:**
- `https://lumidex.app`
- `https://www.lumidex.app`

### 3.3 Authorized Redirect URIs
Add these redirect URIs (keep existing localhost for development):

**Existing (keep):**
- `http://localhost:3000/auth/callback`

**Add these:**
- `https://lumidex.app/auth/callback`
- `https://www.lumidex.app/auth/callback`

### 3.4 Save Changes
Click **"Save"** - changes take effect immediately.

---

## Step 4: Verification Checklist

### 4.1 Domain Verification
- [ ] `https://lumidex.app` loads (may take up to 48 hours for DNS)
- [ ] `https://www.lumidex.app` redirects to main domain
- [ ] SSL certificate is valid (green lock icon)
- [ ] No mixed content warnings

### 4.2 Authentication Testing
Test these features on production domain:

**Email Authentication:**
- [ ] User registration with email
- [ ] Email confirmation (check spam folder)
- [ ] User login with email
- [ ] Password reset flow
- [ ] Email verification redirects correctly

**Google OAuth:**
- [ ] Google sign-in button appears
- [ ] Google OAuth popup works
- [ ] Successful authentication redirects to dashboard
- [ ] User profile populated correctly

### 4.3 Core Application Testing
- [ ] Home page loads without errors
- [ ] Navigation works correctly
- [ ] Pokemon card search functions
- [ ] Collection management accessible
- [ ] API endpoints respond correctly
- [ ] No console errors in browser developer tools

---

## Step 5: DNS Propagation Monitoring

### 5.1 Check DNS Propagation
Use these tools to monitor DNS propagation:
- [DNS Checker](https://dnschecker.org/) - Search for `lumidex.app`
- [WhatsMyDNS](https://whatsmydns.net/) - Check global propagation
- Command line: `nslookup lumidex.app`

### 5.2 Common DNS Issues
**Problem:** Domain not resolving
- Wait 24-48 hours for full propagation
- Clear browser DNS cache (Chrome: `chrome://net-internals/#dns`)
- Try incognito/private browsing mode
- Test from different networks/devices

**Problem:** Mixed content errors
- Ensure all resources use HTTPS
- Check Next.js image optimization settings
- Verify external API calls use HTTPS

---

## Step 6: Performance Verification

### 6.1 Core Web Vitals
Test your site with:
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [WebPageTest](https://www.webpagetest.org/)
- Chrome DevTools Lighthouse

**Target Metrics:**
- First Contentful Paint (FCP): < 1.8s
- Largest Contentful Paint (LCP): < 2.5s
- Cumulative Layout Shift (CLS): < 0.1
- First Input Delay (FID): < 100ms

### 6.2 Functionality Testing
Test on multiple devices and browsers:
- [ ] Desktop Chrome/Firefox/Safari
- [ ] Mobile Chrome/Safari
- [ ] Tablet responsive design
- [ ] Different screen resolutions

---

## Troubleshooting Quick Reference

### Authentication Issues
1. Check Supabase Site URL matches production domain
2. Verify all redirect URLs are added correctly
3. Test with incognito browser (clears auth cache)
4. Check browser console for specific error messages

### Domain Issues
1. Verify DNS records are correct (A and CNAME)
2. Check DNS propagation status
3. Clear browser cache and DNS cache
4. Try accessing from different network

### Build/Deployment Issues
1. Check Vercel build logs for errors
2. Verify all environment variables are set
3. Test local build: `npm run build`
4. Check for TypeScript/linting errors

---

**Next Steps After Vercel Deployment:**
1. Note your temporary Vercel URL (e.g., `lumidex-abc123.vercel.app`)
2. Test the temporary URL to ensure everything works
3. Add custom domain `lumidex.app` in Vercel
4. Configure DNS records
5. Update authentication settings
6. Test production domain once DNS propagates

---

*This guide ensures your Lumidex application works perfectly with your custom domain and authentication providers.*