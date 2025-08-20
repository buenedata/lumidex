'use client';

import React, { useState, useEffect, Fragment } from 'react';
import { Dialog, Transition, Listbox } from '@headlessui/react';
import { Star, Plus, X, List, Heart, Check, ChevronsUpDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { wishlistService } from '@/lib/wishlist-service';
import { wishlistListsService, WishlistList } from '@/lib/wishlist-lists-service';
import { useToast } from '@/components/ui/ToastContainer';
import { usePreferredCurrency } from '@/contexts/UserPreferencesContext';
import { currencyService, convertToEuros } from '@/lib/currency-service';

interface WishlistSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardId: string;
  cardName: string;
  cardImage: string;
}

interface WishlistOption {
  id: string;
  name: string;
  description?: string;
  itemCount: number;
  isDefault: boolean;
}

const PRIORITY_OPTIONS = [
  { id: 1, name: '1 - Highest', color: 'text-red-400' },
  { id: 2, name: '2 - High', color: 'text-orange-400' },
  { id: 3, name: '3 - Medium', color: 'text-yellow-400' },
  { id: 4, name: '4 - Low', color: 'text-blue-400' },
  { id: 5, name: '5 - Lowest', color: 'text-gray-400' }
];

const CONDITION_OPTIONS = [
  { id: 'any', name: 'Any Condition' },
  { id: 'mint', name: 'Mint' },
  { id: 'near_mint', name: 'Near Mint' },
  { id: 'lightly_played', name: 'Lightly Played' },
  { id: 'moderately_played', name: 'Moderately Played' }
];

