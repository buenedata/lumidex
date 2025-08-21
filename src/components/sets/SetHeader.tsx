'use client'

import Image from 'next/image'
import { Calendar, Package, TrendingUp, BarChart3, Star } from 'lucide-react'
import { PriceDisplay } from '@/components/PriceDisplay'

interface SetData {
  id: string
  name: string
  series: string
  total_cards: number
  release_date: string
  symbol_url?: string | null
  logo_url?: string | null
  background_url?: string | null
  ptcgo_code?: string | null
}

interface SetHeaderProps {
  setData: SetData
  totalValue: number
  userValue: number
  collectedCards: number
  totalCards: number
  user?: any
}

export function SetHeader({
  setData,
  totalValue,
  userValue,
  collectedCards,
  totalCards,
  user
}: SetHeaderProps) {
  return (
    <div className="relative mb-6 rounded-lg overflow-hidden">
      {/* Background Image with Blur */}
      {(setData.background_url || setData.logo_url || setData.id) && (
        <div className="absolute inset-0">
          <Image
            src={
              setData.background_url ||
              `/images/sets/backgrounds/${setData.id}.webp`
            }
            alt={`${setData.name} background`}
            fill
            className="object-cover opacity-30 blur-sm"
            sizes="(max-width: 1280px) 100vw, 1280px"
          />
          <div className="absolute inset-0 bg-pkmn-card/90 backdrop-blur-md"></div>
        </div>
      )}
      
      {/* Content */}
      <div className="relative card-container">
        {/* Set Header */}
        <div className="flex items-center space-x-4 mb-6 pb-6 border-b border-gray-600/50">
          {setData.symbol_url && (
            <Image
              src={setData.symbol_url}
              alt={setData.name}
              width={48}
              height={48}
              className="rounded-lg"
            />
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{setData.name}</h1>
            <p className="text-lg text-gray-300">{setData.series}</p>
          </div>
        </div>

        {/* Stats Grid - Now includes collection info */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-pokemon-gold" />
            <div>
              <p className="text-sm text-gray-400">Release Date</p>
              <p className="text-white font-medium">
                {new Date(setData.release_date).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <Package className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm text-gray-400">Cards</p>
              <p className="text-white font-medium">{setData.total_cards}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm text-gray-400">Full Set Market Value</p>
              <p className="text-green-400 font-medium">
                <PriceDisplay amount={totalValue} currency="EUR" showOriginal={false} />
              </p>
            </div>
          </div>

          {user && (
            <>
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-5 h-5 text-purple-400" />
                <div>
                  <p className="text-sm text-gray-400">Your Set Value</p>
                  <p className="text-purple-400 font-medium">
                    <PriceDisplay amount={userValue} currency="EUR" showOriginal={false} />
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Star className="w-5 h-5 text-yellow-400" />
                <div>
                  <p className="text-sm text-gray-400">Collection Progress</p>
                  <p className="text-white font-medium">
                    {collectedCards}/{totalCards} ({totalCards > 0 ? ((collectedCards / totalCards) * 100).toFixed(1) : 0}%)
                  </p>
                </div>
              </div>
            </>
          )}

          {setData.ptcgo_code && (
            <div className="flex items-center space-x-3">
              <Star className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-sm text-gray-400">PTCGO Code</p>
                <p className="text-white font-medium">{setData.ptcgo_code}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}