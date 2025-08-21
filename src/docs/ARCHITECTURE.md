# Lumidex Architecture Documentation

## Overview

This document describes the new architecture implemented for Lumidex, a Pokemon card collection tracking application. The architecture follows modern software engineering principles including Domain-Driven Design, Clean Architecture, and SOLID principles.

## Architecture Principles

### 1. Separation of Concerns
- **Domain Layer**: Business logic and domain models
- **Service Layer**: Application services and orchestration
- **Repository Layer**: Data access abstraction
- **Presentation Layer**: UI components and state management

### 2. Dependency Injection
- Services depend on abstractions, not concrete implementations
- Easy to test and swap implementations
- Clear dependency graph

### 3. Type Safety
- Comprehensive TypeScript types for all layers
- API contracts for external communication
- Runtime type validation where needed

### 4. Error Handling
- Consistent error handling across all layers
- Graceful degradation for non-critical failures
- User-friendly error messages

## Architecture Layers

### Domain Layer (`src/types/`)

The domain layer contains type definitions and domain models organized by business domain.

```
src/types/
├── core/
│   └── common.ts          # Shared utility types
├── domains/
│   ├── user.ts           # User domain types
│   ├── card.ts           # Pokemon card types
│   ├── collection.ts     # Collection management
│   ├── social.ts         # Trading and social features
│   └── wishlist.ts       # Wishlist functionality
├── api/
│   └── contracts.ts      # API request/response types
├── ui/
│   └── state.ts          # UI state management types
└── index.ts              # Unified exports
```

#### Key Features
- **Domain-based organization**: Types grouped by business domain
- **Backwards compatibility**: Maintains compatibility with existing code
- **Comprehensive coverage**: All data structures are typed
- **API contracts**: Standardized request/response interfaces

### Repository Layer (`src/lib/repositories/`)

The repository layer provides data access abstraction with consistent interfaces.

```
src/lib/repositories/
├── user-repository.ts        # User data access
├── card-repository.ts        # Card data with caching
├── collection-repository.ts  # Collection management
└── ...
```

#### Features
- **Abstract base class**: Common functionality in `BaseRepository`
- **Error handling**: Consistent error handling and logging
- **Caching**: Built-in caching for performance
- **Type safety**: Fully typed repository methods

#### Example Usage
```typescript
import { UserRepository } from '@/lib/repositories/user-repository'

const userRepo = new UserRepository()
const user = await userRepo.findById('user-id')
```

### Service Layer (`src/lib/services/`)

The service layer contains business logic and orchestrates repository operations.

```
src/lib/services/
├── user-service.ts              # User business logic
├── domain/
│   └── collection-domain-service.ts  # Complex domain operations
└── ...
```

#### Features
- **Business logic encapsulation**: Domain rules in services
- **Repository orchestration**: Coordinates multiple repositories
- **Transaction management**: Handles complex operations
- **Validation**: Input validation and business rule enforcement

#### Example Usage
```typescript
import { UserService } from '@/lib/services/user-service'

const userService = new UserService()
const profile = await userService.getUserProfile('user-id')
```

### State Management (`src/lib/state/`)

Unified state management using Zustand, replacing multiple React Context providers.

```
src/lib/state/
├── app-store.ts                 # Main application store
├── hooks/
│   └── use-app-initialization.ts # App initialization logic
└── ...
```

#### Features
- **Single store**: Replaces 8 separate context providers
- **Performance optimized**: Prevents unnecessary re-renders
- **DevTools integration**: Built-in debugging support
- **Type safety**: Fully typed store and selectors

#### Example Usage
```typescript
import { useAppStore } from '@/lib/state/app-store'

const Component = () => {
  const { user, isAuthenticated } = useAppStore(state => ({
    user: state.auth.user,
    isAuthenticated: state.auth.isAuthenticated
  }))
  
  return <div>{user?.name}</div>
}
```

### Component Patterns (`src/components/patterns/`)

Reusable component patterns and UI building blocks.

```
src/components/patterns/
├── base-components.tsx      # Foundational components
├── compound-components.tsx  # Complex reusable components
├── error-handling.tsx       # Error management components
├── loading-states.tsx       # Loading and async states
├── hooks.ts                # Custom hooks
└── index.ts                # Unified exports
```

#### Features
- **Consistent interfaces**: Standardized prop interfaces
- **Composition patterns**: Compound components for complex UI
- **Error boundaries**: Built-in error handling
- **Loading states**: Consistent async state management

