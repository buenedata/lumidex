# Vercel Environment Variables for Lumidex

Copy and paste these environment variables into your Vercel project:

## Supabase Configuration
```
NEXT_PUBLIC_SUPABASE_URL=https://xwlmuufqiscsdegiszyr.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3bG11dWZxaXNjc2RlZ2lzenlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyOTk2NTMsImV4cCI6MjA2ODg3NTY1M30.jx9PQcLnK8Asi3Ee2R629jKhGvP5gJcQfBW_BJmvgQE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh3bG11dWZxaXNjc2RlZ2lzenlyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI5OTY1MywiZXhwIjoyMDY4ODc1NjUzfQ.SQ0LNSsYnXWzs7naQTuH8e_SkLOl46XTi9uJqxreDRk
```

## Pokemon TCG API
```
POKEMON_TCG_API_KEY=d21064be-f874-428d-9f0b-d6780fb2b2bd
```

## Production Application Configuration
```
NEXT_PUBLIC_APP_URL=https://lumidex.app
NEXT_PUBLIC_APP_NAME=Lumidex - European Card Tracker
NODE_ENV=production
```

## Google OAuth
```
NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID=296510934037-6bk8662fu3sbfhfajc143s6knm5jk5n7.apps.googleusercontent.com
```

## Optional (can be empty for now)
```
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=
SENTRY_DSN=
```

---

## How to Add in Vercel:

1. In the Vercel import screen, click "Environment Variables"
2. For each variable above:
   - Name: Copy the variable name (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
   - Value: Copy the value after the `=` sign
   - Environment: Select "Production" (and optionally Preview/Development)
   - Click "Add"
3. Repeat for all variables
4. Click "Deploy" when done

**Important**: Make sure `NEXT_PUBLIC_APP_URL` is set to `https://lumidex.app` for production!