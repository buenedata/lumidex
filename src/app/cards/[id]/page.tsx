'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { supabase } from '@/lib/supabase'
import { CollectionButtons, getAvailableVariants } from '@/components/pokemon/CollectionButtons'
import { CardVariant } from '@/types/pokemon'
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext'
import { useI18n } from '@/contexts/I18nContext'
import { currencyService } from '@/lib/currency-service'
import { wishlistService } from '@/lib/wishlist-service'
import { achievementService } from '@/lib/achievement-service'
import { toastService } from '@/lib/toast-service'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { getCorrectCardMarketUrl } from '@/lib/card-url-corrections'
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  Hash,
  Star,
  TrendingUp,
  DollarSign,
  Package
} from 'lucide-react'

interface CardData {
  id: string
  name: string
  number: string
  set_id: string
  rarity: string
  types: string[]
  image_small: string
  image_large: string
  cardmarket_avg_sell_price: number | null
  cardmarket_low_price: number | null
  cardmarket_trend_price: number | null
  created_at: string
  sets?: {
    name: string
    symbol_url: string | null
    release_date: string
  }
}

function CardDetailsContent() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const cardId = params.id as string
  const preferredCurrency = usePreferredCurrency()
  const { locale } = useI18n()

  const [card, setCard] = useState<CardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userCollectionData, setUserCollectionData] = useState<any>(null)
  const [collectionLoading, setCollectionLoading] = useState(false)

  useEffect(() => {
    if (cardId) {
      fetchCard()
      if (user) {
        fetchUserCollection()
      }
    }
  }, [cardId, user])

  const fetchCard = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('cards')
        .select(`
          *,
          sets!inner(name, symbol_url, release_date)
        `)
        .eq('id', cardId)
        .single()

      if (error) {
        console.error('Error fetching card:', error)
        setError('Card not found')
      } else if (data) {
        setCard(data)
      } else {
        setError('Card not found')
      }
    } catch (error) {
      console.error('Error fetching card:', error)
      setError('Failed to load card')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserCollection = async () => {
    if (!user || !cardId) return

    try {
      const { data, error } = await supabase
        .from('user_collections')
        .select('*')
        .eq('user_id', user.id)
        .eq('card_id', cardId)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user collection:', error)
      } else if (data) {
        setUserCollectionData({
          cardId: data.card_id,
          userId: user.id,
          normal: 1, // Simplified for now
          holo: 0,
          reverseHolo: 0,
          pokeballPattern: 0,
          masterballPattern: 0,
          firstEdition: 0,
          totalQuantity: data.quantity || 1,
          dateAdded: data.created_at,
          lastUpdated: data.updated_at
        })
      }
    } catch (error) {
      console.error('Error fetching user collection:', error)
    }
  }

  const handleToggleCollection = async (cardId: string) => {
    if (!user) {
      router.push('/auth/signin')
      return
    }

    setCollectionLoading(true)
    
    try {
      const isInCollection = userCollectionData?.totalQuantity > 0
      
      if (isInCollection) {
        // Remove from collection
        const { error } = await supabase
          .from('user_collections')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', cardId)

        if (!error) {
          setUserCollectionData(null)

          // Check for achievement revocations after removing from collection
          try {
            const achievementResult = await achievementService.checkAchievements(user.id)
            if (achievementResult.success) {
              // Show toasts for revoked achievements
              if (achievementResult.revokedAchievements && achievementResult.revokedAchievements.length > 0) {
                achievementResult.revokedAchievements.forEach(achievementType => {
                  const definition = achievementService.getAchievementDefinition(achievementType)
                  if (definition) {
                    toastService.warning(`Achievement Revoked: ${definition.name}`, 'Collection no longer meets requirements')
                  }
                })
              }
            }
          } catch (achievementError) {
            console.warn('Failed to check achievements:', achievementError)
          }
        }
      } else {
        // Add to collection
        const { error } = await supabase
          .from('user_collections')
          .insert({
            user_id: user.id,
            card_id: cardId,
            quantity: 1,
            condition: 'near_mint'
          })

        if (!error) {
          setUserCollectionData({
            cardId,
            userId: user.id,
            normal: 1,
            holo: 0,
            reverseHolo: 0,
            pokeballPattern: 0,
            masterballPattern: 0,
            firstEdition: 0,
            totalQuantity: 1,
            dateAdded: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          })

          // Remove card from wishlist if it exists there
          try {
            const wishlistRemovalResult = await wishlistService.removeFromWishlistByCardId(user.id, cardId)
            if (wishlistRemovalResult.success) {
              console.log(`Card ${cardId} automatically removed from wishlist after being added to collection`)
            }
          } catch (wishlistError) {
            console.warn('Failed to remove card from wishlist:', wishlistError)
            // Don't fail the collection operation if wishlist removal fails
          }

          // Check for achievements after adding to collection
          try {
            const achievementResult = await achievementService.checkAchievements(user.id)
            if (achievementResult.success) {
              // Show toasts for new achievements
              if (achievementResult.newAchievements && achievementResult.newAchievements.length > 0) {
                achievementResult.newAchievements.forEach(achievement => {
                  const definition = achievementService.getAchievementDefinition(achievement.achievement_type)
                  if (definition) {
                    toastService.achievement(`Achievement Unlocked: ${definition.name}`, definition.description, definition.icon)
                  }
                })
              }
            }
          } catch (achievementError) {
            console.warn('Failed to check achievements:', achievementError)
          }
        }
      }
    } catch (error) {
      console.error('Error toggling collection:', error)
    } finally {
      setCollectionLoading(false)
    }
  }

  const handleAddVariant = async (cardId: string, variant: CardVariant) => {
    if (!user) {
      router.push('/auth/signin')
      return
    }

    setCollectionLoading(true)
    
    try {
      // For now, just add to collection - variant tracking will be implemented later
      const { error } = await supabase
        .from('user_collections')
        .upsert({
          user_id: user.id,
          card_id: cardId,
          quantity: 1,
          condition: 'near_mint'
        })
      
      if (!error) {
        const current = userCollectionData || {
          cardId,
          userId: user.id,
          normal: 0,
          holo: 0,
          reverseHolo: 0,
          pokeballPattern: 0,
          masterballPattern: 0,
          firstEdition: 0,
          totalQuantity: 0,
          dateAdded: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        }
        
        const variantKey = variant === 'reverse_holo' ? 'reverseHolo' :
                          variant === 'pokeball_pattern' ? 'pokeballPattern' :
                          variant === 'masterball_pattern' ? 'masterballPattern' :
                          variant === '1st_edition' ? 'firstEdition' : variant
        
        setUserCollectionData({
          ...current,
          [variantKey]: (current[variantKey] || 0) + 1,
          totalQuantity: (current.totalQuantity || 0) + 1,
          lastUpdated: new Date().toISOString()
        })

        // Remove card from wishlist if it exists there
        try {
          const wishlistRemovalResult = await wishlistService.removeFromWishlistByCardId(user.id, cardId)
          if (wishlistRemovalResult.success) {
            console.log(`Card ${cardId} automatically removed from wishlist after adding variant ${variant}`)
          }
        } catch (wishlistError) {
          console.warn('Failed to remove card from wishlist:', wishlistError)
          // Don't fail the collection operation if wishlist removal fails
        }

        // Check for achievements after adding variant
        try {
          const achievementResult = await achievementService.checkAchievements(user.id)
          if (achievementResult.success) {
            // Show toasts for new achievements
            if (achievementResult.newAchievements && achievementResult.newAchievements.length > 0) {
              achievementResult.newAchievements.forEach(achievement => {
                const definition = achievementService.getAchievementDefinition(achievement.achievement_type)
                if (definition) {
                  toastService.achievement(`Achievement Unlocked: ${definition.name}`, definition.description, definition.icon)
                }
              })
            }
          }
        } catch (achievementError) {
          console.warn('Failed to check achievements:', achievementError)
        }
      }
    } catch (error) {
      console.error('Error adding variant:', error)
    } finally {
      setCollectionLoading(false)
    }
  }

  const handleRemoveVariant = async (cardId: string, variant: CardVariant) => {
    if (!user) return

    setCollectionLoading(true)
    
    try {
      const current = userCollectionData
      if (!current) return
      
      const variantKey = variant === 'reverse_holo' ? 'reverseHolo' :
                        variant === 'pokeball_pattern' ? 'pokeballPattern' :
                        variant === 'masterball_pattern' ? 'masterballPattern' :
                        variant === '1st_edition' ? 'firstEdition' : variant
      
      const newQuantity = Math.max(0, (current[variantKey] || 0) - 1)
      const newTotal = Math.max(0, (current.totalQuantity || 0) - 1)
      
      if (newTotal === 0) {
        const { error } = await supabase
          .from('user_collections')
          .delete()
          .eq('user_id', user.id)
          .eq('card_id', cardId)

        if (!error) {
          setUserCollectionData(null)
        }
      } else {
        setUserCollectionData({
          ...current,
          [variantKey]: newQuantity,
          totalQuantity: newTotal,
          lastUpdated: new Date().toISOString()
        })
      }
    } catch (error) {
      console.error('Error removing variant:', error)
    } finally {
      setCollectionLoading(false)
    }
  }

  const formatPrice = (price: number | null | undefined): string => {
    if (!price) return 'N/A'
    return currencyService.formatCurrency(price, preferredCurrency || 'EUR', locale)
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p className="text-gray-400">Loading card details...</p>
        </div>
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 opacity-50">🃏</div>
          <h1 className="text-2xl font-bold text-white mb-2">Card Not Found</h1>
          <p className="text-gray-400 mb-6">{error || 'The requested card could not be found.'}</p>
          <Link href="/cards" className="btn-gaming">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cards
          </Link>
        </div>
      </div>
    )
  }

  const transformedCard = {
    id: card.id,
    name: card.name,
    number: card.number,
    set: {
      id: card.set_id,
      name: card.sets?.name || '',
      releaseDate: card.sets?.release_date || ''
    },
    rarity: card.rarity,
    types: card.types || [],
    images: {
      small: card.image_small || '',
      large: card.image_large || ''
    },
    cardmarket: {
      prices: {
        averageSellPrice: card.cardmarket_avg_sell_price || 0,
        lowPrice: card.cardmarket_low_price || 0,
        trendPrice: card.cardmarket_trend_price || 0
      }
    },
    availableVariants: getAvailableVariants(card)
  }

  return (
    <div className="min-h-screen bg-pkmn-dark">
      {/* Header */}
      <header className="bg-pkmn-card border-b border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/cards" className="flex items-center text-pokemon-gold hover:text-pokemon-gold-hover transition-colors">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Cards
              </Link>
              <div className="h-6 w-px bg-gray-600"></div>
              <h1 className="text-xl font-bold text-white">
                {card.name}
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card Image */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="aspect-[2.5/3.5] relative">
                <FallbackImage
                  src={card.image_small}
                  alt={card.name}
                  fill
                  className="object-contain rounded-lg shadow-2xl"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                  fallbackSrc="/placeholder-card.png"
                />
              </div>
            </div>
          </div>

          {/* Card Details */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="card-container">
              <h2 className="text-2xl font-bold text-white mb-4">{card.name}</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center space-x-2">
                  <Hash className="w-5 h-5 text-pokemon-gold" />
                  <span className="text-gray-400">Number:</span>
                  <span className="text-white font-medium">#{card.number}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Star className="w-5 h-5 text-pokemon-gold" />
                  <span className="text-gray-400">Rarity:</span>
                  <span className="text-white font-medium">{card.rarity}</span>
                </div>
                
                {card.sets && (
                  <>
                    <div className="flex items-center space-x-2">
                      <Package className="w-5 h-5 text-pokemon-gold" />
                      <span className="text-gray-400">Set:</span>
                      <span className="text-white font-medium">{card.sets.name}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-pokemon-gold" />
                      <span className="text-gray-400">Released:</span>
                      <span className="text-white font-medium">
                        {formatDate(card.sets.release_date)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Types */}
              {card.types && card.types.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Types</h3>
                  <div className="flex flex-wrap gap-2">
                    {card.types.map((type, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-pkmn-surface text-white rounded-full text-sm font-medium"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Pricing */}
            <div className="card-container">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <DollarSign className="w-5 h-5 text-pokemon-gold mr-2" />
                Market Prices
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-pkmn-surface rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Average</div>
                  <div className="text-xl font-bold text-pokemon-gold">
                    {formatPrice(card.cardmarket_avg_sell_price)}
                  </div>
                </div>
                
                <div className="text-center p-4 bg-pkmn-surface rounded-lg">
                  <div className="text-sm text-gray-400 mb-1">Low Price</div>
                  <div className="text-xl font-bold text-green-400">
                    {formatPrice(card.cardmarket_low_price)}
                  </div>
                </div>
                
                <div className="text-center p-4 bg-pkmn-surface rounded-lg">
                  <div className="text-sm text-gray-400 mb-1 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Trend
                  </div>
                  <div className="text-xl font-bold text-blue-400">
                    {formatPrice(card.cardmarket_trend_price)}
                  </div>
                </div>
              </div>
            </div>

            {/* Collection Management */}
            <div className="card-container">
              <h3 className="text-lg font-semibold text-white mb-4">Collection</h3>
              
              <CollectionButtons
                card={transformedCard}
                collectionData={userCollectionData}
                onToggleCollection={handleToggleCollection}
                onAddVariant={handleAddVariant}
                onRemoveVariant={handleRemoveVariant}
                loading={collectionLoading}
              />
              
              {userCollectionData && (
                <div className="mt-4 p-4 bg-pkmn-surface rounded-lg">
                  <div className="text-sm text-gray-400 mb-2">In your collection:</div>
                  <div className="text-lg font-semibold text-pokemon-gold">
                    {userCollectionData.totalQuantity} card{userCollectionData.totalQuantity !== 1 ? 's' : ''}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Added: {formatDate(userCollectionData.dateAdded)}
                  </div>
                </div>
              )}
            </div>

            {/* External Links */}
            <div className="card-container">
              <h3 className="text-lg font-semibold text-white mb-4">External Links</h3>
              
              <div className="space-y-2">
                <a
                  href={(() => {
                    // Check for corrected URL first
                    const correctedUrl = getCorrectCardMarketUrl(
                      card.id,
                      card.set_id,
                      card.number,
                      card.name
                    )
                    
                    if (correctedUrl) {
                      console.log(`🔧 Using corrected CardMarket URL for ${card.name}: ${correctedUrl}`)
                      return correctedUrl
                    }
                    
                    // Fallback to default URL generation
                    return `https://www.cardmarket.com/en/Pokemon/Cards/${card.name.replace(/\s+/g, '-')}`
                  })()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 bg-pkmn-surface rounded-lg hover:bg-gray-600 transition-colors"
                >
                  <span className="text-white">View on Cardmarket</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CardDetailsPage() {
  return (
    <ProtectedRoute>
      <CardDetailsContent />
    </ProtectedRoute>
  )
}