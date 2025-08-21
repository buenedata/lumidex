// Code generation utilities for creating boilerplate code

/**
 * Component generator for creating new React components
 */
export class ComponentGenerator {
  static generateFunctionalComponent(
    name: string,
    options: ComponentGeneratorOptions = {}
  ): string {
    const {
      props = [],
      useState = false,
      useEffect = false,
      typescript = true,
      styling = 'tailwind'
    } = options

    const imports = ['React']
    if (useState) imports.push('useState')
    if (useEffect) imports.push('useEffect')

    const propsInterface = typescript && props.length > 0
      ? `interface ${name}Props {\n${props.map(p => `  ${p.name}${p.optional ? '?' : ''}: ${p.type}`).join('\n')}\n}\n\n`
      : ''

    const propsParam = props.length > 0
      ? typescript 
        ? `{ ${props.map(p => p.name).join(', ')} }: ${name}Props`
        : `{ ${props.map(p => p.name).join(', ')} }`
      : ''

    return `import ${imports.join(', ')} from 'react'

${propsInterface}export const ${name}${typescript ? ': React.FC' + (props.length > 0 ? `<${name}Props>` : '') : ''} = (${propsParam}) => {
  return (
    <div className="p-4">
      <h1>${name} Component</h1>
    </div>
  )
}

export default ${name}
`
  }

  static generateClassComponent(
    name: string,
    options: ComponentGeneratorOptions = {}
  ): string {
    const { props = [], typescript = true } = options

    const propsInterface = typescript && props.length > 0
      ? `interface ${name}Props {\n${props.map(p => `  ${p.name}${p.optional ? '?' : ''}: ${p.type}`).join('\n')}\n}\n\n`
      : ''

    const stateInterface = typescript
      ? `interface ${name}State {\n  // Add state properties here\n}\n\n`
      : ''

    return `import React, { Component } from 'react'

${propsInterface}${stateInterface}export class ${name} extends Component${typescript ? `<${name}Props, ${name}State>` : ''} {
  constructor(props${typescript ? `: ${name}Props` : ''}) {
    super(props)
    this.state = {
      // Initialize state
    }
  }

  render() {
    return (
      <div className="p-4">
        <h1>${name} Component</h1>
      </div>
    )
  }
}

export default ${name}
`
  }
}

interface ComponentGeneratorOptions {
  props?: Array<{ name: string; type: string; optional?: boolean }>
  useState?: boolean
  useEffect?: boolean
  typescript?: boolean
  styling?: 'tailwind' | 'css' | 'styled'
}

/**
 * Service generator for creating new service classes
 */
