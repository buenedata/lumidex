# Type System Migration Guide

This guide helps migrate from the old fragmented type system to the new unified domain-based architecture.

## Overview

The new type system is organized into clear domains:
- **Core**: Common utilities and base types
- **User**: User profiles, preferences, and statistics  
- **Card**: Pokemon cards, sets, pricing, and variants
- **Collection**: User collections and collection management
- **Social**: Friends, trading, and social interactions
- **Wishlist**: Wishlist management and tracking
- **API**: Standardized request/response contracts
- **UI**: Component state and form management

## Migration Steps

### 1. Update Imports

**Old way:**
```typescript
import { Profile, Card, Set, UserCollection } from '@/types'
import { PokemonCard } from '@/types/pokemon'
import { LoadingState } from '@/types/index'
```

**New way:**
```typescript
import { User, PokemonCard, PokemonSet, UserCollectionEntry } from '@/types'
import { LoadingState, ApiResponse } from '@/types'
```

### 2. Type Name Changes

| Old Type | New Type | Location |
|----------|----------|----------|
| `Profile` | `User` | `domains/user` |
| `Card` | `PokemonCard` | `domains/card` |
| `Set` | `PokemonSet` | `domains/card` |
| `UserCollection` | `UserCollectionEntry` | `domains/collection` |
| `Friendship` | `Friend` | `domains/social` |

### 3. Service Integration

**Old service pattern:**
```typescript
async getProfile(userId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  // inconsistent response format
}
```

**New service pattern:**
```typescript
async getProfile(userId: string): Promise<UserAPI.GetProfileResponse> {
  // standardized API contract
}
```

### 4. Form State Management

**Old way:**
```typescript
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string>()
const [data, setData] = useState()
```

**New way:**
```typescript
const formState = useForm<UserProfileForm>({
  initialValues: defaultValues,
  validation: schema
})
```

### 5. Component Props

**Old way:**
```typescript
interface CardProps {
  card: any // unclear structure
  onToggle?: (id: string) => void
  loading?: boolean
}
```

**New way:**
```typescript
interface CardProps extends BaseComponentProps {
  card: PokemonCard
  collectionData?: CardCollectionData
  onToggleCollection: (cardId: string) => void
}
```

## Domain-Specific Changes

### User Domain

```typescript
// Old
import { Profile, ProfileForm } from '@/types'

// New
import { User, UserProfileForm, UserStats } from '@/types'

// Usage
const updateProfile = async (data: UserProfileForm): Promise<UserAPI.UpdateProfileResponse> => {
  // Type-safe API call
}
```

### Card Domain

```typescript
// Old
import { Card, Set } from '@/types'
import { PokemonCard } from '@/types/pokemon'

// New
import { PokemonCard, PokemonSet, CardFilters } from '@/types'

// Usage
const searchCards = async (filters: CardFilters): Promise<CardsAPI.GetCardsResponse> => {
  // Standardized filtering
}
```

### Collection Domain

```typescript
// Old
import { UserCollection, CollectionStats } from '@/types'

// New
import { UserCollectionEntry, CollectionStats, CollectionQuery } from '@/types'

// Usage
const getCollection = async (query: CollectionQuery): Promise<CollectionAPI.GetCollectionResponse> => {
  // Type-safe collection queries
}
```

## Backwards Compatibility

The new type system maintains backwards compatibility through legacy type aliases:

```typescript
// These still work but are deprecated
type Profile = User              // ✅ Works
type Card = PokemonCard         // ✅ Works
type Set = PokemonSet           // ✅ Works
type UserCollection = UserCollectionEntry // ✅ Works
```

## Migration Priority

1. **High Priority**: Services and API calls
2. **Medium Priority**: Component props and state
3. **Low Priority**: Internal component logic

## Common Patterns

### API Response Handling

**Old:**
```typescript
const result = await profileService.getProfile(userId)
if (result.success) {
  setProfile(result.data)
} else {
  setError(result.error)
}
```

**New:**
```typescript
const response: UserAPI.GetProfileResponse = await userRepository.getProfile(userId)
if (response.success) {
  setProfile(response.data.user)
} else {
  setError(response.error)
}
```

### Form Validation

**Old:**
```typescript
const [errors, setErrors] = useState<Record<string, string>>({})
const validate = (data: any) => {
  // Manual validation logic
}
```

**New:**
```typescript
const form = useForm<UserProfileForm>({
  schema: userProfileSchema,
  onSubmit: handleSubmit
})
```

### Modal State

**Old:**
```typescript
const [isOpen, setIsOpen] = useState(false)
const [modalData, setModalData] = useState()
const [loading, setLoading] = useState(false)
```

**New:**
```typescript
const modal = useModal<CardDetailsModalState>()
```

## Testing Changes

Update tests to use new types:

```typescript
// Old
const mockCard: any = { id: '1', name: 'Pikachu' }

// New
const mockCard: PokemonCard = {
  id: '1',
  name: 'Pikachu',
  set_id: 'base1',
  number: '25',
  rarity: 'Common',
  types: ['Lightning'],
  image_small: '',
  image_large: '',
  cardmarket: {},
  tcgplayer: {},
  created_at: '',
  updated_at: ''
}
```

## Performance Benefits

1. **Tree Shaking**: Import only needed types
2. **Type Safety**: Catch errors at compile time
3. **IntelliSense**: Better autocomplete and documentation
4. **Bundle Size**: Reduced runtime overhead

## Questions & Support

- Check existing type definitions in domain files
- Use TypeScript strict mode for better error catching
- Leverage IDE type checking and autocomplete
- Refer to API contracts for service integration

## Timeline

- **Phase 1**: Core services migration (Week 1)
- **Phase 2**: Component prop updates (Week 2)  
- **Phase 3**: Form and state management (Week 3)
- **Phase 4**: Clean up legacy types (Week 4)