'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { supabase } from '@/lib/supabase'
import SetCard from '@/components/SetCard'
import AchievementBadge from '@/components/AchievementBadge'
import { Button } from '@/components/ui/Button'
import AvatarUpload from '@/components/profile/AvatarUpload'
import BannerUpload from '@/components/profile/BannerUpload'
import SettingsModal from '@/components/profile/SettingsModal'
import FirstTimeSetupModal from '@/components/profile/FirstTimeSetupModal'
import { defaultSettings, type SettingsValues } from '@/components/profile/SettingsForm'
import { User, Achievement, PokemonSet, SetProgress } from '@/types'
import { cn } from '@/lib/utils'

// ProfileUser uses the full User type (which now includes all new fields)
type ProfileUser = User

function userToSettings(u: ProfileUser): SettingsValues {
  return {
    display_name:         u.display_name        ?? '',
    bio:                  u.bio                 ?? '',
    location:             u.location            ?? '',
    preferred_language:   u.preferred_language  ?? 'en',
    preferred_currency:   u.preferred_currency  ?? 'USD',
    price_source:         u.price_source        ?? 'tcgplayer',
    grey_out_unowned:     u.grey_out_unowned     ?? true,
    profile_private:      u.profile_private      ?? false,
    show_portfolio_value: u.show_portfolio_value ?? 'public',
  }
}

export default function ProfilePage() {
  const params = useParams()
  const userId = params.id as string
  const { user: currentUser, profile, setProfile } = useAuthStore()
  const router = useRouter()

  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null)
  const [userSets, setUserSets] = useState<string[]>([])
  const [profileSets, setProfileSets] = useState<PokemonSet[]>([])
  const [setProgressMap, setSetProgressMap] = useState<Record<string, SetProgress>>({})
  const [userAchievements, setUserAchievements] = useState<Achievement[]>([])
  const [stats, setStats] = useState({
    totalCards: 0,
    completedSets: 0,
    achievementCount: 0,
  })
  const [loading, setLoading] = useState(true)

  // Local mutable URLs (may change after an upload without re-fetching the whole profile)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)

  // Modal state
  const [showSetupModal, setShowSetupModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  const isOwnProfile = currentUser?.id === userId

  // ── Load profile ──────────────────────────────────────────────
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

        setsInfo = (setsResult.data ?? []) as PokemonSet[]
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

      // Calculate stats — sum quantities from user_card_variants (the source of truth)
      const { data: cardsData } = await supabase
        .from('user_card_variants')
        .select('quantity')
        .eq('user_id', userId)

      const totalCards = cardsData?.reduce((sum, row) => sum + (row.quantity ?? 0), 0) || 0

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

      setLoading(false)
    }

    if (userId) loadProfile()
  }, [userId, currentUser?.id])

  // ── Setup wizard complete ─────────────────────────────────────
  function handleSetupComplete(
    savedValues: SettingsValues,
    newAvatarUrl: string | null,
    newBannerUrl: string | null
  ) {
    setShowSetupModal(false)
    if (newAvatarUrl) setAvatarUrl(newAvatarUrl)
    if (newBannerUrl) setBannerUrl(newBannerUrl)
    // Patch local profileUser state so the page reflects changes immediately
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

  // ── Settings modal saved ──────────────────────────────────────
  function handleSettingsSaved(savedValues: SettingsValues) {
    setProfileUser(prev => (prev ? { ...prev, ...savedValues } : prev))
  }

  // ── Loading State ─────────────────────────────────────────────
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
          <div className="grid grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
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

  // ── Not Found State ───────────────────────────────────────────
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

  // ── Derived display values ────────────────────────────────────
  const displayName   = profileUser.display_name || profileUser.username
  const initials      = profileUser.username.slice(0, 2).toUpperCase()
  const joinDate      = profileUser.created_at
    ? new Date(profileUser.created_at).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null
  const isPrivate     = !isOwnProfile && (profileUser.profile_private ?? false)
  const displaySets = isPrivate ? [] : profileSets

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base">
      <div className="max-w-screen-2xl mx-auto px-6 py-8">

        {/* ── Hero Card ─────────────────────────────────────────── */}
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

          {/* Avatar + user info — overlapping the banner */}
          <div className="relative z-10 px-6 pb-6 -mt-10 md:-mt-12 flex flex-col md:flex-row items-center md:items-end gap-4">
            <AvatarUpload
              currentUrl={avatarUrl}
              initials={initials}
              onUploaded={url => {
                setAvatarUrl(url)
                // Keep the navbar avatar in sync without a full page reload
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
                {isOwnProfile && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-dim text-accent border border-[rgba(109,95,255,0.3)]">
                    You
                  </span>
                )}
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
          </div>
        </div>

        {/* ── Private profile notice ────────────────────────────── */}
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
            {/* ── Stats Row ───────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-4 mb-8">
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
                <span className="text-xs text-muted uppercase tracking-wider">Achievements</span>
                <span className="text-2xl font-bold text-accent">{stats.achievementCount}</span>
              </div>
            </div>

            {/* ── Achievements Section ─────────────────────────────── */}
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

            {/* ── Collection / Sets Section ────────────────────────── */}
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

      {/* ── First-Time Setup Modal ──────────────────────────────── */}
      {showSetupModal && (
        <FirstTimeSetupModal
          userId={userId}
          username={profileUser.username}
          currentAvatarUrl={avatarUrl}
          currentBannerUrl={bannerUrl}
          onComplete={handleSetupComplete}
        />
      )}

      {/* ── Settings Modal ──────────────────────────────────────── */}
      {isOwnProfile && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          userId={userId}
          initialValues={userToSettings(profileUser)}
          onSaved={handleSettingsSaved}
        />
      )}
    </div>
  )
}
