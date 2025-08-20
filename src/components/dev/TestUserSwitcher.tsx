'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useState } from 'react'

const TEST_USERS = [
  { email: 'kristofferbuene@gmail.com', password: 'Littforenkelt11!?', name: 'Doffen', color: 'bg-yellow-100' },
  { email: 'testuser1@example.com', password: 'testpass123', name: 'Test User 1', color: 'bg-blue-100' },
  { email: 'testuser2@example.com', password: 'testpass123', name: 'Test User 2', color: 'bg-green-100' },
  { email: 'testuser3@example.com', password: 'testpass123', name: 'Test User 3', color: 'bg-purple-100' }
]

export default function TestUserSwitcher() {
  const { signIn, signOut, user, loading } = useAuth()
  const [switching, setSwitching] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)

  // Only show in development
  if (process.env.NODE_ENV !== 'development') return null

  const handleQuickLogin = async (testUser: typeof TEST_USERS[0]) => {
    setSwitching(true)
    try {
      await signOut()
      // Small delay to ensure signout completes
      await new Promise(resolve => setTimeout(resolve, 500))
      await signIn(testUser.email, testUser.password)
    } catch (error) {
      console.error('Error switching user:', error)
    } finally {
      setSwitching(false)
    }
  }

  const handleSignOut = async () => {
    setSwitching(true)
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    } finally {
      setSwitching(false)
    }
  }

  const currentTestUser = TEST_USERS.find(testUser => testUser.email === user?.email)

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-yellow-400 hover:bg-yellow-500 text-black px-3 py-2 rounded-full shadow-lg font-bold text-sm"
          title="Open Test User Switcher"
        >
          🧪
        </button>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-100 p-4 rounded-lg shadow-lg border-2 border-yellow-400 z-50 min-w-[200px]">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-sm">🧪 Test Users</h3>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-gray-500 hover:text-gray-700 text-xs"
          title="Minimize"
        >
          ✕
        </button>
      </div>
      
      {user && (
        <div className="mb-3 p-2 bg-white rounded text-xs">
          <div className="font-medium">Current User:</div>
          <div className="text-gray-600 truncate">{user.email}</div>
          {currentTestUser && (
            <div className={`inline-block px-2 py-1 rounded mt-1 text-xs ${currentTestUser.color}`}>
              {currentTestUser.name}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {TEST_USERS.map((testUser, index) => {
          const isCurrentUser = testUser.email === user?.email
          return (
            <button
              key={index}
              onClick={() => handleQuickLogin(testUser)}
              disabled={switching || loading || isCurrentUser}
              className={`block w-full text-left px-2 py-2 rounded text-xs transition-colors ${
                isCurrentUser 
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                  : 'bg-white hover:bg-gray-50 text-gray-800'
              } ${switching || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="font-medium">{testUser.name}</div>
              <div className="text-gray-500 text-xs truncate">{testUser.email}</div>
            </button>
          )
        })}
        
        <button
          onClick={handleSignOut}
          disabled={switching || loading || !user}
          className={`block w-full text-left px-2 py-2 bg-red-100 hover:bg-red-200 rounded text-xs transition-colors ${
            switching || loading || !user ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <div className="font-medium text-red-700">Sign Out</div>
          <div className="text-red-600 text-xs">Clear current session</div>
        </button>
      </div>

      {(switching || loading) && (
        <div className="mt-2 text-xs text-gray-600 text-center">
          {switching ? 'Switching user...' : 'Loading...'}
        </div>
      )}

      <div className="mt-3 pt-2 border-t border-yellow-300">
        <div className="text-xs text-gray-600">
          💡 Use different browser profiles for true multi-user testing
        </div>
      </div>
    </div>
  )
}