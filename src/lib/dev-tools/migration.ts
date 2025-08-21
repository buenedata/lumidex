// Migration utilities for incremental refactoring and architecture updates

import { useState, useEffect, useCallback } from 'react'

/**
 * Migration status types
 */
export type MigrationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface Migration {
  id: string
  name: string
  description: string
  version: string
  dependencies?: string[]
  execute: () => Promise<void>
  rollback?: () => Promise<void>
  validate?: () => Promise<boolean>
}

export interface MigrationResult {
  id: string
  status: MigrationStatus
  error?: Error
  startTime: number
  endTime?: number
  duration?: number
}

/**
 * Migration runner for executing incremental updates
 */
export class MigrationRunner {
  private static instance: MigrationRunner
  private migrations: Map<string, Migration> = new Map()
  private results: Map<string, MigrationResult> = new Map()
  private isRunning = false

  static getInstance(): MigrationRunner {
    if (!MigrationRunner.instance) {
      MigrationRunner.instance = new MigrationRunner()
    }
    return MigrationRunner.instance
  }

  /**
   * Register a migration
   */
  registerMigration(migration: Migration): void {
    this.migrations.set(migration.id, migration)
  }

  /**
   * Get all registered migrations
   */
  getMigrations(): Migration[] {
    return Array.from(this.migrations.values())
  }

  /**
   * Get migration results
   */
  getResults(): MigrationResult[] {
    return Array.from(this.results.values())
  }

  /**
   * Check if dependencies are satisfied
   */
  private checkDependencies(migration: Migration): boolean {
    if (!migration.dependencies) return true

    return migration.dependencies.every(depId => {
      const result = this.results.get(depId)
      return result && result.status === 'completed'
    })
  }

  /**
   * Run a single migration
   */
  async runMigration(migrationId: string): Promise<MigrationResult> {
    const migration = this.migrations.get(migrationId)
    if (!migration) {
      throw new Error(`Migration not found: ${migrationId}`)
    }

    // Check if already completed
    const existingResult = this.results.get(migrationId)
    if (existingResult && existingResult.status === 'completed') {
      return existingResult
    }

    // Check dependencies
    if (!this.checkDependencies(migration)) {
      const result: MigrationResult = {
        id: migrationId,
        status: 'skipped',
        error: new Error('Dependencies not satisfied'),
        startTime: Date.now()
      }
      this.results.set(migrationId, result)
      return result
    }

    const result: MigrationResult = {
      id: migrationId,
      status: 'running',
      startTime: Date.now()
    }
    this.results.set(migrationId, result)

    try {
      // Validate if validation function exists
      if (migration.validate) {
        const isValid = await migration.validate()
        if (!isValid) {
          throw new Error('Migration validation failed')
        }
      }

      // Execute migration
      await migration.execute()

      // Update result
      result.status = 'completed'
      result.endTime = Date.now()
      result.duration = result.endTime - result.startTime

      this.results.set(migrationId, result)
      console.log(`✅ Migration completed: ${migration.name} (${result.duration}ms)`)

      return result
    } catch (error) {
      result.status = 'failed'
      result.error = error as Error
      result.endTime = Date.now()
      result.duration = result.endTime - result.startTime

      this.results.set(migrationId, result)
      console.error(`❌ Migration failed: ${migration.name}`, error)

      return result
    }
  }