#### Example Usage
```typescript
import { DataList, LoadingWrapper } from '@/components/patterns'

const UserList = () => (
  <DataList loading={isLoading} data={users} error={error}>
    <DataList.Header>
      <h2>Users</h2>
      <DataList.Actions>
        <Button>Add User</Button>
      </DataList.Actions>
    </DataList.Header>
    <DataList.Content>
      {users.map(user => (
        <DataList.Item key={user.id}>
          {user.name}
        </DataList.Item>
      ))}
    </DataList.Content>
  </DataList>
)
```

## Data Flow

### 1. User Interaction
```
User Action → Component → Service → Repository → Database
                ↓
        State Update → Re-render
```

### 2. Data Fetching
```
Component → Hook → Service → Repository → Cache/API → Response
              ↓
        State Update → UI Update
```

### 3. Error Handling
```
Error Occurs → Repository → Service → Component → Error Boundary → User Feedback
```

## Key Architectural Decisions

### 1. Repository Pattern
**Decision**: Use repository pattern for data access  
**Rationale**: 
- Abstracts data source details
- Enables easy testing with mock repositories
- Provides consistent interface for all data operations
- Allows caching and optimization without affecting business logic

### 2. Service Layer
**Decision**: Separate business logic into service layer  
**Rationale**:
- Keeps components focused on presentation
- Enables business logic reuse across components
- Facilitates testing of business rules
- Provides clear separation of concerns

### 3. Zustand for State Management
**Decision**: Replace React Context with Zustand  
**Rationale**:
- Better performance (fewer re-renders)
- Simpler API than Redux
- Built-in DevTools support
- Excellent TypeScript support

### 4. Domain-Driven Type Organization
**Decision**: Organize types by business domain  
**Rationale**:
- Reflects business structure
- Easier to maintain and understand
- Reduces coupling between unrelated domains
- Supports team ownership of domains

## Performance Considerations

### 1. Caching Strategy
- **Repository level**: Cache database queries
- **Service level**: Cache computed results
- **Component level**: React.memo for expensive renders

### 2. Code Splitting
- **Route level**: Lazy load pages
- **Component level**: Dynamic imports for heavy components
- **Service level**: Load services on demand

### 3. Bundle Optimization
- **Tree shaking**: Remove unused code
- **Minimal dependencies**: Avoid large libraries
- **Optimized builds**: Production build optimizations

## Testing Strategy

### 1. Unit Testing
- **Services**: Test business logic in isolation
- **Repositories**: Test data access patterns
- **Components**: Test rendering and interaction
- **Hooks**: Test custom hook behavior

### 2. Integration Testing
- **Service integration**: Test service layer coordination
- **API integration**: Test external API interactions
- **Store integration**: Test state management flows

### 3. End-to-End Testing
- **User workflows**: Test complete user journeys
- **Error scenarios**: Test error handling flows
- **Performance**: Test under realistic conditions

## Security Considerations

### 1. Type Safety
- Runtime validation of external data
- Strict TypeScript configuration
- API contract validation

### 2. Error Handling
- No sensitive data in error messages
- Proper error logging
- Graceful failure modes

### 3. Data Access
- Repository-level access controls
- Input sanitization
- SQL injection prevention

## Migration Benefits

### Before Migration
- 8 separate React Context providers
- Direct Supabase calls throughout components
- Inconsistent error handling
- Mixed concerns in components
- Limited type safety

### After Migration
- Single Zustand store
- Abstracted data access through repositories
- Consistent error handling patterns
- Clear separation of concerns
- Comprehensive type safety

### Performance Improvements
- **Reduced re-renders**: Zustand vs Context providers
- **Better caching**: Repository-level caching
- **Optimized bundles**: Better tree-shaking
- **Faster development**: Better TypeScript support

### Developer Experience Improvements
- **Better debugging**: DevTools integration
- **Easier testing**: Mock repositories and services
- **Clearer code structure**: Separation of concerns
- **Type safety**: Comprehensive TypeScript coverage

## Future Considerations

### 1. Microservices
The current architecture supports future migration to microservices:
- Services can be extracted to separate applications
- Repository interfaces can be implemented as HTTP clients
- Type contracts provide API boundaries

### 2. Offline Support
The architecture supports offline functionality:
- Repository layer can implement local storage
- Service layer can handle sync logic
- Store can manage offline state

### 3. Multi-tenant Architecture
The architecture can support multiple tenants:
- Repository layer can handle tenant isolation
- Service layer can enforce tenant-specific rules
- Type system can include tenant context

## Conclusion

The new Lumidex architecture provides a solid foundation for scalable, maintainable, and performant application development. The clear separation of concerns, comprehensive type safety, and modern patterns ensure the codebase will remain maintainable as the application grows.

The migration from the old architecture to this new structure improves both developer experience and application performance while maintaining all existing functionality.