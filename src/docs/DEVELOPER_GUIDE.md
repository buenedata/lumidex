# Lumidex Developer Guide

## Getting Started with the New Architecture

This guide provides practical examples and best practices for working with Lumidex's new architecture. Whether you're a new team member or transitioning from the old codebase, this guide will help you be productive quickly.

## Quick Start

### 1. Understanding the Structure

```
src/
├── types/              # Domain types and contracts
├── lib/
│   ├── repositories/   # Data access layer
│   ├── services/       # Business logic layer
│   ├── state/          # State management
│   └── dev-tools/      # Development utilities
├── components/
│   └── patterns/       # Reusable component patterns
└── docs/              # Documentation
```

### 2. Essential Imports

```typescript
// Types
import type { User, Card, Collection } from '@/types'

// Services
import { UserService } from '@/lib/services/user-service'

// State management
import { useAppStore } from '@/lib/state/app-store'

// Component patterns
import { DataList, LoadingWrapper, ErrorBoundary } from '@/components/patterns'
```

## Working with Types

### Domain Types
Use domain-specific types for better organization:

```typescript
// Good - specific domain types
import type { 
  User, 
  UserProfile, 
  UpdateUserProfileInput 
} from '@/types/domains/user'

// Avoid - generic or mixed types
import type { User } from '@/types/database'
```

### API Contracts
Use standardized API contracts for all external communication:

```typescript
import type { 
  ApiResponse, 
  PaginatedResponse,
  ApiError 
} from '@/types/api/contracts'

// Service method return type
async getUsers(): Promise<ApiResponse<User[]>> {
  // Implementation
}
```

### Type Validation
Use runtime type validation for external data:

```typescript
import { validateApiContract, LumidexContracts } from '@/lib/dev-tools'

const validateUser = (data: unknown) => {
  return validateApiContract(data, LumidexContracts.getUserProfile)
}
```

## Working with Services

### Creating a New Service

1. **Define the service interface:**
```typescript
// src/lib/services/example-service.ts
export class ExampleService {
  constructor(
    private repository: ExampleRepository,
    private cache?: CacheManager
  ) {}

  async getAll(): Promise<Example[]> {
    return this.repository.findAll()
  }
}
```

2. **Register with dependency injection:**
```typescript
// src/lib/core/service-registry.ts
export const serviceRegistry = {
  // ... other services
  exampleService: () => new ExampleService(
    new ExampleRepository(),
    new CacheManager()
  )
}
```

### Service Best Practices

```typescript
export class UserService {
  // ✅ Good - dependency injection
  constructor(
    private userRepository: UserRepository,
    private cacheManager: CacheManager
  ) {}

  // ✅ Good - clear method names
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    // ✅ Good - caching strategy
    const cached = await this.cacheManager.get(`user:${userId}`)
    if (cached) return cached

    // ✅ Good - error handling
    try {
      const user = await this.userRepository.findById(userId)
      if (user) {
        await this.cacheManager.set(`user:${userId}`, user)
      }
      return user
    } catch (error) {
      // ✅ Good - proper error logging
      console.error('Failed to get user profile:', error)
      throw new ServiceError('Unable to fetch user profile', error)
    }
  }

  // ❌ Avoid - direct database calls
  async getBadExample(userId: string) {
    const { data } = await supabase.from('users').select('*').eq('id', userId)
    return data
  }
}
```

## Working with Repositories

### Creating a Repository

```typescript
// src/lib/repositories/example-repository.ts
import { BaseRepository } from '@/lib/core/repository'
import type { Example, CreateExampleInput } from '@/types'

export class ExampleRepository extends BaseRepository<Example> {
  protected tableName = 'examples'

  async findByCustomField(value: string): Promise<Example[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('custom_field', value)

      if (error) throw error
      return data || []
    } catch (error) {
      this.handleError('findByCustomField', error)
      throw error
    }
  }
}
```

### Repository Best Practices

```typescript
export class CardRepository extends BaseRepository<Card> {
  // ✅ Good - consistent error handling
  async findBySet(setName: string): Promise<Card[]> {
    try {
      const { data, error } = await this.supabase
        .from(this.tableName)
        .select('*')
        .eq('set_name', setName)
        .order('card_number')

      if (error) throw error
      return data || []
    } catch (error) {
      // Base class handles logging
      this.handleError('findBySet', error)
      throw error
    }
  }

  // ✅ Good - input validation
  async create(input: CreateCardInput): Promise<Card> {
    this.validateInput(input, ['name', 'set_name', 'card_number'])
    
    return super.create(input)
  }

  // ❌ Avoid - missing error handling
  async badExample(id: string) {
    const { data } = await this.supabase.from('cards').select('*').eq('id', id)
    return data[0] // Could throw if data is null
  }
}
```