  /**
   * Run all pending migrations
   */
  async runAllMigrations(): Promise<MigrationResult[]> {
    if (this.isRunning) {
      throw new Error('Migration already in progress')
    }

    this.isRunning = true
    const results: MigrationResult[] = []

    try {
      const migrations = this.getMigrations()
      const pendingMigrations = migrations.filter(migration => {
        const result = this.results.get(migration.id)
        return !result || result.status !== 'completed'
      })

      console.log(`🚀 Starting ${pendingMigrations.length} migrations...`)

      // Sort by dependencies (simple topological sort)
      const sortedMigrations = this.topologicalSort(pendingMigrations)

      for (const migration of sortedMigrations) {
        const result = await this.runMigration(migration.id)
        results.push(result)

        // Stop on first failure
        if (result.status === 'failed') {
          console.error('🛑 Migration stopped due to failure')
          break
        }
      }

      const successful = results.filter(r => r.status === 'completed').length
      const failed = results.filter(r => r.status === 'failed').length

      console.log(`📊 Migration summary: ${successful} successful, ${failed} failed`)

      return results
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Simple topological sort for migration dependencies
   */
  private topologicalSort(migrations: Migration[]): Migration[] {
    const visited = new Set<string>()
    const result: Migration[] = []

    const visit = (migration: Migration) => {
      if (visited.has(migration.id)) return

      if (migration.dependencies) {
        for (const depId of migration.dependencies) {
          const dep = migrations.find(m => m.id === depId)
          if (dep) {
            visit(dep)
          }
        }
      }

      visited.add(migration.id)
      result.push(migration)
    }

    for (const migration of migrations) {
      visit(migration)
    }

    return result
  }

  /**
   * Rollback a migration
   */
  async rollbackMigration(migrationId: string): Promise<void> {
    const migration = this.migrations.get(migrationId)
    if (!migration) {
      throw new Error(`Migration not found: ${migrationId}`)
    }

    if (!migration.rollback) {
      throw new Error(`Migration ${migrationId} does not support rollback`)
    }

    console.log(`⏪ Rolling back migration: ${migration.name}`)

    try {
      await migration.rollback()
      
      // Remove from results
      this.results.delete(migrationId)
      
      console.log(`✅ Rollback completed: ${migration.name}`)
    } catch (error) {
      console.error(`❌ Rollback failed: ${migration.name}`, error)
      throw error
    }
  }

  /**
   * Clear all results
   */
  clearResults(): void {
    this.results.clear()
  }

  /**
   * Export migration status
   */
  exportStatus(): string {
    const data = {
      migrations: this.getMigrations().map(m => ({
        id: m.id,
        name: m.name,
        version: m.version,
        dependencies: m.dependencies
      })),
      results: this.getResults()
    }
    return JSON.stringify(data, null, 2)
  }
}

/**
 * Helper function to create a migration
 */
export const createMigration = (config: {
  id: string
  name: string
  description: string
  version: string
  dependencies?: string[]
  execute: () => Promise<void>
  rollback?: () => Promise<void>
  validate?: () => Promise<boolean>
}): Migration => {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    dependencies: config.dependencies,
    execute: config.execute,
    rollback: config.rollback,
    validate: config.validate
  }
}

/**
 * Hook for tracking migration status
 */
export const useMigrationStatus = () => {
  const [migrations, setMigrations] = useState<Migration[]>([])
  const [results, setResults] = useState<MigrationResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const runner = MigrationRunner.getInstance()

  const refresh = useCallback(() => {
    setMigrations(runner.getMigrations())
    setResults(runner.getResults())
  }, [runner])

  useEffect(() => {
    refresh()
  }, [refresh])

  const runMigration = useCallback(async (migrationId: string) => {
    setIsRunning(true)
    try {
      await runner.runMigration(migrationId)
      refresh()
    } finally {
      setIsRunning(false)
    }
  }, [runner, refresh])

  const runAllMigrations = useCallback(async () => {
    setIsRunning(true)
    try {
      await runner.runAllMigrations()
      refresh()
    } finally {
      setIsRunning(false)
    }
  }, [runner, refresh])

  const rollbackMigration = useCallback(async (migrationId: string) => {
    setIsRunning(true)
    try {
      await runner.rollbackMigration(migrationId)
      refresh()
    } finally {
      setIsRunning(false)
    }
  }, [runner, refresh])

  return {
    migrations,
    results,
    isRunning,
    runMigration,
    runAllMigrations,
    rollbackMigration,
    refresh
  }
}

/**
 * Predefined migrations for the Lumidex refactor
 */
export const createLumidexMigrations = () => {
  const runner = MigrationRunner.getInstance()

  // Phase 1: Type System Migration
  runner.registerMigration(createMigration({
    id: 'type-system-migration',
    name: 'Type System Migration',
    description: 'Migrate to unified type system with domain-based organization',
    version: '1.0.0',
    execute: async () => {
      console.log('🔄 Migrating type system...')
      // This would contain actual migration logic
      await new Promise(resolve => setTimeout(resolve, 1000))
    },
    validate: async () => {
      // Check if new type files exist
      return true
    }
  }))

  // Phase 2: Service Architecture Migration
  runner.registerMigration(createMigration({
    id: 'service-architecture-migration',
    name: 'Service Architecture Migration', 
    description: 'Migrate to repository pattern and service layer architecture',
    version: '1.0.0',
    dependencies: ['type-system-migration'],
    execute: async () => {
      console.log('🔄 Migrating service architecture...')
      await new Promise(resolve => setTimeout(resolve, 1500))
    }
  }))

  // Phase 3: State Management Migration
  runner.registerMigration(createMigration({
    id: 'state-management-migration',
    name: 'State Management Migration',
    description: 'Replace context providers with Zustand store',
    version: '1.0.0',
    dependencies: ['service-architecture-migration'],
    execute: async () => {
      console.log('🔄 Migrating state management...')
      await new Promise(resolve => setTimeout(resolve, 1200))
    }
  }))

  // Phase 4: Component Architecture Migration
  runner.registerMigration(createMigration({
    id: 'component-architecture-migration',
    name: 'Component Architecture Migration',
    description: 'Migrate to new component patterns and base components',
    version: '1.0.0',
    dependencies: ['state-management-migration'],
    execute: async () => {
      console.log('🔄 Migrating component architecture...')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }))

  return runner
}