export class ServiceGenerator {
  static generateService(name: string, options: ServiceGeneratorOptions = {}): string {
    const { 
      repository = true, 
      cache = false, 
      typescript = true,
      methods = []
    } = options

    const className = `${name}Service`
    const repositoryName = `${name}Repository`

    const imports = typescript 
      ? `import type { ${name}, Create${name}Input, Update${name}Input } from '@/types'\n`
      : ''

    const repositoryImport = repository
      ? `import { ${repositoryName} } from '@/lib/repositories/${name.toLowerCase()}-repository'\n`
      : ''

    const cacheImport = cache
      ? `import { CacheManager } from '@/lib/core/cache'\n`
      : ''

    const constructor = repository || cache
      ? `  constructor(
${repository ? `    private repository: ${repositoryName}` : ''}${repository && cache ? ',' : ''}
${cache ? `    private cache: CacheManager` : ''}
  ) {}`
      : ''

    const defaultMethods = methods.length > 0 ? methods : [
      'getAll',
      'getById',
      'create',
      'update',
      'delete'
    ]

    const methodImplementations = defaultMethods.map(method => {
      switch (method) {
        case 'getAll':
          return `  async getAll(): Promise<${name}[]> {
    ${cache ? `const cached = await this.cache.get('${name.toLowerCase()}:all')
    if (cached) return cached
    
    ` : ''}const items = await this.repository.findAll()
    ${cache ? `await this.cache.set('${name.toLowerCase()}:all', items)
    ` : ''}return items
  }`

        case 'getById':
          return `  async getById(id: string): Promise<${name} | null> {
    ${cache ? `const cached = await this.cache.get(\`${name.toLowerCase()}:\${id}\`)
    if (cached) return cached
    
    ` : ''}const item = await this.repository.findById(id)
    ${cache ? `if (item) {
      await this.cache.set(\`${name.toLowerCase()}:\${id}\`, item)
    }
    ` : ''}return item
  }`

        case 'create':
          return `  async create(input: Create${name}Input): Promise<${name}> {
    const item = await this.repository.create(input)
    ${cache ? `await this.cache.invalidatePattern('${name.toLowerCase()}:*')
    ` : ''}return item
  }`

        case 'update':
          return `  async update(id: string, input: Update${name}Input): Promise<${name} | null> {
    const item = await this.repository.update(id, input)
    ${cache ? `if (item) {
      await this.cache.invalidatePattern('${name.toLowerCase()}:*')
    }
    ` : ''}return item
  }`

        case 'delete':
          return `  async delete(id: string): Promise<boolean> {
    const success = await this.repository.delete(id)
    ${cache ? `if (success) {
      await this.cache.invalidatePattern('${name.toLowerCase()}:*')
    }
    ` : ''}return success
  }`

        default:
          return `  async ${method}(): Promise<any> {
    // Implement ${method} logic
    throw new Error('Method not implemented')
  }`
      }
    }).join('\n\n')

    return `${imports}${repositoryImport}${cacheImport}
/**
 * ${name} service for business logic operations
 */
export class ${className} {
${constructor}

${methodImplementations}
}
`
  }

  static generateRepository(name: string, options: RepositoryGeneratorOptions = {}): string {
    const { typescript = true, database = 'supabase' } = options
    const className = `${name}Repository`

    const imports = typescript
      ? `import type { ${name}, Create${name}Input, Update${name}Input } from '@/types'
import { BaseRepository } from '@/lib/core/repository'
`
      : `import { BaseRepository } from '@/lib/core/repository'
`

    const databaseImport = database === 'supabase'
      ? `import { supabase } from '@/lib/supabase'\n`
      : ''

    return `${imports}${databaseImport}
/**
 * ${name} repository for data access operations
 */
export class ${className} extends BaseRepository<${name}> {
  protected tableName = '${name.toLowerCase()}s'

  async findAll(): Promise<${name}[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')

    if (error) throw error
    return data || []
  }

  async findById(id: string): Promise<${name} | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  }

  async create(input: Create${name}Input): Promise<${name}> {
    const { data, error } = await supabase
      .from(this.tableName)
      .insert(input)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async update(id: string, input: Update${name}Input): Promise<${name} | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .update(input)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw error
    }
    return data
  }

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id)

    if (error) throw error
    return true
  }
}
`
  }
}

interface ServiceGeneratorOptions {
  repository?: boolean
  cache?: boolean
  typescript?: boolean
  methods?: string[]
}

interface RepositoryGeneratorOptions {
  typescript?: boolean
  database?: 'supabase' | 'prisma' | 'mongodb'
}

/**
 * Type generator for creating TypeScript type definitions
 */
export class TypeGenerator {
  static generateDomainTypes(name: string, fields: TypeField[]): string {
    const baseName = name
    const createInputName = `Create${name}Input`
    const updateInputName = `Update${name}Input`

    const baseType = `export interface ${baseName} {
${fields.map(field => `  ${field.name}${field.optional ? '?' : ''}: ${field.type}`).join('\n')}
}`

    const createType = `export interface ${createInputName} {
${fields
  .filter(field => !field.generated)
  .map(field => `  ${field.name}${field.optional || field.defaultValue ? '?' : ''}: ${field.type}`)
  .join('\n')}
}`

    const updateType = `export interface ${updateInputName} {
${fields
  .filter(field => !field.generated && field.name !== 'id')
  .map(field => `  ${field.name}?: ${field.type}`)
  .join('\n')}
}`

    return `${baseType}

${createType}

${updateType}
`
  }

  static generateApiTypes(name: string): string {
    return `// API request/response types for ${name}

export interface Get${name}Request {
  id: string
}

export interface Get${name}Response {
  data: ${name} | null
  error?: string
}

export interface List${name}Request {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface List${name}Response {
  data: ${name}[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  error?: string
}

export interface Create${name}Request {
  data: Create${name}Input
}

export interface Create${name}Response {
  data: ${name} | null
  error?: string
}

export interface Update${name}Request {
  id: string
  data: Update${name}Input
}

export interface Update${name}Response {
  data: ${name} | null
  error?: string
}

export interface Delete${name}Request {
  id: string
}

export interface Delete${name}Response {
  success: boolean
  error?: string
}
`
  }
}

interface TypeField {
  name: string
  type: string
  optional?: boolean
  generated?: boolean
  defaultValue?: any
}

/**
 * Hook generator for creating custom React hooks
 */
export class HookGenerator {
  static generateDataHook(name: string, service: string): string {
    const hookName = `use${name}`
    const serviceName = `${service}Service`

    return `import { useState, useEffect, useCallback } from 'react'
import { ${serviceName} } from '@/lib/services/${service.toLowerCase()}-service'
import type { ${name} } from '@/types'

export const ${hookName} = () => {
  const [items, setItems] = useState<${name}[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const service = new ${serviceName}()

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const data = await service.getAll()
      setItems(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [service])

  const createItem = useCallback(async (input: Create${name}Input) => {
    setLoading(true)
    setError(null)
    
    try {
      const newItem = await service.create(input)
      setItems(prev => [...prev, newItem])
      return newItem
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [service])

  const updateItem = useCallback(async (id: string, input: Update${name}Input) => {
    setLoading(true)
    setError(null)
    
    try {
      const updatedItem = await service.update(id, input)
      if (updatedItem) {
        setItems(prev => prev.map(item => item.id === id ? updatedItem : item))
      }
      return updatedItem
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [service])

  const deleteItem = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    
    try {
      await service.delete(id)
      setItems(prev => prev.filter(item => item.id !== id))
    } catch (err) {
      setError(err as Error)
      throw err
    } finally {
      setLoading(false)
    }
  }, [service])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  return {
    items,
    loading,
    error,
    refetch: fetchItems,
    create: createItem,
    update: updateItem,
    delete: deleteItem
  }
}
`
  }
}