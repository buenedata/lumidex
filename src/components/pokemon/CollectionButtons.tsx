'use client';

import React, { memo, useMemo } from 'react';
import { Plus, Check } from 'lucide-react';
import { CollectionButtonProps, CardVariant, CardCollectionData } from '@/types/pokemon';

export const CollectionButtons: React.FC<CollectionButtonProps> = memo(({
  card,
  collectionData,
  onToggleCollection,
  onAddVariant,
  onRemoveVariant,
  loading = false,
}) => {
  const inCollection = collectionData && collectionData.totalQuantity > 0;

  const handleVariantClick = (e: React.MouseEvent, variant: CardVariant) => {
    e.stopPropagation();
    if (loading) return;
    onAddVariant(card.id, variant);
  };

  const handleVariantRightClick = (e: React.MouseEvent, variant: CardVariant) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    
    const currentQuantity = getVariantQuantity(variant);
    if (currentQuantity > 0) {
      onRemoveVariant(card.id, variant);
    }
  };

  // Remove the toggle click handler - yellow button is now just a visual indicator

  const getVariantQuantity = (variant: CardVariant): number => {
    if (!collectionData) return 0;
    
    switch (variant) {
      case 'normal': return collectionData.normal || 0;
      case 'holo': return collectionData.holo || 0;
      case 'reverse_holo': return collectionData.reverseHolo || 0;
      case 'pokeball_pattern': return collectionData.pokeballPattern || 0;
      case 'masterball_pattern': return collectionData.masterballPattern || 0;
      case '1st_edition': return collectionData.firstEdition || 0;
      default: return 0;
    }
  };

  const getVariantTitle = (variant: CardVariant): string => {
    switch (variant) {
      case 'normal': return 'Normal (Non-Holo)';
      case 'holo': return 'Holo';
      case 'reverse_holo': return 'Reverse Holo';
      case 'pokeball_pattern': return 'Pokeball Pattern';
      case 'masterball_pattern': return 'Masterball Pattern';
      case '1st_edition': return '1st Edition';
      default: return variant;
    }
  };

  const getVariantClass = (variant: CardVariant): string => {
    switch (variant) {
      case 'normal': return 'normal-btn';
      case 'holo': return 'holo-btn';
      case 'reverse_holo': return 'reverse-holo-btn';
      case 'pokeball_pattern': return 'pokeball-btn';
      case 'masterball_pattern': return 'masterball-btn';
      case '1st_edition': return 'first-edition-btn';
      default: return 'normal-btn';
    }
  };

  // Force re-calculation every time - no memoization for debugging
  const availableVariants: CardVariant[] = getAvailableVariants(card);
  

  return (
    <div className="collection-buttons-row">
      {/* Main collection status indicator (non-clickable) */}
      <div
        className={`collection-btn ${inCollection ? 'active' : ''} ${loading ? 'loading' : ''}`}
        title={inCollection ? 'Card is in collection' : 'Card not in collection'}
      >
        {inCollection ? (
          <Check className="w-3 h-3" />
        ) : (
          <Plus className="w-3 h-3" />
        )}
      </div>

      {/* Variant buttons */}
      <div className="variant-buttons">
        {availableVariants.map((variant) => {
          const quantity = getVariantQuantity(variant);
          const isActive = quantity > 0;
          
          return (
            <button
              key={variant}
              className={`variant-btn ${getVariantClass(variant)} ${isActive ? 'active' : ''} ${loading ? 'loading' : ''}`}
              onClick={(e) => handleVariantClick(e, variant)}
              onContextMenu={(e) => handleVariantRightClick(e, variant)}
              disabled={loading}
              title={`${getVariantTitle(variant)} (${quantity})`}
            >
              {quantity > 0 ? quantity : null}
            </button>
          );
        })}
      </div>
    </div>
  );
});

CollectionButtons.displayName = 'CollectionButtons';

