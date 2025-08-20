import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-pkmn-dark flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* 404 Icon */}
        <div className="mb-8">
          <div className="text-8xl mb-4">🃏</div>
          <div className="text-6xl font-bold text-pokemon-gold mb-4 animate-glow-pulse">
            404
          </div>
        </div>
        
        {/* Error Message */}
        <h1 className="text-3xl font-bold text-white mb-4">
          Page Not Found
        </h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          The page you're looking for doesn't exist or has been moved. 
          Let's get you back to collecting Pokemon cards!
        </p>
        
        {/* Action Buttons */}
        <div className="space-y-4">
          <Link href="/dashboard" className="btn-gaming inline-flex items-center">
            <span className="mr-2">🏠</span>
            Go to Dashboard
          </Link>
          <div className="flex gap-4 justify-center">
            <Link href="/cards" className="btn-secondary">
              Browse Cards
            </Link>
            <Link href="/collection" className="btn-secondary">
              My Collection
            </Link>
          </div>
        </div>
        
        {/* Decorative Elements */}
        <div className="mt-12 opacity-20">
          <div className="flex justify-center space-x-4 text-2xl">
            <span className="animate-bounce" style={{ animationDelay: '0s' }}>⚡</span>
            <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🔥</span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>💧</span>
            <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🌿</span>
            <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>🌟</span>
          </div>
        </div>
      </div>
    </div>
  );
}