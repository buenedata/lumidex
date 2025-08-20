import LottieAnimation from '@/components/ui/LottieAnimation'

export default function Loading() {
  return (
    <div className="min-h-screen bg-pkmn-dark flex items-center justify-center">
      <div className="text-center">
        {/* Loading Animation */}
        <div className="mb-8">
          <div className="flex justify-center mb-4">
            <LottieAnimation
              animationUrl="https://lottie.host/a8f00b0e-9fc1-4d08-a75f-1228d94ea74d/fzzgGNZDyX.lottie"
              size="xl"
              className="w-20 h-20"
            />
          </div>
          <div className="flex justify-center space-x-2">
            <div className="w-3 h-3 bg-pokemon-gold rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-3 h-3 bg-pokemon-gold rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-3 h-3 bg-pokemon-gold rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
        
        {/* Loading Text */}
        <h2 className="text-2xl font-bold text-white mb-4">
          Loading Pokemon Cards...
        </h2>
        <p className="text-gray-400">
          Preparing your collection experience
        </p>
        
        {/* Decorative Elements */}
        <div className="mt-12 opacity-20">
          <div className="flex justify-center space-x-4 text-2xl">
            <span className="animate-pulse" style={{ animationDelay: '0s' }}>⚡</span>
            <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>🔥</span>
            <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>💧</span>
            <span className="animate-pulse" style={{ animationDelay: '0.6s' }}>🌿</span>
            <span className="animate-pulse" style={{ animationDelay: '0.8s' }}>🌟</span>
          </div>
        </div>
      </div>
    </div>
  )
}