# Fix Email Confirmation Redirect

## Issue
After email confirmation, users are redirected to `http://localhost:3000/#` instead of going through the proper auth callback flow to reach the setup wizard.

## Solution

### 1. Update Supabase Auth Settings

Go to your Supabase project dashboard:

1. **Authentication** → **Settings** → **Auth**
2. Find **Site URL** and set it to: `http://localhost:3000`
3. Find **Redirect URLs** and add: `http://localhost:3000/auth/callback`

### 2. Update Email Templates (Optional)

In **Authentication** → **Email Templates**:

- **Confirm signup**: Change redirect URL to `{{ .SiteURL }}/auth/callback`
- **Magic Link**: Change redirect URL to `{{ .SiteURL }}/auth/callback`
- **Change Email Address**: Change redirect URL to `{{ .SiteURL }}/auth/callback`

### 3. Update Auth Configuration in Code

If you have custom auth configuration, ensure the redirect URL is set properly:

```typescript
// In your auth functions
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`
  }
})
```

### 4. Production Settings

For production, update the URLs to your production domain:
- Site URL: `https://yourdomain.com`
- Redirect URLs: `https://yourdomain.com/auth/callback`

## How It Works Now

1. User signs up → receives confirmation email
2. User clicks email link → redirects to `/auth/callback`
3. Auth callback checks setup status → redirects to `/setup` or `/dashboard`
4. Home page (`/`) also checks auth status and redirects appropriately

This ensures all authentication flows properly route users through the setup wizard.