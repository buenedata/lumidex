# Featurebase Setup Guide

This document describes the steps required to enable **Featurebase** on the Lumidex website and Discord server.

---

## Website Integration

The feedback widget is already wired up in the codebase via [`components/FeaturebaseWidget.tsx`](components/FeaturebaseWidget.tsx), which is loaded globally in [`app/layout.tsx`](app/layout.tsx).

### What's included

- A floating feedback button rendered on the **right** side of every page
- Dark theme to match the Lumidex design
- Lazy-loaded with `strategy="afterInteractive"` — no impact on initial page load

### Configuring your organization name

In [`components/FeaturebaseWidget.tsx`](components/FeaturebaseWidget.tsx), update the `organization` field to match your Featurebase workspace subdomain:

```ts
win.Featurebase("initialize_feedback_widget", {
  organization: "lumidex", // ← must match https://lumidex.featurebase.app
  ...
});
```

If your workspace URL is `https://yourorg.featurebase.app`, set `organization: "yourorg"`.

### Optional configuration

Inside the `initialize_feedback_widget` call you can also set:

| Option | Description |
|--------|-------------|
| `email` | Pre-fill the user's email (e.g. pass the logged-in user's email) |
| `defaultBoard` | Pre-select a feedback board (e.g. `"bugs"` or `"features"`) |
| `placement` | `"right"` (default) or `"left"` — remove the key entirely to hide the floating button |
| `locale` | Language code (default `"en"`) — see [supported languages](https://help.featurebase.app/en/articles/8879098-using-featurebase-in-my-language) |
| `metadata` | Attach session-specific context to each submission |

---

## Discord Integration

Featurebase has a first-party Discord bot that posts new feedback, changelogs, and status updates directly to a channel of your choice.

### Step 1 — Create a Featurebase workspace

1. Go to [featurebase.app](https://featurebase.app) and sign in / create an account.
2. Create a new workspace. Use `lumidex` as the subdomain (or whichever name you chose).
3. Create at least one **board** (e.g. "Feature Requests", "Bug Reports").

### Step 2 — Add the Featurebase Discord bot

1. In your Featurebase dashboard, go to **Settings → Integrations → Discord**.
2. Click **"Connect Discord"**.
3. You will be redirected to Discord's OAuth flow — select the **Lumidex Discord server** and click **"Authorise"**.
4. The bot **Featurebase** will be added to your server automatically.

### Step 3 — Configure notification channels

After connecting, configure where Featurebase posts:

| Notification type | Recommended channel |
|-------------------|---------------------|
| New feedback posts | `#feedback` |
| Changelog / announcements | `#updates` or `#announcements` |
| Post status changes (under review, planned, etc.) | `#feedback` |

In the Discord integration settings within Featurebase, map each notification type to the appropriate channel by selecting it from the dropdown.

### Step 4 — Enable the `/feedback` slash command (optional)

Featurebase can expose a `/feedback` slash command so community members can submit feedback directly from Discord without visiting the website.

1. In **Settings → Integrations → Discord**, enable **"Slash Commands"**.
2. Select which board(s) the slash command should post to.
3. In your Discord server, go to **Server Settings → Integrations → Featurebase** and restrict the command to the channels/roles you want.

### Step 5 — Sync Discord roles with Featurebase (optional)

If you want to grant early access or voting rights based on Discord roles:

1. In **Settings → Integrations → Discord**, enable **"Role sync"**.
2. Map Discord roles to Featurebase user segments.

---

## Verifying everything works

1. Open the Lumidex website — a **feedback button** should appear on the right edge of the screen.
2. Click it and submit a test post.
3. The post should appear in your Featurebase dashboard and trigger a Discord notification in the configured channel.

---

## Resources

- [Featurebase widget docs](https://help.featurebase.app/en/help/articles/1261560-feedback-widget-installation)
- [Discord integration docs](https://help.featurebase.app/en/articles/discord-integration)
- [Supported widget languages](https://help.featurebase.app/en/articles/8879098-using-featurebase-in-my-language)
- [Advanced widget options (JWT auth, metadata)](https://help.featurebase.app/en/articles/3774671-advanced)
