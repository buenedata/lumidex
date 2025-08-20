# Multi-User Testing Guide

This guide provides solutions for testing features that require multiple users to be logged in simultaneously.

## The Problem

When you log into your main account on desktop and then log into a second account on laptop, your desktop session gets logged out. This happens because:

1. Supabase sessions are stored in browser localStorage
2. The authentication system may have session conflicts
3. Browser storage is shared across tabs in the same profile

## Solutions

### Solution 1: Browser Profile Isolation (Recommended)

Use different browser profiles to completely isolate sessions:

#### Chrome/Edge:
1. **Desktop (User 1)**: Use your normal browser profile
2. **Laptop (User 2)**: Create a new browser profile
   - Click your profile icon → "Add" → "Create new profile"
   - Or use incognito mode: `Ctrl+Shift+N` (Windows) / `Cmd+Shift+N` (Mac)

#### Firefox:
1. **Desktop (User 1)**: Use your normal browser profile
2. **Laptop (User 2)**: Use private browsing
   - `Ctrl+Shift+P` (Windows) / `Cmd+Shift+P` (Mac)

### Solution 2: Different Browsers

Use completely different browsers:
- **Desktop**: Chrome with User 1
- **Laptop**: Firefox with User 2

### Solution 3: Browser Containers (Firefox Only)

If using Firefox, use container tabs:
1. Install "Firefox Multi-Account Containers" extension
2. Create separate containers for each test user
3. Open your app in different container tabs

### Solution 4: Local Storage Isolation Script

Create a development utility to manage multiple sessions:

```javascript
// Add to browser console to switch between test users
function switchTestUser(userNumber) {
  const testUsers = {
    1: { email: 'test1@example.com', session: 'stored_session_1' },
    2: { email: 'test2@example.com', session: 'stored_session_2' }
  };
  
  // Clear current session
  localStorage.clear();
  sessionStorage.clear();
  
  // Load test user session
  if (testUsers[userNumber]) {
    localStorage.setItem('supabase.auth.token', testUsers[userNumber].session);
    location.reload();
  }
}
```

## Test User Accounts Setup

### Create Test Accounts

1. **Test User 1**: `testuser1@yourdomain.com`
2. **Test User 2**: `testuser2@yourdomain.com`
3. **Test User 3**: `testuser3@yourdomain.com` (optional)

### Quick Setup Script

Run this in your browser console after creating accounts:

```javascript
// Store test user credentials for quick switching
const testUsers = {
  user1: { email: 'testuser1@yourdomain.com', password: 'testpass123' },
  user2: { email: 'testuser2@yourdomain.com', password: 'testpass123' },
  user3: { email: 'testuser3@yourdomain.com', password: 'testpass123' }
};

localStorage.setItem('testUsers', JSON.stringify(testUsers));
```

## Recommended Testing Workflow

### For Friends/Social Features:
1. **Desktop (Chrome)**: Login as User 1
2. **Laptop (Firefox/Incognito)**: Login as User 2
3. Test friend requests, messaging, etc.

### For Trading Features:
1. **Desktop (Normal Profile)**: Login as User 1 (trader)
2. **Laptop (Incognito/New Profile)**: Login as User 2 (tradee)
3. Test trade creation, acceptance, etc.

### For Collection Comparison:
1. **Desktop**: User 1 with established collection
2. **Laptop**: User 2 with different collection
3. Test comparison features

## Development Environment Setup

### Environment Variables for Testing

Add to your `.env.local`:

```env
# Test mode flags
NEXT_PUBLIC_ENABLE_TEST_MODE=true
NEXT_PUBLIC_TEST_USERS_ENABLED=true
```

### Test User Quick Login Component

Create a development-only component for quick user switching:

```tsx
// components/dev/TestUserSwitcher.tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'

const TEST_USERS = [
  { email: 'testuser1@yourdomain.com', password: 'testpass123', name: 'Test User 1' },
  { email: 'testuser2@yourdomain.com', password: 'testpass123', name: 'Test User 2' },
  { email: 'testuser3@yourdomain.com', password: 'testpass123', name: 'Test User 3' }
]

export default function TestUserSwitcher() {
  const { signIn, signOut } = useAuth()

  if (process.env.NODE_ENV !== 'development') return null

  const handleQuickLogin = async (user: typeof TEST_USERS[0]) => {
    await signOut()
    await signIn(user.email, user.password)
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 p-4 rounded-lg shadow-lg border-2 border-yellow-400">
      <h3 className="font-bold text-sm mb-2">🧪 Test Users</h3>
      <div className="space-y-2">
        {TEST_USERS.map((user, index) => (
          <button
            key={index}
            onClick={() => handleQuickLogin(user)}
            className="block w-full text-left px-2 py-1 bg-white rounded text-xs hover:bg-gray-50"
          >
            {user.name}
          </button>
        ))}
        <button
          onClick={signOut}
          className="block w-full text-left px-2 py-1 bg-red-100 rounded text-xs hover:bg-red-200"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
```

## Troubleshooting

### Session Still Conflicts?

1. **Clear all browser data** for your app domain
2. **Check Supabase dashboard** for active sessions
3. **Use different devices** if browser isolation doesn't work
4. **Check network/IP restrictions** in Supabase settings

### Supabase Session Management

If you need to allow multiple concurrent sessions per user, you can modify the Supabase client configuration:

```typescript
// lib/supabase-multi-session.ts
import { createClient } from '@supabase/supabase-js'

export const createMultiSessionClient = (sessionKey: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storageKey: `supabase.auth.${sessionKey}`, // Unique storage key
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
}
```

## Quick Reference

| Method | Isolation Level | Setup Difficulty | Reliability |
|--------|----------------|------------------|-------------|
| Browser Profiles | Complete | Easy | High |
| Different Browsers | Complete | Easy | High |
| Incognito Mode | Complete | Very Easy | High |
| Container Tabs | Good | Medium | Medium |
| Local Storage Script | Partial | Hard | Low |

**Recommended**: Use browser profiles or incognito mode for the most reliable multi-user testing experience.