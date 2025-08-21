// Developer tools and utilities for Lumidex development and debugging

/**
 * Development tools package for Lumidex
 *
 * This package provides comprehensive development utilities including:
 * - Performance monitoring and tracking
 * - Debug logging and state inspection
 * - Migration management for incremental refactoring
 * - Type checking and API contract validation
 * - Test data factories and mocking utilities
 * - Code generation helpers
 *
 * Usage:
 * ```typescript
 * import { PerformanceMonitor, DebugLogger, MigrationRunner } from '@/lib/dev-tools'
 * ```
 */

// Note: Individual modules can be imported directly when needed
// Example: import { PerformanceMonitor } from '@/lib/dev-tools/performance'

export const DevTools = {
  // Core development utilities are available through direct imports
  version: '1.0.0',
  description: 'Lumidex development tools and utilities'
} as const