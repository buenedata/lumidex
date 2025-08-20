'use client';

import React, { createContext, useContext, useState } from 'react';
import { WishlistSelectionModal } from '@/components/pokemon/WishlistSelectionModal';

interface WishlistModalContextType {
  openWishlistModal: (cardId: string, cardName: string, cardImage: string) => void;
  closeWishlistModal: () => void;
}

const WishlistModalContext = createContext<WishlistModalContextType | undefined>(undefined);

export const useWishlistModal = () => {
  const context = useContext(WishlistModalContext);
  if (!context) {
    throw new Error('useWishlistModal must be used within a WishlistModalProvider');
  }
  return context;
};

interface WishlistModalState {
  isOpen: boolean;
  cardId: string;
  cardName: string;
  cardImage: string;
}

export const WishlistModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<WishlistModalState>({
    isOpen: false,
    cardId: '',
    cardName: '',
    cardImage: ''
  });

  const openWishlistModal = (cardId: string, cardName: string, cardImage: string) => {
    setModalState({
      isOpen: true,
      cardId,
      cardName,
      cardImage
    });
  };

  const closeWishlistModal = () => {
    setModalState(prev => ({
      ...prev,
      isOpen: false
    }));
  };

  return (
    <WishlistModalContext.Provider value={{ openWishlistModal, closeWishlistModal }}>
      {children}
      
      {/* Global Wishlist Modal */}
      <WishlistSelectionModal
        isOpen={modalState.isOpen}
        onClose={closeWishlistModal}
        cardId={modalState.cardId}
        cardName={modalState.cardName}
        cardImage={modalState.cardImage}
      />
    </WishlistModalContext.Provider>
  );
};