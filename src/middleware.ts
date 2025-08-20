// Middleware disabled - using client-side route protection instead
// This file is kept to prevent Next.js from looking for middleware

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  // No middleware logic - all route protection handled client-side
  return NextResponse.next()
}

export const config = {
  matcher: [],
}