// Helper function to determine available variants based on specific set rules
export const getAvailableVariants = (card: any): CardVariant[] => {
  const variants: CardVariant[] = [];
  
  // Get card information
  const rarity = card.rarity || '';
  const setName = card.set?.name?.toLowerCase() || card.sets?.name?.toLowerCase() || '';
  const setId = card.set?.id?.toLowerCase() || card.set_id?.toLowerCase() || '';
  const cardNumber = card.number ? parseInt(card.number.split('/')[0]) : 0;
  
  
  
  // Determine card type
  const isTrainer = card.types?.length === 0;
  const isEnergy = card.types?.includes('Energy');
  const isPokemon = !isTrainer && !isEnergy;
  
  // Categorize rarities
  const isCommon = rarity === 'Common';
  const isUncommon = rarity === 'Uncommon';
  const isRare = rarity === 'Rare';
  const isHoloRare = rarity === 'Rare Holo' || rarity === 'Holo Rare';
  
  // Ultra Rare and special categories
  const isUltraRare = rarity.includes('V') || rarity.includes('EX') || rarity.includes('GX') ||
                     rarity.includes('VMAX') || rarity.includes('VSTAR') || rarity.includes('ex') ||
                     rarity === 'Rare Ultra' || rarity === 'Ultra Rare' || rarity === 'Double Rare' ||
                     (card.name && card.name.includes(' ex'));
  const isSpecialIllustration = rarity.includes('Special Illustration') || rarity.includes('Illustration Rare');
  const isSecretRare = rarity.includes('Secret') || rarity.includes('Gold') || rarity.includes('Rainbow');
  const isAceSpec = rarity.includes('ACE SPEC');
  const isFullArt = rarity.includes('Full Art');
  const isSpecialEnergy = isEnergy && (isFullArt || rarity.includes('Special'));
  
  // Identify specific sets that have special pattern variants
  const isPrismaticEvolutions = setName.includes('prismatic evolutions') || setId === 'sv8pt5';
  const isBlackBolt = setName.includes('black bolt') || setId === 'zsv10pt5';
  const isWhiteFlare = setName.includes('white flare') || setId === 'rsv10pt5';
  const isCelebrations = setName.includes('celebrations') || setId === 'swsh12pt5';
  const isSpecialSet = isPrismaticEvolutions || isBlackBolt || isWhiteFlare || isCelebrations;
  
  // 1st Edition sets - WotC era and E-Card era (using actual database IDs)
  const wotcSets = [
    'base1', 'base2', 'base3', 'base4', 'base5', // Base series
    'gym1', 'gym2', // Gym series
    'neo1', 'neo2', 'neo3', 'neo4' // Neo series
  ];
  const eCardSets = [
    'ecard1', 'ecard2', 'ecard3' // E-Card series
  ];
  
  // Check if this is a 1st Edition eligible set
  const is1stEditionSet = wotcSets.includes(setId.toLowerCase()) ||
                          eCardSets.includes(setId.toLowerCase()) ||
                          // Also check by name for safety
                          setName.toLowerCase().includes('base') ||
                          setName.toLowerCase().includes('jungle') ||
                          setName.toLowerCase().includes('fossil') ||
                          setName.toLowerCase().includes('team rocket') ||
                          setName.toLowerCase().includes('gym heroes') ||
                          setName.toLowerCase().includes('gym challenge') ||
                          setName.toLowerCase().includes('neo genesis') ||
                          setName.toLowerCase().includes('neo discovery') ||
                          setName.toLowerCase().includes('neo revelation') ||
                          setName.toLowerCase().includes('neo destiny') ||
                          setName.toLowerCase().includes('expedition') ||
                          setName.toLowerCase().includes('aquapolis') ||
                          setName.toLowerCase().includes('skyridge');
  
  
  // Check if this is a 1st Edition set first
  if (is1stEditionSet) {
    // 1ST EDITION SETS - All cards get 1st Edition variant
    if (isCommon) {
      // Common: Normal, Reverse Holo, 1st Edition
      variants.push('normal', 'reverse_holo', '1st_edition');
    } else if (isUncommon) {
      // Uncommon: Normal, Reverse Holo, 1st Edition
      variants.push('normal', 'reverse_holo', '1st_edition');
    } else if (isRare) {
      // Rare: Reverse Holo, Holo, 1st Edition
      variants.push('reverse_holo', 'holo', '1st_edition');
    } else if (isHoloRare) {
      // Holo Rare: Reverse Holo, Holo, 1st Edition
      variants.push('reverse_holo', 'holo', '1st_edition');
    } else if (isUltraRare || isSpecialIllustration || isSecretRare || isAceSpec) {
      // Ultra Rare: Holo, 1st Edition
      variants.push('holo', '1st_edition');
    } else if (isTrainer) {
      if (isCommon || isUncommon) {
        // Trainer (Common/Uncommon): Normal, Reverse Holo, 1st Edition
        variants.push('normal', 'reverse_holo', '1st_edition');
      } else if (isRare || isHoloRare) {
        // Trainer (Rare/Holo Rare): Reverse Holo, Holo, 1st Edition
        variants.push('reverse_holo', 'holo', '1st_edition');
      }
    } else if (isEnergy) {
      if (isSpecialEnergy || isFullArt) {
        // Special/Full Art Energy: Holo, 1st Edition
        variants.push('holo', '1st_edition');
      } else {
        // Basic Energy: Normal, Reverse Holo, 1st Edition
        variants.push('normal', 'reverse_holo', '1st_edition');
      }
    }
  }
  // Check if this is NOT a special set (regular English set)
  else if (!isSpecialSet) {
    // ALL REGULAR ENGLISH SETS - NO SPECIAL PATTERNS
    if (isCommon) {
      // Common: Normal, Reverse Holo only
      variants.push('normal', 'reverse_holo');
    } else if (isUncommon) {
      // Uncommon: Normal, Reverse Holo only
      variants.push('normal', 'reverse_holo');
    } else if (isRare) {
      // Rare: Reverse Holo, Holo only
      variants.push('reverse_holo', 'holo');
    } else if (isHoloRare) {
      // Holo Rare: Reverse Holo, Holo only
      variants.push('reverse_holo', 'holo');
    } else if (isUltraRare || isSpecialIllustration || isSecretRare || isAceSpec) {
      // Ultra Rare: Always Holo only
      variants.push('holo');
    } else if (isTrainer) {
      if (isCommon || isUncommon) {
        // Trainer (Common/Uncommon): Normal, Reverse Holo only
        variants.push('normal', 'reverse_holo');
      } else if (isRare || isHoloRare) {
        // Trainer (Rare/Holo Rare): Reverse Holo, Holo only
        variants.push('reverse_holo', 'holo');
      }
    } else if (isEnergy) {
      if (isSpecialEnergy || isFullArt) {
        // Special/Full Art Energy: Always Holo
        variants.push('holo');
      } else {
        // Basic Energy: Normal, Reverse Holo only
        variants.push('normal', 'reverse_holo');
      }
    }
  }
  // PRISMATIC EVOLUTIONS RULES
  else if (isPrismaticEvolutions) {
    // Cards over 131 are secret rares - always holo only
    if (cardNumber > 131) {
      variants.push('holo');
    } else if (isPokemon) {
      // Pokémon (except ex and ACE SPEC): Normal, Reverse Holo, Poké Ball, Master Ball
      if (!rarity.includes('ex') && !isAceSpec) {
        variants.push('normal', 'reverse_holo', 'pokeball_pattern', 'masterball_pattern');
      } else {
        // ex and ACE SPEC cards: Normal, Reverse Holo, Poké Ball - NO Master Ball
        variants.push('normal', 'reverse_holo', 'pokeball_pattern');
      }
    } else if (isTrainer || isEnergy) {
      // Trainer and Basic Energy: Normal, Reverse Holo, Poké Ball - NO Master Ball
      variants.push('normal', 'reverse_holo', 'pokeball_pattern');
    }
  }
  // BLACK BOLT & WHITE FLARE RULES
  else if (isBlackBolt || isWhiteFlare) {
    // Cards over 86 are secret rares - always holo only
    if (cardNumber > 86) {
      variants.push('holo');
    } else if (isPokemon && (isCommon || isUncommon || isRare || isHoloRare)) {
      // Pokémon (Rare and lower): Normal, Reverse Holo, Poké Ball, Master Ball
      variants.push('normal', 'reverse_holo', 'pokeball_pattern', 'masterball_pattern');
    } else if (isTrainer) {
      // Trainer: Normal, Reverse Holo, Poké Ball - NO Master Ball
      variants.push('normal', 'reverse_holo', 'pokeball_pattern');
    } else if (isEnergy && !isSpecialEnergy) {
      // Basic Energy: Normal, Reverse Holo - NO patterns
      variants.push('normal', 'reverse_holo');
    } else if (isUltraRare || isSpecialIllustration || isSecretRare || isSpecialEnergy) {
      // Ultra rare cards: always holo only
      variants.push('holo');
    }
  }
  // CELEBRATIONS RULES
  else if (isCelebrations) {
    // Celebrations is a special reprint set - cards were NOT printed with reverse holo variants
    // All cards in Celebrations should only have their original variant (typically holo for most reprints)
    if (isUltraRare || isSpecialIllustration || isSecretRare || isAceSpec ||
        rarity.includes('ex') || rarity.includes('EX') ||
        isHoloRare || (isPokemon && isRare)) {
      // Most Celebrations cards are special reprints that only come in holo
      variants.push('holo');
    } else if (isTrainer && (isCommon || isUncommon)) {
      // Basic trainers might have normal variant
      variants.push('normal');
    } else if (isEnergy && !isSpecialEnergy) {
      // Basic energy cards
      variants.push('normal');
    } else {
      // Default for any other Celebrations cards
      variants.push('holo');
    }
  }
  
  // Fallback: if no variants determined, provide default
  if (variants.length === 0) {
    if (isUltraRare || isSpecialIllustration || isSecretRare || isAceSpec || isSpecialEnergy) {
      variants.push('holo');
    } else {
      variants.push('normal');
    }
  }
  
  
  return variants;
};