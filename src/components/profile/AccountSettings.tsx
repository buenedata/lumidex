'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useI18n } from '@/contexts/I18nContext'
import { useUserPreferences } from '@/contexts/UserPreferencesContext'
import { useConfirmation } from '@/contexts/ConfirmationContext'
import { useToast } from '@/components/ui/ToastContainer'
import { profileService, ProfileData } from '@/lib/profile-service'
import { userPreferencesService, PriceSource } from '@/lib/user-preferences-service'
import { useCollectionOperations } from '@/hooks/useServices'
import { Locale } from '@/lib/i18n'
import { SupportedCurrency } from '@/lib/currency-service'
import {
  User,
  Mail,
  Calendar,
  Shield,
  Lock,
  Trash2,
  Edit3,
  Save,
  Eye,
  Bell,
  X,
  Globe,
  DollarSign,
  RefreshCw
} from 'lucide-react'

interface AccountSettingsProps {
  profileData: ProfileData
  isOpen: boolean
  onClose: () => void
  onProfileUpdate: () => void
}

export function AccountSettings({ profileData, isOpen, onClose, onProfileUpdate }: AccountSettingsProps) {
  const { user } = useAuth()
  const { setLocale } = useI18n()
  const { preferences, loading: preferencesLoading, updateLanguage, updateCurrency, updatePriceSource } = useUserPreferences()
  const { confirm } = useConfirmation()
  const { showSuccess, showError } = useToast()
  const { clearCollection } = useCollectionOperations()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clearingCollection, setClearingCollection] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editFormData, setEditFormData] = useState({
    displayName: profileData.profile.display_name || profileData.profile.username,
    bio: profileData.profile.bio || '',
    location: profileData.profile.location || ''
  })

  const handleLanguageChange = async (language: Locale) => {
    try {
      await updateLanguage(language)
      setLocale(language) // Update the I18n context immediately
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update language preference')
    }
  }

  const handleCurrencyChange = async (currency: SupportedCurrency) => {
    try {
      await updateCurrency(currency)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update currency preference')
    }
  }

  const handlePriceSourceChange = async (priceSource: PriceSource) => {
    try {
      await updatePriceSource(priceSource)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update price source preference')
    }
  }

  const handleSave = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const updateResult = await profileService.updateProfile(user.id, {
        display_name: editFormData.displayName,
        bio: editFormData.bio,
        location: editFormData.location
      })

      if (updateResult.success) {
        setIsEditing(false)
        onProfileUpdate() // Reload profile data
      } else {
        setError(updateResult.error || 'Failed to update profile')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleClearCollection = async () => {
    if (!user) return

    // First confirmation
    const firstConfirm = await confirm({
      title: '⚠️ WARNING: Clear Collection',
      message: 'This will permanently delete ALL cards from your collection!\n\nThis action cannot be undone. Are you sure you want to continue?',
      type: 'danger',
      confirmText: 'Continue'
    })

    if (!firstConfirm) return

    // Second confirmation
    const secondConfirm = await confirm({
      title: '🚨 FINAL WARNING',
      message: 'You are about to delete your ENTIRE collection!\n\nThis includes:\n• All cards in your collection\n• All wishlist items\n• All collection statistics\n\nThis action cannot be undone.',
      type: 'danger',
      confirmText: 'Yes, Delete Everything'
    })

    if (!secondConfirm) return

    // Type confirmation using prompt (we'll keep this for now as it requires text input)
    const typeConfirm = window.prompt(
      'Type "DELETE" (in capital letters) to confirm you want to delete your entire collection:'
    )

    if (typeConfirm !== 'DELETE') {
      showError('Collection Clearing Cancelled', 'Confirmation text did not match.')
      return
    }

    setClearingCollection(true)
    setError(null)

    try {
      const result = await clearCollection(user.id)

      if (result.success) {
        showSuccess(
          'Collection Cleared Successfully!',
          `Deleted ${result.data || 0} collection entries. You can now start fresh with only the correct available variants.`
        )
        onProfileUpdate() // Reload profile data
      } else {
        setError(result.error || 'Failed to clear collection')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while clearing collection')
    } finally {
      setClearingCollection(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-pkmn-card rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-pokemon-gold/20 rounded-lg">
              <User className="w-5 h-5 text-pokemon-gold" />
            </div>
            <h2 className="text-xl font-semibold text-white">Account & Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Account Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <User className="w-4 h-4 mr-2 text-pokemon-gold" />
              Account Information
            </h3>
            
            <div className="bg-pkmn-surface/30 rounded-lg p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-white">{user?.email}</span>
                  <span className="px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full">Verified</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Member Since</label>
                <div className="flex items-center space-x-3">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-white">{new Date(profileData.profile.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Username</label>
                <div className="flex items-center space-x-3">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-white">@{profileData.profile.username}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Profile Settings Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center">
                <Edit3 className="w-4 h-4 mr-2 text-pokemon-gold" />
                Profile Settings
              </h3>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-pokemon-gold text-black rounded-lg hover:bg-pokemon-gold/90 transition-colors flex items-center"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit Profile
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="bg-pkmn-surface/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-md font-semibold text-white">Edit Profile Information</h4>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:border-gray-500 hover:text-white transition-colors"
                      disabled={loading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-pokemon-gold text-black rounded-lg hover:bg-pokemon-gold/90 transition-colors flex items-center"
                      disabled={loading}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={editFormData.displayName}
                        onChange={(e) => setEditFormData({...editFormData, displayName: e.target.value})}
                        className="w-full bg-pkmn-surface border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-transparent"
                        placeholder="Your display name"
                        disabled={loading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Location
                      </label>
                      <input
                        type="text"
                        value={editFormData.location}
                        onChange={(e) => setEditFormData({...editFormData, location: e.target.value})}
                        className="w-full bg-pkmn-surface border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-transparent"
                        placeholder="Your location"
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Bio
                      </label>
                      <textarea
                        value={editFormData.bio}
                        onChange={(e) => setEditFormData({...editFormData, bio: e.target.value})}
                        className="w-full bg-pkmn-surface border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-transparent h-24 resize-none"
                        placeholder="Tell us about yourself and your collection..."
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-pkmn-surface/30 rounded-lg p-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Display Name</label>
                  <p className="text-white">{profileData.profile.display_name || profileData.profile.username}</p>
                </div>
                {profileData.profile.location && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Location</label>
                    <p className="text-white">{profileData.profile.location}</p>
                  </div>
                )}
                {profileData.profile.bio && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Bio</label>
                    <p className="text-white">{profileData.profile.bio}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Privacy Settings Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Eye className="w-4 h-4 mr-2 text-pokemon-gold" />
              Privacy Settings
            </h3>
            
            <div className="bg-pkmn-surface/30 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Public Profile</div>
                  <div className="text-gray-400 text-sm">Allow others to see your profile</div>
                </div>
                <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  profileData.profile.privacy_level === 'public' ? 'bg-pokemon-gold' : 'bg-gray-600'
                }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    profileData.profile.privacy_level === 'public' ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Show Collection</div>
                  <div className="text-gray-400 text-sm">Display your collection publicly</div>
                </div>
                <button className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  profileData.profile.show_collection_value ? 'bg-pokemon-gold' : 'bg-gray-600'
                }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    profileData.profile.show_collection_value ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Show Online Status</div>
                  <div className="text-gray-400 text-sm">Let friends see when you're online</div>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-pokemon-gold">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Language & Currency Settings Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Globe className="w-4 h-4 mr-2 text-pokemon-gold" />
              Language, Currency & Pricing
            </h3>
            
            <div className="bg-pkmn-surface/30 rounded-lg p-4 space-y-6">
              {/* Language Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Preferred Language
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {userPreferencesService.getAvailableLanguages().map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      disabled={preferencesLoading}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                        preferences?.preferred_language === lang.code
                          ? 'bg-pokemon-gold/20 border-pokemon-gold text-pokemon-gold'
                          : 'bg-pkmn-surface/50 border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-pkmn-surface/70'
                      } ${preferencesLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-sm font-medium">{lang.name}</span>
                      {preferences?.preferred_language === lang.code && (
                        <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Currency Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Preferred Currency
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {userPreferencesService.getAvailableCurrencies().map((currency) => (
                    <button
                      key={currency.code}
                      onClick={() => handleCurrencyChange(currency.code)}
                      disabled={preferencesLoading}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                        preferences?.preferred_currency === currency.code
                          ? 'bg-pokemon-gold/20 border-pokemon-gold text-pokemon-gold'
                          : 'bg-pkmn-surface/50 border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-pkmn-surface/70'
                      } ${preferencesLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <DollarSign className="w-4 h-4" />
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">{currency.code}</span>
                        <span className="text-xs text-gray-400">{currency.name}</span>
                      </div>
                      <span className="text-sm font-bold ml-auto">{currency.symbol}</span>
                      {preferences?.preferred_currency === currency.code && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Source Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Price Source
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    {
                      value: 'cardmarket' as PriceSource,
                      name: 'CardMarket',
                      description: 'European marketplace',
                      region: 'EU',
                      currency: 'EUR',
                      icon: '🇪🇺'
                    },
                    {
                      value: 'tcgplayer' as PriceSource,
                      name: 'TCGPlayer',
                      description: 'US marketplace',
                      region: 'US',
                      currency: 'USD',
                      icon: '🇺🇸'
                    }
                  ].map((source) => (
                    <button
                      key={source.value}
                      onClick={() => handlePriceSourceChange(source.value)}
                      disabled={preferencesLoading}
                      className={`flex items-center space-x-3 p-4 rounded-lg border transition-colors ${
                        preferences?.preferred_price_source === source.value
                          ? 'bg-pokemon-gold/20 border-pokemon-gold text-pokemon-gold'
                          : 'bg-pkmn-surface/50 border-gray-600 text-gray-300 hover:border-gray-500 hover:bg-pkmn-surface/70'
                      } ${preferencesLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="text-2xl">{source.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{source.name}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {source.region}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {source.description} • {source.currency} pricing
                        </div>
                      </div>
                      {preferences?.preferred_price_source === source.value && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <div className="w-4 h-4 bg-blue-500 rounded-full mt-0.5 flex-shrink-0"></div>
                    <div className="text-sm text-blue-300">
                      <div className="font-medium mb-1">Price Source Information</div>
                      <div className="text-blue-200 text-xs space-y-1">
                        <div><strong>CardMarket:</strong> European marketplace with competitive EUR pricing, popular in Europe</div>
                        <div><strong>TCGPlayer:</strong> Leading US marketplace with USD pricing, widely used in North America</div>
                        <div className="mt-2 text-blue-100">Prices are automatically converted to your preferred currency.</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {preferencesLoading && (
                <div className="flex items-center justify-center py-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-pokemon-gold"></div>
                  <span className="ml-2 text-sm text-gray-400">Updating preferences...</span>
                </div>
              )}
            </div>
          </div>

          {/* Notification Settings Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Bell className="w-4 h-4 mr-2 text-pokemon-gold" />
              Notification Preferences
            </h3>
            
            <div className="bg-pkmn-surface/30 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Trade Requests</div>
                  <div className="text-gray-400 text-sm">Get notified when someone wants to trade</div>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-pokemon-gold">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Friend Requests</div>
                  <div className="text-gray-400 text-sm">Get notified about new friend requests</div>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-pokemon-gold">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Collection Updates</div>
                  <div className="text-gray-400 text-sm">Get notified about new cards and price changes</div>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-gray-600">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Email Notifications</div>
                  <div className="text-gray-400 text-sm">Receive notifications via email</div>
                </div>
                <button className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors bg-gray-600">
                  <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                </button>
              </div>
            </div>
          </div>

          {/* Security Settings Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Shield className="w-4 h-4 mr-2 text-pokemon-gold" />
              Security Settings
            </h3>
            
            <div className="bg-pkmn-surface/30 rounded-lg p-4 space-y-3">
              <button className="w-full flex items-center justify-between p-3 bg-pkmn-surface/50 rounded-lg hover:bg-pkmn-surface/70 transition-colors text-left">
                <div className="flex items-center space-x-3">
                  <Lock className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-white font-medium">Change Password</div>
                    <div className="text-gray-400 text-sm">Update your account password</div>
                  </div>
                </div>
                <div className="text-gray-400">→</div>
              </button>
              <button className="w-full flex items-center justify-between p-3 bg-pkmn-surface/50 rounded-lg hover:bg-pkmn-surface/70 transition-colors text-left">
                <div className="flex items-center space-x-3">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-white font-medium">Two-Factor Authentication</div>
                    <div className="text-gray-400 text-sm">Add an extra layer of security</div>
                  </div>
                </div>
                <div className="text-gray-400">→</div>
              </button>
            </div>
          </div>

          {/* Danger Zone Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-red-400 flex items-center">
              <Trash2 className="w-4 h-4 mr-2" />
              Danger Zone
            </h3>
            
            <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/30 space-y-3">
              <button
                onClick={handleClearCollection}
                disabled={clearingCollection}
                className="w-full flex items-center justify-between p-3 bg-orange-500/10 rounded-lg hover:bg-orange-500/20 transition-colors text-left border border-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center space-x-3">
                  <RefreshCw className={`w-4 h-4 text-orange-400 ${clearingCollection ? 'animate-spin' : ''}`} />
                  <div>
                    <div className="text-orange-400 font-medium">
                      {clearingCollection ? 'Clearing Collection...' : 'Clear Collection'}
                    </div>
                    <div className="text-orange-300 text-sm">
                      Start fresh - removes all cards, wishlists, and stats
                    </div>
                  </div>
                </div>
                <div className="text-orange-400">→</div>
              </button>
              
              <button className="w-full flex items-center justify-between p-3 bg-red-500/10 rounded-lg hover:bg-red-500/20 transition-colors text-left border border-red-500/30">
                <div>
                  <div className="text-red-400 font-medium">Delete Account</div>
                  <div className="text-red-300 text-sm">Permanently delete your account and all data</div>
                </div>
                <div className="text-red-400">→</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}