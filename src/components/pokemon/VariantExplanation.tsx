'use client';

import React from 'react';
import { CardVariant } from '@/types/pokemon';

interface VariantExplanationProps {
  availableVariants: CardVariant[];
  className?: string;
}

export const VariantExplanation: React.FC<VariantExplanationProps> = ({
  availableVariants,
  className = '',
}) => {
  const getVariantInfo = (variant: CardVariant) => {
    switch (variant) {
      case 'normal':
        return {
          label: 'Normal',
          description: 'Non-holo version',
          colorClass: 'normal-btn',
        };
      case 'holo':
        return {
          label: 'Holo',
          description: 'Holographic version',
          colorClass: 'holo-btn',
        };
      case 'reverse_holo':
        return {
          label: 'Reverse Holo',
          description: 'Reverse holographic',
          colorClass: 'reverse-holo-btn',
        };
      case 'pokeball_pattern':
        return {
          label: 'Pokeball Pattern',
          description: 'Special pokeball pattern',
          colorClass: 'pokeball-btn',
        };
      case 'masterball_pattern':
        return {
          label: 'Masterball Pattern',
          description: 'Special masterball pattern',
          colorClass: 'masterball-btn',
        };
      case '1st_edition':
        return {
          label: '1st Edition',
          description: '1st Edition cards from WotC and E-Card eras',
          colorClass: 'first-edition-btn',
        };
      default:
        return {
          label: variant,
          description: variant,
          colorClass: 'normal-btn',
        };
    }
  };

  if (availableVariants.length <= 1) {
    return null; // Don't show explanation if only one variant
  }

  return (
    <div className={`variant-explanation ${className}`}>
      <div className="flex items-center gap-4 text-sm text-gray-300">
        <span className="font-medium">Variant Colors:</span>
        <div className="flex items-center gap-3 flex-wrap">
          {availableVariants.map((variant) => {
            const info = getVariantInfo(variant);
            return (
              <div key={variant} className="flex items-center gap-1.5">
                <div
                  className={`variant-color-indicator ${info.colorClass}`}
                  title={info.description}
                />
                <span className="text-xs">{info.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Helper function to get all unique variants from a set of cards
export const getSetVariants = (cards: any[]): CardVariant[] => {
  const variantSet = new Set<CardVariant>();
  
  cards.forEach((card) => {
    const cardVariants = card.availableVariants || ['normal'];
    cardVariants.forEach((variant: CardVariant) => {
      variantSet.add(variant);
    });
  });
  
  // Return variants in a logical order
  const orderedVariants: CardVariant[] = [];
  const variantOrder: CardVariant[] = [
    'normal',
    'holo',
    'reverse_holo',
    'pokeball_pattern',
    'masterball_pattern',
    '1st_edition'
  ];
  
  variantOrder.forEach((variant) => {
    if (variantSet.has(variant)) {
      orderedVariants.push(variant);
    }
  });
  
  return orderedVariants;
};