export const WishlistSelectionModal: React.FC<WishlistSelectionModalProps> = ({
  isOpen,
  onClose,
  cardId,
  cardName,
  cardImage
}) => {
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();
  const preferredCurrency = usePreferredCurrency();
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [wishlists, setWishlists] = useState<WishlistOption[]>([]);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [selectedPriority, setSelectedPriority] = useState(PRIORITY_OPTIONS[2]); // Default to Medium
  const [maxPrice, setMaxPrice] = useState('');
  const [selectedCondition, setSelectedCondition] = useState(CONDITION_OPTIONS[0]); // Default to Any
  const [notes, setNotes] = useState('');

  // Get currency symbol for display
  const currencySymbol = currencyService.getCurrencySymbol(preferredCurrency);

  useEffect(() => {
    if (isOpen && user) {
      loadWishlists();
    }
  }, [isOpen, user]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const loadWishlists = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load actual wishlist lists from the database
      const result = await wishlistListsService.getUserWishlistLists(user.id, true);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load wishlists');
      }

      const lists = result.data || [];
      
      // Convert to WishlistOption format
      const wishlistOptions: WishlistOption[] = lists.map(list => ({
        id: list.id,
        name: list.name,
        description: list.description || undefined,
        itemCount: list.item_count || 0,
        isDefault: list.is_default
      }));

      // If no lists exist, create a default one
      if (wishlistOptions.length === 0) {
        const createResult = await wishlistListsService.createWishlistList(user.id, {
          name: 'My Wishlist',
          description: 'Your main wishlist'
        });
        
        if (createResult.success && createResult.data) {
          wishlistOptions.push({
            id: createResult.data.id,
            name: createResult.data.name,
            description: createResult.data.description || undefined,
            itemCount: 0,
            isDefault: createResult.data.is_default
          });
        }
      }

      setWishlists(wishlistOptions);
    } catch (error) {
      console.error('Error loading wishlists:', error);
      showError('Failed to load wishlists', 'Please try again later');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWishlist = async (wishlistId: string) => {
    if (!user) return;

    setAdding(true);
    try {
      // Convert price from user's preferred currency to EUR for storage
      let maxPriceEur: number | undefined;
      if (maxPrice) {
        const priceValue = parseFloat(maxPrice);
        if (preferredCurrency === 'EUR') {
          maxPriceEur = priceValue;
        } else {
          maxPriceEur = await convertToEuros(priceValue, preferredCurrency);
        }
      }

      const result = await wishlistListsService.addCardToWishlistList(wishlistId, cardId, {
        priority: selectedPriority.id as 1 | 2 | 3 | 4 | 5,
        maxPriceEur,
        conditionPreference: selectedCondition.id as 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played',
        notes: notes || undefined
      });

      if (result.success) {
        showSuccess('Added to wishlist!', `${cardName} has been added to your wishlist`);
        onClose();
      } else {
        showError('Failed to add to wishlist', result.error || 'Please try again later');
      }
    } catch (error) {
      console.error('Error adding to wishlist:', error);
      showError('An error occurred', 'Please try again later');
    } finally {
      setAdding(false);
    }
  };

  const handleCreateNewList = async () => {
    if (!user || !newListName.trim()) {
      showError('Name required', 'Please enter a name for your new wishlist');
      return;
    }

    setAdding(true);
    try {
      const createResult = await wishlistListsService.createWishlistList(user.id, {
        name: newListName.trim(),
        description: newListDescription.trim() || undefined
      });

      if (!createResult.success || !createResult.data) {
        showError('Failed to create wishlist', createResult.error || 'Please try again later');
        return;
      }

      // Convert price from user's preferred currency to EUR for storage
      let maxPriceEur: number | undefined;
      if (maxPrice) {
        const priceValue = parseFloat(maxPrice);
        if (preferredCurrency === 'EUR') {
          maxPriceEur = priceValue;
        } else {
          maxPriceEur = await convertToEuros(priceValue, preferredCurrency);
        }
      }

      // Add the card to the new wishlist
      const addResult = await wishlistListsService.addCardToWishlistList(createResult.data.id, cardId, {
        priority: selectedPriority.id as 1 | 2 | 3 | 4 | 5,
        maxPriceEur,
        conditionPreference: selectedCondition.id as 'any' | 'mint' | 'near_mint' | 'lightly_played' | 'moderately_played',
        notes: notes || undefined
      });

      if (addResult.success) {
        showSuccess('Wishlist created!', `${cardName} has been added to "${newListName}"`);
        setNewListName('');
        setNewListDescription('');
        setShowCreateNew(false);
        onClose();
      } else {
        showError('Failed to add card', addResult.error || 'Please try again later');
      }
    } catch (error) {
      console.error('Error creating wishlist:', error);
      showError('An error occurred', 'Please try again later');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-pkmn-dark border border-gray-700/50 text-left align-middle shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-pokemon-gold/20 rounded-lg">
                      <Star className="w-6 h-6 text-pokemon-gold" />
                    </div>
                    <Dialog.Title className="text-xl font-semibold text-white">
                      Add to Wishlist
                    </Dialog.Title>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Card Preview */}
                <div className="p-6 border-b border-gray-700/50">
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <img
                        src={cardImage}
                        alt={cardName}
                        className="w-16 h-22 object-cover rounded-lg border border-gray-600"
                      />
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-pokemon-gold rounded-full flex items-center justify-center">
                        <Heart className="w-2.5 h-2.5 text-black" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white text-lg">{cardName}</h3>
                      <p className="text-sm text-gray-400">Select a wishlist and set your preferences</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {loading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pokemon-gold"></div>
                    </div>
                  ) : (
                    <>
                      {/* Wishlist Selection */}
                      <div className="space-y-4">
                        <h4 className="text-lg font-semibold text-white">Choose Wishlist</h4>
                        <div className="grid gap-3">
                          {wishlists.map((wishlist) => (
                            <button
                              key={wishlist.id}
                              onClick={() => handleAddToWishlist(wishlist.id)}
                              disabled={adding}
                              className="group relative p-4 border border-gray-600 rounded-xl hover:border-pokemon-gold hover:bg-pkmn-surface/50 transition-all duration-200 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="p-2 bg-pkmn-surface rounded-lg group-hover:bg-pokemon-gold/20 transition-colors">
                                    <List className="w-4 h-4 text-gray-400 group-hover:text-white" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-white group-hover:text-white transition-colors">
                                      {wishlist.name}
                                      {wishlist.isDefault && (
                                        <span className="ml-2 text-xs bg-pokemon-gold/20 text-pokemon-gold px-2 py-0.5 rounded-full">
                                          Default
                                        </span>
                                      )}
                                    </div>
                                    {wishlist.description && (
                                      <div className="text-sm text-gray-400">{wishlist.description}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-400">
                                  {wishlist.itemCount} {wishlist.itemCount === 1 ? 'item' : 'items'}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>

                        {/* Create New Wishlist Toggle */}
                        <button
                          onClick={() => setShowCreateNew(!showCreateNew)}
                          className="w-full p-4 border-2 border-dashed border-gray-600 rounded-xl hover:border-pokemon-gold hover:bg-pkmn-surface/30 transition-all duration-200 text-center group"
                        >
                          <div className="flex items-center justify-center space-x-2">
                            <Plus className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
                            <span className="text-gray-300 group-hover:text-white transition-colors font-medium">
                              Create New Wishlist
                            </span>
                          </div>
                        </button>

                        {/* Create New Wishlist Form */}
                        <Transition
                          show={showCreateNew}
                          as={Fragment}
                          enter="transition ease-out duration-200"
                          enterFrom="opacity-0 scale-95"
                          enterTo="opacity-100 scale-100"
                          leave="transition ease-in duration-150"
                          leaveFrom="opacity-100 scale-100"
                          leaveTo="opacity-0 scale-95"
                        >
                          <div className="p-6 bg-pkmn-surface/50 rounded-xl border border-gray-600 space-y-4">
                            <h5 className="font-semibold text-white">Create New Wishlist</h5>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Wishlist Name *
                                </label>
                                <input
                                  type="text"
                                  value={newListName}
                                  onChange={(e) => setNewListName(e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-600 rounded-lg bg-pkmn-dark text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-pokemon-gold transition-colors"
                                  placeholder="e.g., Vintage Cards, High Priority"
                                  maxLength={50}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                  Description (optional)
                                </label>
                                <input
                                  type="text"
                                  value={newListDescription}
                                  onChange={(e) => setNewListDescription(e.target.value)}
                                  className="w-full px-4 py-3 border border-gray-600 rounded-lg bg-pkmn-dark text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-pokemon-gold transition-colors"
                                  placeholder="Brief description of this wishlist"
                                  maxLength={100}
                                />
                              </div>
                              <div className="flex space-x-3">
                                <button
                                  onClick={handleCreateNewList}
                                  disabled={adding || !newListName.trim()}
                                  className="flex-1 bg-pokemon-gold text-black py-3 px-4 rounded-lg font-semibold hover:bg-pokemon-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {adding ? 'Creating...' : 'Create & Add Card'}
                                </button>
                                <button
                                  onClick={() => setShowCreateNew(false)}
                                  className="px-4 py-3 border border-gray-600 rounded-lg text-gray-300 hover:bg-pkmn-surface transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        </Transition>
                      </div>

                      {/* Wishlist Preferences */}
                      <div className="space-y-6 pt-6 border-t border-gray-700/50">
                        <h4 className="text-lg font-semibold text-white">Wishlist Preferences</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Priority Selection */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">
                              Priority Level
                            </label>
                            <Listbox value={selectedPriority} onChange={setSelectedPriority}>
                              <div className="relative">
                                <Listbox.Button className="relative w-full cursor-default rounded-lg bg-pkmn-surface border border-gray-600 py-3 pl-4 pr-10 text-left text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-pokemon-gold transition-colors">
                                  <span className={`block truncate font-medium ${selectedPriority.color}`}>
                                    {selectedPriority.name}
                                  </span>
                                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                    <ChevronsUpDown className="h-5 w-5 text-gray-400" />
                                  </span>
                                </Listbox.Button>
                                <Transition
                                  as={Fragment}
                                  leave="transition ease-in duration-100"
                                  leaveFrom="opacity-100"
                                  leaveTo="opacity-0"
                                >
                                  <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-pkmn-surface border border-gray-600 py-1 shadow-lg">
                                    {PRIORITY_OPTIONS.map((priority) => (
                                      <Listbox.Option
                                        key={priority.id}
                                        className={({ active }) =>
                                          `relative cursor-default select-none py-3 pl-4 pr-9 ${
                                            active ? 'bg-pokemon-gold/20 text-pokemon-gold' : 'text-white'
                                          }`
                                        }
                                        value={priority}
                                      >
                                        {({ selected }) => (
                                          <>
                                            <span className={`block truncate font-medium ${priority.color}`}>
                                              {priority.name}
                                            </span>
                                            {selected && (
                                              <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-pokemon-gold">
                                                <Check className="h-5 w-5" />
                                              </span>
                                            )}
                                          </>
                                        )}
                                      </Listbox.Option>
                                    ))}
                                  </Listbox.Options>
                                </Transition>
                              </div>
                            </Listbox>
                          </div>

                          {/* Max Price */}
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-3">
                              Max Price ({currencySymbol})
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={maxPrice}
                              onChange={(e) => setMaxPrice(e.target.value)}
                              className="w-full px-4 py-3 border border-gray-600 rounded-lg bg-pkmn-surface text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-pokemon-gold transition-colors"
                              placeholder={`No limit (${preferredCurrency})`}
                            />
                          </div>
                        </div>

                        {/* Condition Preference */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-3">
                            Condition Preference
                          </label>
                          <Listbox value={selectedCondition} onChange={setSelectedCondition}>
                            <div className="relative">
                              <Listbox.Button className="relative w-full cursor-default rounded-lg bg-pkmn-surface border border-gray-600 py-3 pl-4 pr-10 text-left text-white focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-pokemon-gold transition-colors">
                                <span className="block truncate font-medium">
                                  {selectedCondition.name}
                                </span>
                                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                  <ChevronsUpDown className="h-5 w-5 text-gray-400" />
                                </span>
                              </Listbox.Button>
                              <Transition
                                as={Fragment}
                                leave="transition ease-in duration-100"
                                leaveFrom="opacity-100"
                                leaveTo="opacity-0"
                              >
                                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-pkmn-surface border border-gray-600 py-1 shadow-lg">
                                  {CONDITION_OPTIONS.map((condition) => (
                                    <Listbox.Option
                                      key={condition.id}
                                      className={({ active }) =>
                                        `relative cursor-default select-none py-3 pl-4 pr-9 ${
                                          active ? 'bg-pokemon-gold/20 text-pokemon-gold' : 'text-white'
                                        }`
                                      }
                                      value={condition}
                                    >
                                      {({ selected }) => (
                                        <>
                                          <span className="block truncate font-medium">
                                            {condition.name}
                                          </span>
                                          {selected && (
                                            <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-pokemon-gold">
                                              <Check className="h-5 w-5" />
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </Listbox.Option>
                                  ))}
                                </Listbox.Options>
                              </Transition>
                            </div>
                          </Listbox>
                        </div>

                        {/* Notes */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-3">
                            Notes (optional)
                          </label>
                          <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-600 rounded-lg bg-pkmn-surface text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:border-pokemon-gold transition-colors resize-none"
                            rows={3}
                            placeholder="Any specific notes about this card..."
                            maxLength={200}
                          />
                          <div className="text-xs text-gray-500 mt-1 text-right">{notes.length}/200</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end space-x-3 p-6 border-t border-gray-700/50 bg-pkmn-surface/30">
                  <button
                    onClick={onClose}
                    className="px-6 py-3 border border-gray-600 rounded-lg text-gray-300 hover:bg-pkmn-surface hover:text-white transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};
