'use client'

import { useState } from 'react'
import { Profile } from '@/types'
import { CollectionStats } from '@/lib/collection-stats-service'
import { AchievementStats } from '@/lib/achievement-service'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { useI18n } from '@/contexts/I18nContext'
import { currencyService } from '@/lib/currency-service'
import { PriceDisplay } from '@/components/PriceDisplay'
import {
  Share2,
  Copy,
  Link,
  Twitter,
  Facebook,
  Download,
  QrCode,
  Eye,
  Lock,
  Globe,
  Check
} from 'lucide-react'

interface ProfileShareProps {
  profile: Profile
  collectionStats?: CollectionStats | null
  achievementStats?: AchievementStats | null
  isPublic?: boolean
  onTogglePublic?: (isPublic: boolean) => void
}

export function ProfileShare({
  profile,
  collectionStats,
  achievementStats,
  isPublic = false,
  onTogglePublic
}: ProfileShareProps) {
  const [copied, setCopied] = useState(false)
  const [shareMethod, setShareMethod] = useState<'link' | 'qr' | 'social'>('link')
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()

  const profileUrl = `${window.location.origin}/profile/${profile.username}`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleSocialShare = (platform: 'twitter' | 'facebook') => {
    const formattedValue = currencyService.formatCurrency(
      collectionStats?.totalValueEur || 0,
      preferredCurrency,
      locale
    )
    const text = `Check out my Pokemon card collection! I have ${collectionStats?.totalCards || 0} cards worth ${formattedValue}`
    
    const urls = {
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(profileUrl)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`
    }

    window.open(urls[platform], '_blank', 'width=600,height=400')
  }

  const generateQRCode = () => {
    // In a real implementation, you'd use a QR code library
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(profileUrl)}`
  }

  const handleDownloadQR = async () => {
    try {
      const qrUrl = generateQRCode()
      const response = await fetch(qrUrl)
      const blob = await response.blob()
      
      // Create a download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${profile.username || 'profile'}-qr-code.png`
      document.body.appendChild(link)
      link.click()
      
      // Clean up
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download QR code:', error)
    }
  }

  const formatCurrency = (value: number) => {
    return currencyService.formatCurrency(value, preferredCurrency, locale)
  }

  return (
    <div className="space-y-6">
      {/* Header with Icon */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-pokemon-gold/20 rounded-lg">
            <Share2 className="w-5 h-5 text-pokemon-gold" />
          </div>
          <h2 className="text-xl font-semibold text-white">Share Profile</h2>
        </div>
        
        {/* Privacy Toggle */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {isPublic ? (
              <Globe className="w-4 h-4 text-green-400" />
            ) : (
              <Lock className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-sm text-gray-400">
              {isPublic ? 'Public' : 'Private'}
            </span>
          </div>
          <button
            onClick={() => onTogglePublic?.(!isPublic)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              isPublic ? 'bg-pokemon-gold' : 'bg-gray-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isPublic ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {!isPublic && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2 text-yellow-400">
            <Eye className="w-4 h-4" />
            <span className="text-sm font-medium">Profile is Private</span>
          </div>
          <p className="text-yellow-300 text-sm mt-1">
            Enable public profile to share your collection with others.
          </p>
        </div>
      )}

      {/* Share Options Card */}
      <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Share Options</h3>
        
        {/* Share Method Selector */}
        <div className="flex space-x-1 mb-6 bg-pkmn-surface rounded-lg p-1">
          {[
            { key: 'link', label: 'Link', icon: Link },
            { key: 'qr', label: 'QR Code', icon: QrCode },
            { key: 'social', label: 'Social', icon: Share2 }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setShareMethod(key as any)}
              className={`flex-1 flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                shareMethod === key
                  ? 'bg-pokemon-gold text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </button>
          ))}
        </div>

        {/* Share Content */}
        {shareMethod === 'link' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Profile URL
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={profileUrl}
                  readOnly
                  className="flex-1 bg-pkmn-surface border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-transparent"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 border rounded-lg font-medium transition-colors flex items-center ${
                    copied
                      ? 'text-green-400 border-green-400 bg-green-400/10'
                      : 'text-gray-300 border-gray-600 hover:border-pokemon-gold hover:text-pokemon-gold'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Profile Preview */}
            <div className="bg-pkmn-surface/30 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Preview</h4>
              <div className="flex items-center space-x-3">
                <img
                  src={profile.avatar_url || '/default-avatar.png'}
                  alt={profile.display_name || profile.username}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gray-600"
                />
                <div className="flex-1">
                  <div className="text-white font-medium">
                    {profile.display_name || profile.username}
                  </div>
                  <div className="text-sm text-white">
                    @{profile.username}
                  </div>
                  {collectionStats && (
                    <div className="text-xs text-white">
                      {collectionStats.totalCards} cards • <PriceDisplay
                        amount={collectionStats.totalValueEur}
                        currency="EUR"
                        showConversion={true}
                        showOriginal={false}
                        size="sm"
                        className="inline text-white"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {shareMethod === 'qr' && (
          <div className="text-center space-y-4">
            <div className="bg-white rounded-lg p-4 inline-block">
              <img
                src={generateQRCode()}
                alt="Profile QR Code"
                className="w-48 h-48"
              />
            </div>
            <p className="text-gray-400 text-sm">
              Scan this QR code to view the profile
            </p>
            <button
              onClick={handleDownloadQR}
              className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:border-pokemon-gold hover:text-pokemon-gold transition-colors flex items-center mx-auto"
            >
              <Download className="w-4 h-4 mr-2" />
              Download QR Code
            </button>
          </div>
        )}

        {shareMethod === 'social' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleSocialShare('twitter')}
                className="flex items-center justify-center space-x-2 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isPublic}
              >
                <Twitter className="w-5 h-5" />
                <span>Share on Twitter</span>
              </button>
              
              <button
                onClick={() => handleSocialShare('facebook')}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!isPublic}
              >
                <Facebook className="w-5 h-5" />
                <span>Share on Facebook</span>
              </button>
            </div>

            {/* Share Preview Text */}
            <div className="bg-pkmn-surface/30 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">Share Message</h4>
              <p className="text-gray-300 text-sm">
                Check out my Pokemon card collection! I have {collectionStats?.totalCards || 0} cards worth{' '}
                <PriceDisplay
                  amount={collectionStats?.totalValueEur || 0}
                  currency="EUR"
                  showConversion={true}
                  showOriginal={false}
                  size="sm"
                  className="inline text-gray-300"
                />
                {achievementStats && achievementStats.unlockedAchievements > 0 && (
                  <> and {achievementStats.unlockedAchievements} achievements unlocked</>
                )}!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Collection Highlights Card */}
      {isPublic && collectionStats && (
        <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">Collection Highlights</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-pokemon-gold">
                {collectionStats.totalCards}
              </div>
              <div className="text-sm text-gray-400">Total Cards</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-500">
                <PriceDisplay
                  amount={collectionStats.totalValueEur}
                  currency="EUR"
                  showConversion={true}
                  showOriginal={false}
                  size="lg"
                  className="!text-yellow-500 text-yellow-500"
                />
              </div>
              <div className="text-sm text-gray-400">Collection Value</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {collectionStats.setsWithCards}
              </div>
              <div className="text-sm text-gray-400">Sets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                {achievementStats?.unlockedAchievements || 0}
              </div>
              <div className="text-sm text-gray-400">Achievements</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}