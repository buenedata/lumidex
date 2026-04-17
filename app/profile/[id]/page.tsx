'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import { checkAndUnlockAchievements } from '@/lib/achievements'
import SetCard from '@/components/SetCard'
import AchievementBadge from '@/components/AchievementBadge'
import { Button } from '@/components/ui/Button'
import AvatarUpload from '@/components/profile/AvatarUpload'
import BannerUpload from '@/components/profile/BannerUpload'
import SettingsModal from '@/components/profile/SettingsModal'
import FirstTimeSetupModal from '@/components/profile/FirstTimeSetupModal'
import FriendButton from '@/components/profile/FriendButton'
import FriendsList from '@/components/profile/FriendsList'
import FriendRequests from '@/components/profile/FriendRequests'
import OutgoingRequests from '@/components/profile/OutgoingRequests'
import AddFriendModal from '@/components/profile/AddFriendModal'
import ProfileLists from '@/components/profile/ProfileLists'
import LastActivitySection from '@/components/profile/LastActivitySection'
import ProfileWantedCards from '@/components/profile/ProfileWantedCards'
import { type SettingsValues } from '@/components/profile/SettingsForm'
import { ProBadge } from '@/components/upgrade/ProBadge'
import { User, Achievement, PokemonSet, SetProgress } from '@/types'
import type { FriendEntry } from '@/components/profile/FriendsList'
import { cn } from '@/lib/utils'
import { fmtCardPrice } from '@/lib/currency'

// ── Types ──────────────────────────────────────────────────────────────────────

type ProfileUser = User

interface FriendshipRow {
  id: string
  status: string
  requester_id: string
  addressee_id: string
}

