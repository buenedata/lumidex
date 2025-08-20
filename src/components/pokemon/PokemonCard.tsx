'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Star } from 'lucide-react';
import { PokemonCardProps } from '@/types/pokemon';
import { CollectionButtons, getAvailableVariants } from './CollectionButtons';
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext';
import { currencyService, SupportedCurrency } from '@/lib/currency-service';
import { useI18n } from '@/contexts/I18nContext';
import { PriceDisplay } from '@/components/PriceDisplay';
import { FallbackImage } from '@/components/ui/FallbackImage';
import { useAuth } from '@/contexts/AuthContext';
import { useWishlistModal } from '@/contexts/WishlistModalContext';

export const PokemonCard: React.FC<PokemonCardProps & { index?: number; isComplete?: boolean }> = ({
  card,
  collectionData,
  onToggleCollection,
  onAddVariant,
  onRemoveVariant,
  onViewDetails,
  currency: propCurrency,
  loading = false,
  selected = false,
  disabled = false,
  showVariants = true,
  index = 0,
  isComplete = false,
}) => {
  const { user } = useAuth();
  const { openWishlistModal } = useWishlistModal();
  const preferredCurrency = usePreferredCurrency();
  const { locale } = useI18n();
  const currency = propCurrency || preferredCurrency;
  
  const inCollection = collectionData && collectionData.totalQuantity > 0;
  const cardWithVariants = {
    ...card,
    availableVariants: card.availableVariants || getAvailableVariants(card)
  };
  // All variants are considered base variants, so no variant indicator should be shown
  const hasSpecialVariants = false;
  const variantCount = 0;

  // Create CardPriceData from the card data
  const cardPriceData = {
    cardmarket_avg_sell_price: card.cardmarket?.prices?.averageSellPrice,
    cardmarket_low_price: card.cardmarket?.prices?.lowPrice,
    cardmarket_trend_price: card.cardmarket?.prices?.trendPrice,
    tcgplayer_price: undefined, // Not available in PokemonCard interface
    tcgplayer_1st_edition_normal_market: undefined,
    tcgplayer_1st_edition_holofoil_market: undefined,
    tcgplayer_unlimited_normal_market: undefined,
    tcgplayer_unlimited_holofoil_market: undefined
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't open modal if clicking on collection buttons
    if ((e.target as HTMLElement).closest('.collection-buttons-row')) {
      return;
    }
    
    if (disabled || loading) return;
    if (onViewDetails) {
      onViewDetails(card.id);
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || loading) return;
    if (onViewDetails) {
      onViewDetails(card.id);
    }
  };

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      // Could show a login prompt here
      return;
    }
    openWishlistModal(card.id, card.name, card.images.small);
  };

  return (
    <div
      className={`
        pokemon-card-container
        ${loading ? 'loading' : ''}
        ${selected ? 'selected' : ''}
        ${disabled ? 'disabled' : ''}
        ${isComplete ? 'opacity-60' : ''}
      `}
    >
      {/* Complete Indicator */}
      {isComplete && (
        <div className="absolute top-2 right-2 z-10 bg-green-600 text-white rounded-full px-2 py-1 text-xs font-bold shadow-lg">
          ✓ Complete
        </div>
      )}
      
      {/* Variant Indicator */}
      {hasSpecialVariants && variantCount > 0 && (
        <div className="variant-indicator">
          +{variantCount} Variant{variantCount > 1 ? 's' : ''}
        </div>
      )}
      
      {/* Card Image */}
      <div className="card-image-container relative" onClick={handleImageClick}>
        <FallbackImage
          src={card.images.small}
          alt={card.name}
          fill
          className={`pokemon-card-image cursor-pointer transition-opacity duration-300 ${isComplete ? 'grayscale' : ''}`}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
          priority={index < 8}
          loading={index < 8 ? 'eager' : 'lazy'}
          fallbackSrc="/placeholder-card.png"
        />
        
        {/* Wishlist Star Button */}
        {user && !isComplete && (
          <button
            onClick={handleWishlistClick}
            className="absolute top-2 left-2 z-10 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-1.5 shadow-md hover:shadow-lg transition-all duration-200 group"
            title="Add to wishlist"
          >
            <Star className="w-4 h-4 text-yellow-500 group-hover:text-yellow-600 transition-colors" />
          </button>
        )}
        
        {isComplete && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-green-600 text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold shadow-lg">
              ✓
            </div>
          </div>
        )}
      </div>
      
      {/* Collection Management Buttons */}
      {showVariants && (
        <CollectionButtons
          card={cardWithVariants}
          collectionData={collectionData}
          onToggleCollection={onToggleCollection}
          onAddVariant={onAddVariant}
          onRemoveVariant={onRemoveVariant}
          loading={loading}
        />
      )}
      
      {/* Card Information */}
      <div className="card-info" onClick={handleImageClick}>
        <h3 className={`card-name cursor-pointer ${isComplete ? 'text-gray-400' : ''}`} title={card.name}>
          {card.name}
        </h3>
        <div className="card-meta">
          <span className={`card-number ${isComplete ? 'text-gray-500' : ''}`}>#{card.number}</span>
          <span className={`card-price ${isComplete ? 'text-gray-500' : ''}`}>
            <PriceDisplay
              cardData={cardPriceData}
              showConversion={true}
              showOriginal={false}
              size="sm"
            />
          </span>
        </div>
      </div>
    </div>
  );
};

