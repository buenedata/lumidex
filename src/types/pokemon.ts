export interface PokemonCard {
  id: string;
  name: string;
  number: string;
  set: {
    id: string;
    name: string;
    releaseDate: string;
  };
  rarity: string;
  types: string[];
  images: {
    small: string;
    large: string;
  };
  cardmarket?: {
    prices: {
      averageSellPrice: number;
      lowPrice: number;
      trendPrice: number;
    };
  };
  availableVariants?: CardVariant[];
}

export interface CardCollectionData {
  cardId: string;
  userId: string;
  normal: number;              // Yellow - Normal/Non-holo cards
  holo: number;                // Purple - Holo cards
  reverseHolo: number;         // Blue - Reverse holo cards
  pokeballPattern: number;     // Pink - Pokeball pattern cards
  masterballPattern: number;   // Red - Masterball pattern cards
  firstEdition: number;        // Green - 1st Edition cards
  totalQuantity: number;
  dateAdded: string;
  lastUpdated: string;
}

export type CardVariant = 'normal' | 'holo' | 'reverse_holo' | 'pokeball_pattern' | 'masterball_pattern' | '1st_edition';

export interface CollectionButtonProps {
  card: PokemonCard;
  collectionData?: CardCollectionData;
  onToggleCollection: (cardId: string) => void;
  onAddVariant: (cardId: string, variant: CardVariant) => void;
  onRemoveVariant: (cardId: string, variant: CardVariant) => void;
  loading?: boolean;
}

export interface PokemonCardProps {
  card: PokemonCard;
  collectionData?: CardCollectionData;
  onToggleCollection: (cardId: string) => void;
  onAddVariant: (cardId: string, variant: CardVariant) => void;
  onRemoveVariant: (cardId: string, variant: CardVariant) => void;
  onViewDetails?: (cardId: string) => void;
  currency?: string;
  loading?: boolean;
  selected?: boolean;
  disabled?: boolean;
  showVariants?: boolean;
}