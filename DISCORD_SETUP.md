# Discord OAuth Setup Guide

This document describes the manual steps required to enable **Discord OAuth** login in Lumidex.

---

## Overview

Lumidex uses **Supabase Auth** to handle OAuth providers. Enabling Discord login requires:

1. Creating a Discord Application in the Discord Developer Portal
2. Configuring the OAuth2 redirect URI in Discord
3. Enabling the Discord provider in the Supabase Dashboard and supplying the credentials

---

## Step 1 — Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and sign in.
2. Click **"New Application"** (top-right).
3. Give it a name (e.g. `Lumidex`) and click **"Create"**.
4. In the left sidebar, select **"OAuth2"**.
5. Under **"Client information"**, note down:
   - **Client ID**
   - **Client Secret** (click "Reset Secret" if none is shown — copy it immediately)

---

## Step 2 — Add the Redirect URI in Discord

1. Still on the **OAuth2** page in the Discord Developer Portal, scroll to the **"Redirects"** section.
2. Click **"Add Redirect"** and enter:

   ```
   https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
   ```

   Replace `<your-supabase-project-ref>` with your project reference (visible in the Supabase dashboard URL, e.g. `abcdefghijklmnop`).

3. Click **"Save Changes"**.

> **Local development:** If you also want Discord OAuth to work on `localhost`, add a second redirect URI:
> ```
> http://localhost:3000/auth/callback
> ```
> Note: Supabase handles the proxy — your app's `/auth/callback` route receives the final redirect from Supabase (not directly from Discord).

---

## Step 3 — Enable Discord in the Supabase Dashboard

1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **Authentication → Providers**.
3. Find **Discord** and click to expand it.
4. Toggle **"Enable Discord provider"** to **on**.
5. Enter the values from Step 1:
   - **Client ID** → paste from Discord
   - **Client Secret** → paste from Discord
6. The **Callback URL (for OAuth)** shown in this panel is what you pasted into Discord in Step 2 — confirm they match.
7. Click **"Save"**.

---

## Step 4 — Verify Redirect URLs in Supabase

1. In the Supabase Dashboard, go to **Authentication → URL Configuration**.
2. Ensure your production domain is listed under **"Redirect URLs"**, e.g.:
   ```
   https://your-app.vercel.app/**
   ```
3. For local development also add:
   ```
   http://localhost:3000/**
   ```
4. Click **"Save"**.

---

## Step 5 — Environment Variables

No additional environment variables are needed for Discord — the credentials are stored directly in the Supabase project and the existing variables are sufficient:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>
SUPABASE_SECRET_KEY=<your-service-role-key>
```

The `SUPABASE_SECRET_KEY` (service role key) is used by the auth callback route to create a profile row for new Discord users automatically. Make sure this is set in both your local `.env.local` and your Vercel/hosting environment.

---

## How it Works in Lumidex

When a user clicks **"Continue with Discord"** on the login page:

1. [`signInWithDiscord()`](lib/auth.ts) calls `supabase.auth.signInWithOAuth({ provider: 'discord' })`.
2. The browser is redirected to Discord's OAuth consent screen.
3. After the user approves, Discord redirects to Supabase, which exchanges the code and then redirects to `/auth/callback?code=…`.
4. The [`app/auth/callback/route.ts`](app/auth/callback/route.ts) handler:
   - Calls `supabase.auth.exchangeCodeForSession(code)` to establish the session.
   - Checks whether a `users` row already exists for this user.
   - If **no profile exists** (first-time Discord user), it auto-creates one using Discord metadata (`global_name`, `user_name`, `avatar_url`).
5. The user is redirected to `/dashboard`. If `setup_completed` is `false`, the **FirstTimeSetupModal** will appear so they can customise their profile.

---

## Discord Metadata Available

Supabase exposes Discord's user metadata under `user.user_metadata`. The fields Lumidex reads are:

| Field | Discord source | Used for |
|---|---|---|
| `custom_claims.global_name` | Discord display name | Username seed |
| `user_name` | Discord username handle | Username seed (fallback) |
| `avatar_url` | Discord avatar CDN URL | Initial profile picture |
| `full_name` | Derived by Supabase | Username seed (fallback) |

The auto-generated username is sanitised to alphanumeric + underscores and capped at 30 characters. Users can change it at any time through the profile settings.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| "OAuth is not properly configured" error | Discord provider not enabled in Supabase | Complete Step 3 |
| `redirect_uri_mismatch` from Discord | Redirect URI mismatch | Ensure the Supabase callback URL in Discord matches exactly (Step 2) |
| User lands on `/login?error=…` after Discord | Code exchange failed | Check Supabase logs (Dashboard → Logs → Auth) |
| Profile not created after first login | `SUPABASE_SECRET_KEY` not set or wrong | Verify the service role key env var in your deployment |
| Avatar not showing after Discord login | Discord CDN URL expired | User can re-upload via profile settings; Discord CDN links can be temporary |