// Grid component for displaying multiple cards
export const PokemonCardGrid: React.FC<{
  cards: any[];
  collectionData: Record<string, any>;
  onToggleCollection: (cardId: string) => void;
  onAddVariant: (cardId: string, variant: any) => void;
  onRemoveVariant: (cardId: string, variant: any) => void;
  onViewDetails?: (cardId: string) => void;
  currency?: string;
  loading?: Record<string, boolean>;
  className?: string;
  highlightedCardId?: string | null;
}> = ({
  cards,
  collectionData,
  onToggleCollection,
  onAddVariant,
  onRemoveVariant,
  onViewDetails,
  currency: propCurrency,
  loading = {},
  className = '',
  highlightedCardId = null,
}) => {
  const preferredCurrency = usePreferredCurrency();
  const finalCurrency = propCurrency || preferredCurrency;

  return (
    <div className={`cards-grid ${className}`}>
      {cards.map((card, index) => (
        <div
          key={card.id}
          data-card-id={card.id}
          className={`${highlightedCardId === card.id ? 'ring-4 ring-pokemon-gold ring-opacity-75 rounded-lg transition-all duration-500' : ''}`}
        >
          <PokemonCard
            card={card}
            collectionData={collectionData[card.id]}
            onToggleCollection={onToggleCollection}
            onAddVariant={onAddVariant}
            onRemoveVariant={onRemoveVariant}
            onViewDetails={onViewDetails}
            currency={finalCurrency}
            loading={loading[card.id] || false}
            index={index}
            isComplete={card.isComplete || false}
          />
        </div>
      ))}
    </div>
  );
};

// List view component for compact display
export const PokemonCardList: React.FC<{
  cards: any[];
  collectionData: Record<string, any>;
  onToggleCollection: (cardId: string) => void;
  onAddVariant: (cardId: string, variant: any) => void;
  onRemoveVariant: (cardId: string, variant: any) => void;
  onViewDetails?: (cardId: string) => void;
  currency?: string;
  loading?: Record<string, boolean>;
  className?: string;
}> = ({
  cards,
  collectionData,
  onToggleCollection,
  onAddVariant,
  onRemoveVariant,
  onViewDetails,
  currency: propCurrency,
  loading = {},
  className = '',
}) => {
  const { user } = useAuth();
  const { openWishlistModal } = useWishlistModal();
  const preferredCurrency = usePreferredCurrency();
  const { locale } = useI18n();
  const finalCurrency = propCurrency || preferredCurrency;

  // Helper function to create CardPriceData from card
  const getCardPriceData = (card: any) => ({
    cardmarket_avg_sell_price: card.cardmarket?.prices?.averageSellPrice,
    cardmarket_low_price: card.cardmarket?.prices?.lowPrice,
    cardmarket_trend_price: card.cardmarket?.prices?.trendPrice,
    tcgplayer_price: undefined, // Not available in PokemonCard interface
    tcgplayer_1st_edition_normal_market: undefined,
    tcgplayer_1st_edition_holofoil_market: undefined,
    tcgplayer_unlimited_normal_market: undefined,
    tcgplayer_unlimited_holofoil_market: undefined
  });

  return (
    <div className={`space-y-3 ${className}`}>
      {cards.map((card) => (
        <div
          key={card.id}
          className="flex items-center bg-pkmn-card rounded-lg p-4 hover:bg-pkmn-surface transition-colors"
        >
          {/* Card Image */}
          <div className="w-16 h-24 relative flex-shrink-0 mr-4">
            <FallbackImage
              src={card.images.small || card.images.large}
              alt={card.name}
              fill
              className="object-cover rounded transition-opacity duration-300"
              sizes="64px"
              loading="lazy"
              fallbackSrc="/placeholder-card.png"
            />
            {/* Wishlist Star Button for List View */}
            {user && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openWishlistModal(card.id, card.name, card.images.small || card.images.large);
                }}
                className="absolute top-1 left-1 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-1 shadow-sm hover:shadow-md transition-all duration-200"
                title="Add to wishlist"
              >
                <Star className="w-3 h-3 text-yellow-500" />
              </button>
            )}
          </div>
          
          {/* Card Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white truncate">{card.name}</h3>
            <p className="text-sm text-gray-400">#{card.number}</p>
            <div className="text-sm text-pokemon-gold">
              <PriceDisplay
                cardData={getCardPriceData(card)}
                showConversion={true}
                showOriginal={false}
                size="sm"
              />
            </div>
          </div>
          
          {/* Collection Buttons */}
          <div className="flex-shrink-0">
            <CollectionButtons
              card={{
                ...card,
                availableVariants: getAvailableVariants(card)
              }}
              collectionData={collectionData[card.id]}
              onToggleCollection={onToggleCollection}
              onAddVariant={onAddVariant}
              onRemoveVariant={onRemoveVariant}
              loading={loading[card.id] || false}
            />
          </div>
        </div>
      ))}
    </div>
  );
};