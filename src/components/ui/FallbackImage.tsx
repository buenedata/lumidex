'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';

interface FallbackImageProps {
  src: string;
  alt: string;
  fallbackSrc?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  loading?: 'eager' | 'lazy';
  onLoad?: () => void;
  onError?: () => void;
  style?: React.CSSProperties;
}

// Generate alternative image URLs for Pokemon cards
const generateFallbackUrls = (originalSrc: string): string[] => {
  const fallbacks: string[] = [];
  
  // If it's a Pokemon TCG API URL, try different variations
  if (originalSrc.includes('images.pokemontcg.io')) {
    // Extract set and card number from URL
    const hiresMatch = originalSrc.match(/images\.pokemontcg\.io\/([^\/]+)\/([^_]+)(_hires)?\.jpg/);
    const smallMatch = originalSrc.match(/images\.pokemontcg\.io\/([^\/]+)\/([^_]+)(_small)?\.jpg/);
    
    const match = hiresMatch || smallMatch;
    if (match) {
      const [, setId, cardNumber] = match;
      
      // For small images, try these fallbacks
      if (originalSrc.includes('_small')) {
        fallbacks.push(
          // Try without _small suffix
          `https://images.pokemontcg.io/${setId}/${cardNumber}.jpg`,
          // Try PNG format
          `https://images.pokemontcg.io/${setId}/${cardNumber}.png`,
          `https://images.pokemontcg.io/${setId}/${cardNumber}_small.png`,
          // Try alternative CDN (if exists)
          `https://cdn.pokemontcg.io/images/${setId}/${cardNumber}.jpg`,
          `https://cdn.pokemontcg.io/images/${setId}/${cardNumber}_small.jpg`
        );
      } else {
        // For hires images, try these fallbacks
        fallbacks.push(
          // Try without _hires suffix
          `https://images.pokemontcg.io/${setId}/${cardNumber}.jpg`,
          // Try with different resolution
          `https://images.pokemontcg.io/${setId}/${cardNumber}_lores.jpg`,
          // Try small version as fallback
          `https://images.pokemontcg.io/${setId}/${cardNumber}_small.jpg`,
          // Try PNG format
          `https://images.pokemontcg.io/${setId}/${cardNumber}.png`,
          `https://images.pokemontcg.io/${setId}/${cardNumber}_hires.png`,
          // Try alternative CDN (if exists)
          `https://cdn.pokemontcg.io/images/${setId}/${cardNumber}.jpg`,
          `https://cdn.pokemontcg.io/images/${setId}/${cardNumber}_hires.jpg`
        );
      }
    }
  }
  
  return fallbacks;
};

export const FallbackImage: React.FC<FallbackImageProps> = ({
  src,
  alt,
  fallbackSrc = '/placeholder-card.png',
  width,
  height,
  fill = false,
  className = '',
  sizes,
  priority = false,
  loading = 'lazy',
  onLoad,
  onError,
  style,
}) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [fallbackIndex, setFallbackIndex] = useState(-1);
  const [fallbackUrls] = useState(() => generateFallbackUrls(src));
  const [hasError, setHasError] = useState(false);

  // Reset when src changes
  useEffect(() => {
    setImageSrc(src);
    setFallbackIndex(-1);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    const nextIndex = fallbackIndex + 1;
    
    if (nextIndex < fallbackUrls.length) {
      // Try next fallback URL
      setFallbackIndex(nextIndex);
      setImageSrc(fallbackUrls[nextIndex]);
    } else if (imageSrc !== fallbackSrc) {
      // All fallbacks failed, use placeholder
      setHasError(true);
      setImageSrc(fallbackSrc);
      if (onError) {
        onError();
      }
    }
  };

  const handleLoad = () => {
    if (onLoad) {
      onLoad();
    }
  };

  // Common props for both fill and sized images
  const commonProps = {
    src: imageSrc,
    alt,
    className: `${className} ${hasError ? 'fallback-image' : ''}`,
    onError: handleError,
    onLoad: handleLoad,
    style,
    // Only use priority OR loading, not both
    ...(priority ? { priority: true } : { loading }),
  };

  if (fill) {
    return (
      <Image
        {...commonProps}
        fill
        sizes={sizes}
      />
    );
  }

  return (
    <Image
      {...commonProps}
      width={width}
      height={height}
      sizes={sizes}
    />
  );
};

export default FallbackImage;