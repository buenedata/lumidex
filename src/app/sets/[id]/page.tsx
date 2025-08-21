'use client'

import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { PokemonCardGrid } from '@/components/pokemon/PokemonCard'
import { getAvailableVariants } from '@/components/pokemon/CollectionButtons'
import { CardDetailsModal } from '@/components/pokemon/CardDetailsModal'
import { VariantExplanation, getSetVariants } from '@/components/pokemon/VariantExplanation'
import { BulkWishlistSelectionModal } from '@/components/pokemon/BulkWishlistSelectionModal'
import MainNavBar from '@/components/navigation/MainNavBar'
import EnhancedMegaMenu from '@/components/navigation/EnhancedMegaMenu'
import { NavigationProvider } from '@/contexts/NavigationContext'
import { SetHeader } from '@/components/sets/SetHeader'
import { CollectionModeToggle } from '@/components/sets/CollectionModeToggle'
import { SetSearchAndControls } from '@/components/sets/SetSearchAndControls'
import { SetCardsTable } from '@/components/sets/SetCardsTable'
import { ResetSetConfirmationDialog } from '@/components/sets/ResetSetConfirmationDialog'
import { useSetPage } from '@/hooks/useSetPage'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Grid3X3, List } from 'lucide-react'

function SetPageContent() {
  const { user } = useAuth()
  const params = useParams()
  const searchParams = useSearchParams()
  const setId = params.id as string
  const targetCardId = searchParams.get('cardId')

  // Use the custom hook to get all state and handlers
  const {
    // State
    setData,
    cards,
    loading,
    searchQuery,
    setSearchQuery,
    sortBy,
    sortOrder,
    viewMode,
    setViewMode,
    userCollection,
    userCollectionData,
    loadingStates,
    selectedCardId,
    isModalOpen,
    highlightedCardId,
    collectionMode,
    setCollectionMode,
    filterMode,
    setFilterMode,
    showResetConfirmation,
    setShowResetConfirmation,
    isResetting,
    showBulkWishlistModal,
    setShowBulkWishlistModal,
    
    // Computed values
    filteredAndSortedCards,
    collectedCards,
    totalValue,
    userValue,
    needCount,
    haveCount,
    duplicatesCount,
    needCardIds,
    
    // Handlers
    handleToggleCollection,
    handleAddVariant,
    handleRemoveVariant,
    handleResetSet,
    handleCollectionChange,
    handleSortToggle,
    handleBulkAddToWishlist,
    handleViewDetails,
    handleCloseModal,
    
    // Helper functions
    isCardCollected,
    isCardComplete,
    hasCardDuplicates,
    getCardDuplicateCount,
    isCardCompletedInMode
  } = useSetPage(setId, targetCardId, user)

  if (loading) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🃏</div>
          <h2 className="text-2xl font-bold text-white mb-4">Loading Set...</h2>
          <p className="text-gray-400">Preparing your set experience</p>
        </div>
      </div>
    )
  }

  if (!setData) {
    return (
      <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-50">❌</div>
          <h3 className="text-xl font-semibold text-white mb-2">Set not found</h3>
          <p className="text-gray-400 mb-6">The requested set could not be found</p>
          <Link href="/dashboard" className="btn-gaming">
            Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <NavigationProvider>
      <div className="min-h-screen bg-pkmn-dark">
        {/* Main Navigation */}
        <MainNavBar />
        
        {/* Enhanced Mega Menu */}
        <div className="relative">
          <EnhancedMegaMenu />
        </div>

        {/* Page Header with Back Button */}
        <header className="bg-pkmn-card border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Link href="/series" className="flex items-center text-white hover:text-gray-300 transition-colors">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Series
                </Link>
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex items-center bg-pkmn-surface rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-pokemon-gold text-black' : 'text-gray-400 hover:text-white'}`}
                  title="Grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded ${viewMode === 'table' ? 'bg-pokemon-gold text-black' : 'text-gray-400 hover:text-white'}`}
                  title="Table view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Set Header */}
          <SetHeader
            setData={setData}
            totalValue={totalValue}
            userValue={userValue}
            collectedCards={collectedCards}
            totalCards={cards.length}
            user={user}
          />

          {/* Variant Explanation */}
          <VariantExplanation
            availableVariants={getSetVariants(filteredAndSortedCards.map((card: any) => ({
              ...card,
              set: {
                id: setId,
                name: setData?.name || '',
                releaseDate: setData?.release_date || ''
              },
              availableVariants: getAvailableVariants({
                ...card,
                set: {
                  id: setId,
                  name: setData?.name || '',
                  releaseDate: setData?.release_date || ''
                }
              })
            })))}
          />

          {/* Collection Mode Toggle */}
          {user && (
            <CollectionModeToggle
              collectionMode={collectionMode}
              onModeChange={setCollectionMode}
            />
          )}

          {/* Search and Controls */}
          <SetSearchAndControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortToggle={handleSortToggle}
            filterMode={filterMode}
            onFilterChange={setFilterMode}
            user={user}
            totalCards={cards.length}
            needCount={needCount}
            haveCount={haveCount}
            duplicatesCount={duplicatesCount}
            collectedCards={collectedCards}
            onBulkAddToWishlist={handleBulkAddToWishlist}
            onResetSet={() => setShowResetConfirmation(true)}
            isResetting={isResetting}
          />

          {/* Cards Display */}
          {viewMode === 'table' ? (
            <SetCardsTable
              cards={filteredAndSortedCards}
              user={user}
              userCollection={userCollection}
              loadingStates={loadingStates}
              highlightedCardId={highlightedCardId}
              collectionMode={collectionMode}
              isCardCompletedInMode={isCardCompletedInMode}
              isCardCollected={isCardCollected}
              isCardComplete={isCardComplete}
              onToggleCollection={handleToggleCollection}
              onViewDetails={handleViewDetails}
            />
          ) : (
            <PokemonCardGrid
              cards={filteredAndSortedCards.map((card: any) => ({
                id: card.id,
                name: card.name,
                number: card.number,
                set: {
                  id: setId,
                  name: setData?.name || '',
                  releaseDate: setData?.release_date || ''
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
                availableVariants: getAvailableVariants(card),
                isComplete: isCardCompletedInMode(card)
              }))}
              collectionData={userCollectionData}
              onToggleCollection={handleToggleCollection}
              onAddVariant={handleAddVariant}
              onRemoveVariant={handleRemoveVariant}
              onViewDetails={handleViewDetails}
              currency="EUR"
              loading={loadingStates}
              className="animate-fade-in"
              highlightedCardId={highlightedCardId}
            />
          )}

          {filteredAndSortedCards.length === 0 && (
            <div className="card-container text-center py-20">
              <div className="text-4xl mb-4 opacity-50">🃏</div>
              <h3 className="text-xl font-semibold text-white mb-2">No cards found</h3>
              <p className="text-gray-400">Try adjusting your search</p>
            </div>
          )}
        </div>

        {/* Card Details Modal */}
        <CardDetailsModal
          cardId={selectedCardId}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onCollectionChange={handleCollectionChange}
          supabaseClient={supabase}
        />

        {/* Bulk Wishlist Selection Modal */}
        <BulkWishlistSelectionModal
          isOpen={showBulkWishlistModal}
          onClose={() => setShowBulkWishlistModal(false)}
          cardIds={needCardIds}
          cardCount={needCount}
          setName={setData?.name || ''}
        />

        {/* Reset Set Confirmation Dialog */}
        <ResetSetConfirmationDialog
          isOpen={showResetConfirmation}
          onClose={() => setShowResetConfirmation(false)}
          onConfirm={handleResetSet}
          isResetting={isResetting}
          setName={setData?.name || ''}
          collectedCardsCount={collectedCards}
        />
      </div>
    </NavigationProvider>
  )
}

export default function SetPage() {
  return (
    <ProtectedRoute>
      <SetPageContent />
    </ProtectedRoute>
  )
}