function userToSettings(u: ProfileUser): SettingsValues {
  return {
    display_name:              u.display_name              ?? '',
    bio:                       u.bio                       ?? '',
    location:                  u.location                  ?? '',
    preferred_language:        u.preferred_language        ?? 'en',
    preferred_currency:        u.preferred_currency        ?? 'USD',
    grey_out_unowned:          u.grey_out_unowned          ?? true,
    profile_private:           u.profile_private           ?? false,
    lists_public_by_default:   u.lists_public_by_default   ?? false,
    social_cardmarket:         u.social_cardmarket          ?? '',
    social_instagram:          u.social_instagram           ?? '',
    social_facebook:           u.social_facebook            ?? '',
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const params = useParams()
  const userId = params.id as string
  const { user: currentUser, profile, setProfile } = useAuthStore()
  const router = useRouter()

  const [profileUser, setProfileUser]         = useState<ProfileUser | null>(null)
  const [userSets, setUserSets]               = useState<string[]>([])
  const [profileSets, setProfileSets]         = useState<PokemonSet[]>([])
  const [setProgressMap, setSetProgressMap]   = useState<Record<string, SetProgress>>({})
  const [userAchievements, setUserAchievements] = useState<Achievement[]>([])
  const [stats, setStats] = useState({
    totalCards: 0,
    completedSets: 0,
    achievementCount: 0,
  })
  const [profileUserIsPro, setProfileUserIsPro] = useState(false)
  const [loading, setLoading] = useState(true)
  const [portfolioValue, setPortfolioValue] = useState<string | null>(null)

  // Local mutable URLs (may change after an upload without re-fetching the whole profile)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)

  // Friends state
  const [acceptedFriends, setAcceptedFriends]     = useState<FriendEntry[]>([])
  const [pendingIncoming, setPendingIncoming]     = useState<FriendEntry[]>([])
  const [pendingOutgoing, setPendingOutgoing]     = useState<FriendEntry[]>([])
  const [currentUserFriendship, setCurrentUserFriendship] = useState<FriendshipRow | null>(null)
  const [friendsLoading, setFriendsLoading]       = useState(false)

  // Modal state
  const [showSetupModal, setShowSetupModal]         = useState(false)
  const [showSettingsModal, setShowSettingsModal]   = useState(false)
  const [showAddFriendModal, setShowAddFriendModal] = useState(false)

  const isOwnProfile = currentUser?.id === userId

  // ── Load profile ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true)

      // Load user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (userData && !userError) {
        setProfileUser(userData)
        setAvatarUrl(userData.avatar_url ?? null)
        setBannerUrl(userData.banner_url ?? null)

        // Fetch subscription tier for this profile user (used to show Pro badge).
        // Queries the `user_tiers` view (user_id + tier only) which is readable by
        // any authenticated user — unlike user_subscriptions which is own-row-only.
        const { data: subData } = await supabase
          .from('user_tiers')
          .select('tier')
          .eq('user_id', userId)
          .maybeSingle()
        setProfileUserIsPro(subData?.tier === 'pro')

        // Show first-time setup if this is the owner and setup hasn't been done
        if (currentUser?.id === userId && !userData.setup_completed) {
          setShowSetupModal(true)
        }
      }

      // Load user sets — IDs first (for the "Sets Started" count)
      const { data: setsData } = await supabase
        .from('user_sets')
        .select('set_id')
        .eq('user_id', userId)

      const userSetIds = setsData?.map(s => s.set_id) ?? []
      if (userSetIds.length > 0) setUserSets(userSetIds)

      // Fetch full set objects + per-set card counts (single RPC call, shared below)
      type CardCountRow = { set_id: string; card_count: number }
      let setsInfo: PokemonSet[] | null = null
      let cardCounts: CardCountRow[] | null = null

      if (userSetIds.length > 0) {
        const [setsResult, rpcResult] = await Promise.all([
          supabase
            .from('sets')
            .select('id:set_id, name, series, total:setTotal, setComplete, release_date, logo_url, symbol_url, created_at')
            .in('set_id', userSetIds),
          supabase.rpc('get_user_card_counts_by_set', { p_user_id: userId }),
        ])

        setsInfo   = (setsResult.data ?? []) as PokemonSet[]
        cardCounts = (rpcResult.data ?? []) as CardCountRow[]

        setProfileSets(setsInfo)

        // Build the progress map
        const progress: Record<string, SetProgress> = {}
        setsInfo.forEach(set => {
          const owned = cardCounts?.find(r => r.set_id === set.id)?.card_count ?? 0
          const total = (set.setComplete ?? set.total ?? 0) as number
          progress[set.id] = {
            owned_cards: owned,
            total_cards: total,
            percentage: total > 0 ? Math.round((owned / total) * 100) : 0,
          }
        })
        setSetProgressMap(progress)
      }

      // Load user achievements
      const { data: achievementsData } = await supabase
        .from('user_achievements')
        .select(`
          achievement_id,
          unlocked_at,
          achievements (
            id,
            name,
            description,
            icon
          )
        `)
        .eq('user_id', userId)

      if (achievementsData) {
        const achievements = achievementsData
          .map(ua => ua.achievements)
          .filter(Boolean)
          .flat() as Achievement[]
        setUserAchievements(achievements)
      }

      // Count distinct (card, variant) pairs owned — each variant type is counted once
      // regardless of how many duplicate copies the user holds.
      // Uses PostgREST count=exact (HEAD request) which bypasses the 1 000-row cap.
      const { count: _variantCount } = await supabase
        .from('user_card_variants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gt('quantity', 0)
      const totalCards: number = _variantCount ?? 0

      // Fetch portfolio value — aggregate set-stats for every set the user has started.
      if ((setsInfo ?? []).length > 0) {
        Promise.all(
          (setsInfo ?? []).map(set =>
            fetch(`/api/prices/set-stats/${set.id}`)
              .then(r => (r.ok ? r.json() : null))
              .catch(() => null),
          ),
        ).then(results => {
          let total   = 0
          let hasData = false
          for (const data of results) {
            if (data?.setValue != null) { total += data.setValue; hasData = true }
          }
          if (hasData) {
            const cur = userData?.preferred_currency ?? 'USD'
            setPortfolioValue(fmtCardPrice({ eur: total, usd: null }, cur))
          }
        })
      }

      // completedSets — derived from the already-fetched setsInfo + cardCounts (no extra queries)
      const completedSets = (setsInfo ?? []).filter(set => {
        const owned = cardCounts?.find(r => r.set_id === set.id)?.card_count ?? 0
        const total = (set.setComplete ?? set.total ?? 0) as number
        return total > 0 && owned >= total
      }).length

      setStats({
        totalCards,
        completedSets,
        achievementCount: achievementsData?.length || 0,
      })

      // ── Retroactive achievement unlock (own profile only) ─────────────────
      // checkAndUnlockAchievements is normally called when cards are added,
      // but won't have fired for cards added before the system was introduced.
      // Running it on every own-profile load is cheap and ensures correctness.
      if (currentUser?.id === userId) {
        try {
          const newlyUnlocked = await checkAndUnlockAchievements(userId)
          if (newlyUnlocked.length > 0) {
            // Re-fetch the full achievements list so the UI includes the new ones
            const { data: refreshed } = await supabase
              .from('user_achievements')
              .select(`
                achievement_id,
                unlocked_at,
                achievements (
                  id,
                  name,
                  description,
                  icon
                )
              `)
              .eq('user_id', userId)

            if (refreshed) {
              const refreshedList = refreshed
                .map(ua => ua.achievements)
                .filter(Boolean)
                .flat() as Achievement[]
              setUserAchievements(refreshedList)
              setStats(prev => ({ ...prev, achievementCount: refreshed.length }))
            }
          }
        } catch (err) {
          console.warn('[profile] achievement check failed:', err)
        }
      }

      setLoading(false)
    }

    if (userId) loadProfile()
  }, [userId, currentUser?.id])

  // ── Load friends data ─────────────────────────────────────────────────────────
  // Extracted to useCallback so FriendRequests can call it directly after an
  // accept, which causes an immediate re-fetch rather than needing a full
  // page reload (router.refresh() does not re-trigger useEffect on client pages).
  const loadFriends = useCallback(async () => {
    if (!userId) return
    setFriendsLoading(true)
    try {
      if (isOwnProfile) {
        // Own profile: full friend list + incoming pending requests
        const res = await fetch('/api/friendships')
        if (res.ok) {
          const data = await res.json()
          setAcceptedFriends(data.accepted ?? [])
          setPendingIncoming(data.pending_incoming ?? [])
          setPendingOutgoing(data.pending_outgoing ?? [])
        }
      } else {
        // Another user's profile: run both fetches in parallel
        const [publicFriendsRes, friendshipStatusRes] = await Promise.all([
          // The profile user's public friends list
          fetch(`/api/friendships/public/${userId}`),
          // Current viewer's specific friendship with this user (login required)
          currentUser
            ? fetch(`/api/friendships?user_id=${userId}`)
            : Promise.resolve(null),
        ])

        if (publicFriendsRes.ok) {
          const data = await publicFriendsRes.json()
          setAcceptedFriends(data.friends ?? [])
        }

        if (friendshipStatusRes?.ok) {
          const data = await friendshipStatusRes.json()
          if (data.friendship) setCurrentUserFriendship(data.friendship)
        }
      }
    } catch (err) {
      console.error('loadFriends error:', err)
    } finally {
      setFriendsLoading(false)
    }
  // currentUser?.id instead of currentUser to avoid re-creating on unrelated user-object changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isOwnProfile, currentUser?.id])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  // ── Setup wizard complete ─────────────────────────────────────────────────────
  function handleSetupComplete(
    savedValues: SettingsValues,
    newAvatarUrl: string | null,
    newBannerUrl: string | null
  ) {
    setShowSetupModal(false)
    if (newAvatarUrl) setAvatarUrl(newAvatarUrl)
    if (newBannerUrl) setBannerUrl(newBannerUrl)
    setProfileUser(prev =>
      prev
        ? {
            ...prev,
            ...savedValues,
            avatar_url: newAvatarUrl ?? prev.avatar_url,
            banner_url: newBannerUrl ?? prev.banner_url,
            setup_completed: true,
          }
        : prev
    )
  }

  // ── Settings modal saved ──────────────────────────────────────────────────────
  function handleSettingsSaved(savedValues: SettingsValues) {
    setProfileUser(prev => (prev ? { ...prev, ...savedValues } : prev))
  }

  // ── Loading State ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-base">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <div className="bg-surface border border-subtle rounded-2xl overflow-hidden mb-6">
            <div className="skeleton h-40 w-full" />
            <div className="p-6 flex flex-col md:flex-row items-center md:items-end gap-4 -mt-10">
              <div className="skeleton w-24 h-24 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="skeleton h-7 w-48 rounded-lg" />
                <div className="skeleton h-4 w-32 rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-surface border border-subtle rounded-xl p-4">
                <div className="skeleton h-3 w-20 rounded mb-2" />
                <div className="skeleton h-7 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Not Found State ───────────────────────────────────────────────────────────
  if (!profileUser) {
    return (
      <div className="min-h-screen bg-base">
        <div className="max-w-screen-2xl mx-auto px-6 py-8">
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent-dim flex items-center justify-center text-3xl">
              👤
            </div>
            <h1
              className="text-2xl font-bold text-primary"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              User not found
            </h1>
            <p className="text-secondary text-sm">
              This profile doesn&apos;t exist or has been removed.
            </p>
            <Button variant="secondary" onClick={() => router.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Derived display values ────────────────────────────────────────────────────
  const displayName = profileUser.display_name || profileUser.username
  const initials    = profileUser.username.slice(0, 2).toUpperCase()
  const joinDate    = profileUser.created_at
    ? new Date(profileUser.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year:  'numeric',
      })
    : null
  const isPrivate = !isOwnProfile && (profileUser.profile_private ?? false)

  // Sort sets: highest completion % first, then newest release date
  const displaySets = (isPrivate ? [] : profileSets)
    .slice()
    .sort((a, b) => {
      const pA = setProgressMap[a.id]?.percentage ?? 0
      const pB = setProgressMap[b.id]?.percentage ?? 0
      if (pB !== pA) return pB - pA
      const dA = a.release_date ? new Date(a.release_date).getTime() : 0
      const dB = b.release_date ? new Date(b.release_date).getTime() : 0
      return dB - dA
    })

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-screen-2xl mx-auto px-6 py-8">

        {/* ── Hero Card ─────────────────────────────────────────────────────── */}
        <div className="relative bg-surface border border-subtle rounded-2xl overflow-hidden mb-6">

          {/* Banner */}
          <BannerUpload
            currentUrl={bannerUrl}
            onUploaded={url => setBannerUrl(url)}
            editable={isOwnProfile}
            variant="hero"
          />

          {/* Gear / settings button (own profile only) */}
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className={cn(
                'absolute top-3 right-3 z-10',
                'w-8 h-8 rounded-lg flex items-center justify-center',
                'bg-black/40 hover:bg-black/60 backdrop-blur-sm',
                'text-white/80 hover:text-white transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50'
              )}
              aria-label="Open profile settings"
              title="Profile Settings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          )}

          {/* Avatar + user info */}
          <div className="relative z-10 px-6 pb-6 -mt-10 md:-mt-12 flex flex-col md:flex-row items-center md:items-end gap-4">
            <AvatarUpload
              currentUrl={avatarUrl}
              initials={initials}
              onUploaded={url => {
                setAvatarUrl(url)
                if (isOwnProfile && profile) {
                  setProfile({ ...profile, avatar_url: url })
                }
              }}
              editable={isOwnProfile}
              size="lg"
              className="ring-4 ring-surface rounded-full"
            />

            <div className="flex-1 text-center md:text-left pb-1">
              <div className="flex items-center gap-2 justify-center md:justify-start flex-wrap">
                <h1
                  className="text-2xl md:text-3xl font-bold text-primary leading-tight"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {displayName}
                </h1>
                {profileUserIsPro
                  ? <ProBadge size="sm" />
                  : isOwnProfile && (
                      <span className="pill px-2 py-0.5 rounded-full text-xs font-medium bg-accent-dim text-accent border border-[rgba(109,95,255,0.3)]">
                        You
                      </span>
                    )
                }
              </div>

              {/* @username handle */}
              <p className="text-muted text-sm mt-0.5">
                @{profileUser.username}
              </p>

              {/* Bio */}
              {!isPrivate && profileUser.bio && (
                <p className="text-secondary text-sm mt-2 max-w-xl leading-relaxed">
                  {profileUser.bio}
                </p>
              )}

              {/* Location + join date */}
              <div className="flex items-center gap-3 mt-2 justify-center md:justify-start flex-wrap">
                {!isPrivate && profileUser.location && (
                  <span className="text-muted text-xs flex items-center gap-1">
                    <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {profileUser.location}
                  </span>
                )}
                {!isPrivate && profileUser.location && joinDate && (
                  <span className="text-subtle text-xs">·</span>
                )}
                {joinDate && (
                  <span className="text-muted text-xs">Member since {joinDate}</span>
                )}
              </div>
            </div>

            {/* Social / marketplace icons — right side of hero */}
            {!isPrivate && (
              () => {
                const cm = profileUser.social_cardmarket?.trim() ?? ''
                const ig = profileUser.social_instagram?.trim() ?? ''
                const fb = profileUser.social_facebook?.trim() ?? ''
                const igHref = ig
                  ? ig.startsWith('http')
                    ? ig
                    : `https://instagram.com/${ig.replace(/^@/, '')}`
                  : ''
                const hasSocial = !!(cm || ig || fb)
                if (!hasSocial) return null
                return (
                  <div className="shrink-0 pb-1 flex flex-col items-center md:items-end gap-2">
                    <p className="text-[10px] text-muted uppercase tracking-wider hidden md:block">Socials</p>
                    <div className="flex items-center gap-2">
                      {cm && (
                        <a
                          href={cm}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Cardmarket Profile"
                          className="w-8 h-8 rounded-lg bg-surface border border-subtle flex items-center justify-center text-muted hover:text-accent hover:border-accent/40 transition-colors"
                        >
                          {/* Simple shopping-cart icon standing in for Cardmarket */}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </a>
                      )}
                      {igHref && (
                        <a
                          href={igHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Instagram"
                          className="w-8 h-8 rounded-lg bg-surface border border-subtle flex items-center justify-center text-muted hover:text-[#E1306C] hover:border-[#E1306C]/40 transition-colors"
                        >
                          {/* Camera icon */}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </a>
                      )}
                      {fb && (
                        <a
                          href={fb.startsWith('http') ? fb : `https://facebook.com/${fb}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Facebook"
                          className="w-8 h-8 rounded-lg bg-surface border border-subtle flex items-center justify-center text-muted hover:text-[#1877F2] hover:border-[#1877F2]/40 transition-colors"
                        >
                          {/* Person icon */}
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                )
              }
            )()}

            {/* Friend button — only shown when viewing another user's profile */}
            {!isOwnProfile && currentUser && !friendsLoading && (
              <div className="pb-1 shrink-0">
                <FriendButton
                  key={currentUserFriendship?.id ?? 'no-friendship'}
                  targetUserId={userId}
                  currentUserId={currentUser.id}
                  initialFriendship={currentUserFriendship}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Private profile notice ─────────────────────────────────────────── */}
        {isPrivate && (
          <div className="bg-surface border border-subtle rounded-xl p-8 mb-6 flex flex-col items-center gap-3 text-center">
            <div className="text-3xl">🔒</div>
            <p className="text-secondary text-sm">
              This profile is private.
            </p>
          </div>
        )}

        {!isPrivate && (
          <>
            {/* ── Stats Row ────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Cards Collected</span>
                <span className="text-2xl font-bold text-primary">
                  {stats.totalCards.toLocaleString()}
                </span>
              </div>
              <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Sets Started</span>
                <span className="text-2xl font-bold text-primary">{userSets.length}</span>
              </div>
              <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Portfolio Value</span>
                <span className="text-2xl font-bold text-price">
                  {portfolioValue ?? '—'}
                </span>
              </div>
              <div className="bg-surface border border-subtle rounded-xl p-4 flex flex-col gap-1">
                <span className="text-xs text-muted uppercase tracking-wider">Friends</span>
                <span className="text-2xl font-bold text-primary">
                  {friendsLoading ? '—' : acceptedFriends.length}
                </span>
              </div>
            </div>

            {/* ── Last Activity ─────────────────────────────────────────────────── */}
            <LastActivitySection userId={userId} isOwnProfile={isOwnProfile} />

            {/* ── Friend Requests — incoming (own profile only) ─────────────────── */}
            {isOwnProfile && pendingIncoming.length > 0 && (
              <FriendRequests
                initialRequests={pendingIncoming}
                onFriendAccepted={loadFriends}
              />
            )}

            {/* ── Outgoing Requests (own profile only) ──────────────────────────── */}
            {isOwnProfile && pendingOutgoing.length > 0 && (
              <OutgoingRequests initialRequests={pendingOutgoing} />
            )}

            {/* ── Achievements Section ──────────────────────────────────────────── */}
            <section className="mb-8">
              <h2
                className="text-xl font-bold text-primary mb-4"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                Achievements
              </h2>

              {userAchievements.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {userAchievements.map(achievement => (
                    <AchievementBadge
                      key={achievement.id}
                      achievement={achievement}
                      unlocked={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-surface border border-subtle rounded-xl p-8 flex flex-col items-center gap-3 text-center">
                  <div className="text-3xl">🏆</div>
                  <p className="text-secondary text-sm">
                    {isOwnProfile
                      ? "You haven't unlocked any achievements yet"
                      : 'No achievements unlocked yet'}
                  </p>
                  {isOwnProfile && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push('/collection')}
                    >
                      View Collection
                    </Button>
                  )}
                </div>
              )}
            </section>

            {/* ── Wanted Cards Section ─────────────────────────────────────────── */}
            <ProfileWantedCards
              userId={userId}
              isOwnProfile={isOwnProfile}
              displayName={displayName}
            />

            {/* ── Lists Section ────────────────────────────────────────────────── */}
            <ProfileLists
              userId={userId}
              isOwnProfile={isOwnProfile}
              displayName={displayName}
            />

            {/* ── Friends Section ───────────────────────────────────────────────── */}
            <section className="mb-8">
              <h2
                className="text-xl font-bold text-primary mb-4"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {isOwnProfile ? 'Friends' : `${displayName}'s Friends`}
              </h2>

              {friendsLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-surface border border-subtle rounded-xl p-3 flex flex-col items-center gap-2">
                      <div className="skeleton w-12 h-12 rounded-full" />
                      <div className="skeleton h-3 w-16 rounded" />
                    </div>
                  ))}
                </div>
              ) : (
                <FriendsList
                  friends={acceptedFriends}
                  isOwnProfile={isOwnProfile}
                  onFindFriends={() => setShowAddFriendModal(true)}
                />
              )}
            </section>

            {/* ── Collection / Sets Section ──────────────────────────────────────── */}
            <section>
              <h2
                className="text-xl font-bold text-primary mb-4"
                style={{ fontFamily: 'var(--font-space-grotesk)' }}
              >
                {isOwnProfile ? 'Your Sets' : `${displayName}'s Sets`}
              </h2>

              {displaySets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {displaySets.map(set => (
                    <SetCard
                      key={set.id}
                      set={set}
                      progress={setProgressMap[set.id]}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-surface border border-subtle rounded-xl p-12 flex flex-col items-center gap-4 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-accent-dim flex items-center justify-center text-2xl">
                    📦
                  </div>
                  <div>
                    <h3
                      className="text-lg font-semibold text-primary mb-1"
                      style={{ fontFamily: 'var(--font-space-grotesk)' }}
                    >
                      {isOwnProfile ? 'No collection yet' : 'No sets started yet'}
                    </h3>
                    <p className="text-secondary text-sm">
                      {isOwnProfile
                        ? 'Start by browsing sets and tracking your cards'
                        : `${displayName} hasn't added any sets yet`}
                    </p>
                  </div>
                  {isOwnProfile && (
                    <div className="flex gap-3">
                      <Button variant="primary" onClick={() => router.push('/sets')}>
                        Browse Sets
                      </Button>
                      <Button variant="secondary" onClick={() => router.push('/dashboard')}>
                        View Dashboard
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── First-Time Setup Modal ─────────────────────────────────────────────── */}
      {showSetupModal && (
        <FirstTimeSetupModal
          userId={userId}
          username={profileUser.username}
          currentAvatarUrl={avatarUrl}
          currentBannerUrl={bannerUrl}
          onComplete={handleSetupComplete}
        />
      )}

      {/* ── Settings Modal ─────────────────────────────────────────────────────── */}
      {isOwnProfile && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          userId={userId}
          username={profileUser.username}
          initialValues={userToSettings(profileUser)}
          onSaved={handleSettingsSaved}
          onCollectionReset={() => {
            // Reload the page so stats + last activity reflect the cleared collection
            window.location.reload()
          }}
        />
      )}

      {/* ── Add Friend Modal ────────────────────────────────────────────────────── */}
      {isOwnProfile && currentUser && (
        <AddFriendModal
          isOpen={showAddFriendModal}
          onClose={() => setShowAddFriendModal(false)}
          currentUserId={currentUser.id}
        />
      )}
    </div>
  )
}