## State Management

### Using the App Store

```typescript
import { useAppStore } from '@/lib/state/app-store'

const Component = () => {
  // ✅ Good - select only needed state
  const { user, isAuthenticated } = useAppStore(state => ({
    user: state.auth.user,
    isAuthenticated: state.auth.isAuthenticated
  }))

  // ✅ Good - use store actions
  const { login, logout } = useAppStore(state => state.auth.actions)

  // ❌ Avoid - selecting entire state
  const store = useAppStore(state => state)

  return (
    <div>
      {isAuthenticated ? (
        <button onClick={logout}>Logout {user?.name}</button>
      ) : (
        <button onClick={() => login('email', 'password')}>Login</button>
      )}
    </div>
  )
}
```

### Creating Store Slices

```typescript
// src/lib/state/slices/example-slice.ts
import type { StateCreator } from 'zustand'
import type { AppStore } from '../app-store'

export interface ExampleSlice {
  items: Example[]
  loading: boolean
  error: string | null
  actions: {
    fetchItems: () => Promise<void>
    addItem: (item: CreateExampleInput) => Promise<void>
    clearError: () => void
  }
}

export const createExampleSlice: StateCreator<
  AppStore,
  [],
  [],
  ExampleSlice
> = (set, get) => ({
  items: [],
  loading: false,
  error: null,
  actions: {
    fetchItems: async () => {
      set(state => ({ ...state.example, loading: true, error: null }))
      
      try {
        const service = new ExampleService()
        const items = await service.getAll()
        
        set(state => ({
          ...state.example,
          items,
          loading: false
        }))
      } catch (error) {
        set(state => ({
          ...state.example,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }))
      }
    },

    addItem: async (input) => {
      // Implementation
    },

    clearError: () => {
      set(state => ({ ...state.example, error: null }))
    }
  }
})
```

## Component Patterns

### Using Base Components

```typescript
import { Button, Card, Input, LoadingWrapper } from '@/components/patterns'

const UserForm = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Card padding="lg" shadow="md">
      <LoadingWrapper loading={loading} error={error}>
        <form>
          <Input
            label="Username"
            placeholder="Enter username"
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="Enter email"
            required
          />
          <Button
            type="submit"
            variant="primary"
            loading={loading}
          >
            Save User
          </Button>
        </form>
      </LoadingWrapper>
    </Card>
  )
}
```

### Using Compound Components

```typescript
import { DataList, Modal, Form } from '@/components/patterns'

const UserList = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <DataList loading={loading} error={error} data={users}>
      <DataList.Header>
        <h2>Users</h2>
        <DataList.Actions>
          <Button onClick={() => setShowModal(true)}>
            Add User
          </Button>
        </DataList.Actions>
      </DataList.Header>

      <DataList.Content>
        {users.map(user => (
          <DataList.Item 
            key={user.id}
            onClick={() => navigateToUser(user.id)}
          >
            <div className="flex items-center justify-between">
              <span>{user.name}</span>
              <span className="text-gray-500">{user.email}</span>
            </div>
          </DataList.Item>
        ))}
      </DataList.Content>
    </DataList>
  )
}
```

### Error Handling

```typescript
import { ErrorBoundary, InlineError } from '@/components/patterns'

const App = () => (
  <ErrorBoundary
    fallback={(error, errorInfo, retry) => (
      <div className="text-center p-8">
        <h2>Something went wrong</h2>
        <Button onClick={retry}>Try Again</Button>
      </div>
    )}
  >
    <UserList />
  </ErrorBoundary>
)

const FormField = ({ error }: { error?: string }) => (
  <div>
    <Input />
    <InlineError error={error} />
  </div>
)
```

## Custom Hooks

### Data Fetching Hook

```typescript
import { useState, useEffect, useCallback } from 'react'
import { UserService } from '@/lib/services/user-service'

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const userService = new UserService()

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await userService.getAll()
      setUsers(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [userService])

  const createUser = useCallback(async (input: CreateUserInput) => {
    setLoading(true)
    setError(null)
    
    try {
      const newUser = await userService.create(input)
      setUsers(prev => [...prev, newUser])
      return newUser
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [userService])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    createUser
  }
}
```

### Using the Hook

```typescript
const UserManagement = () => {
  const { users, loading, error, refetch, createUser } = useUsers()

  const handleCreateUser = async (userData: CreateUserInput) => {
    try {
      await createUser(userData)
      // User automatically added to list
    } catch (error) {
      // Error is handled by the hook
      console.error('Failed to create user:', error)
    }
  }

  if (loading) return <LoadingSpinner />
  if (error) return <InlineError error={error} />

  return (
    <div>
      <UserForm onSubmit={handleCreateUser} />
      <UserList users={users} />
    </div>
  )
}
```

## Testing

### Testing Services

```typescript
import { UserService } from '@/lib/services/user-service'
import { createMockRepository } from '@/lib/dev-tools'

describe('UserService', () => {
  let userService: UserService
  let mockRepository: ReturnType<typeof createMockRepository>

  beforeEach(() => {
    mockRepository = createMockRepository([
      { id: '1', name: 'John Doe', email: 'john@example.com' }
    ])
    userService = new UserService(mockRepository as any)
  })

  it('should get user by id', async () => {
    const user = await userService.getUserById('1')
    
    expect(user).toEqual({
      id: '1',
      name: 'John Doe',
      email: 'john@example.com'
    })
  })
})
```

### Testing Components

```typescript
import { render, screen } from '@testing-library/react'
import { UserList } from './UserList'
import { TestDataFactory } from '@/lib/dev-tools'

describe('UserList', () => {
  it('should render users', () => {
    const users = TestDataFactory.getInstance().createMany(
      () => TestDataFactory.getInstance().createUser(),
      3
    )

    render(<UserList users={users} />)
    
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })
})
```

## Development Tools

### Performance Monitoring

```typescript
import { usePerformanceTracker } from '@/lib/dev-tools/performance'

const ExpensiveComponent = () => {
  const { renderCount } = usePerformanceTracker('ExpensiveComponent')

  // Component implementation
  
  return <div>Render count: {renderCount}</div>
}
```

### Debug Logging

```typescript
import { DebugLogger } from '@/lib/dev-tools'

const MyService = () => {
  const logger = DebugLogger.getInstance()

  const processData = async (data: any) => {
    logger.log('Processing data', { dataSize: data.length })
    
    try {
      // Process data
      logger.log('Data processed successfully')
    } catch (error) {
      logger.error('Failed to process data', error)
      throw error
    }
  }
}
```

### Migration Tools

```typescript
import { MigrationRunner, createMigration } from '@/lib/dev-tools'

// Register a migration
const migration = createMigration({
  id: 'update-user-schema',
  name: 'Update User Schema',
  description: 'Add new fields to user table',
  version: '1.1.0',
  execute: async () => {
    // Migration logic
  },
  rollback: async () => {
    // Rollback logic
  }
})

MigrationRunner.getInstance().registerMigration(migration)
```

## Best Practices

### 1. Code Organization
- Group related functionality in services
- Keep components focused on presentation
- Use TypeScript strictly
- Follow consistent naming conventions

### 2. Error Handling
- Always handle errors at the repository level
- Provide meaningful error messages
- Use error boundaries for UI protection
- Log errors for debugging

### 3. Performance
- Use React.memo for expensive components
- Implement proper caching strategies
- Monitor performance with dev tools
- Optimize bundle size

### 4. Testing
- Test business logic in services
- Mock repositories for isolated testing
- Use test data factories
- Test error scenarios

### 5. Type Safety
- Use specific types over generic ones
- Validate external data
- Leverage TypeScript's strict mode
- Document complex types

## Common Patterns

### 1. Data Loading Pattern
```typescript
const useDataLoader = <T>(
  loader: () => Promise<T>,
  dependencies: any[] = []
) => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const result = await loader()
        setData(result)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, dependencies)

  return { data, loading, error }
}
```

### 2. Form Handling Pattern
```typescript
const useFormHandler = <T>(
  initialValues: T,
  onSubmit: (values: T) => Promise<void>
) => {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})

    try {
      await onSubmit(values)
    } catch (error) {
      if (error instanceof ValidationError) {
        setErrors(error.errors)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return {
    values,
    setValues,
    errors,
    submitting,
    handleSubmit
  }
}
```

## Troubleshooting

### Common Issues

1. **TypeScript Errors**
   - Check import paths
   - Verify type definitions
   - Update type exports

2. **Service Not Found**
   - Check service registration
   - Verify import paths
   - Check dependency injection

3. **State Not Updating**
   - Check store selectors
   - Verify action calls
   - Check for immutability issues

4. **Performance Issues**
   - Use performance monitoring tools
   - Check for unnecessary re-renders
   - Optimize large lists with virtualization

### Getting Help

- Check the architecture documentation
- Use development tools for debugging
- Review component patterns
- Consult the migration strategy

This guide should help you work effectively with Lumidex's new architecture. As you become more familiar with the patterns, you'll find development becomes more predictable and enjoyable.