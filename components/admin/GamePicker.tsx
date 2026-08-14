'use client'

import Image from 'next/image'
import { GAMES, type GameSlug } from '@/lib/games'

interface Props {
  selectedGame: GameSlug | null
  onGameSelect: (slug: GameSlug) => void
}

export function GamePicker({ selectedGame, onGameSelect }: Props) {
  const games = Object.values(GAMES)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {games.map((game) => {
        const isSelected = selectedGame === game.slug
        return (
          <button
            key={game.slug}
            onClick={() => onGameSelect(game.slug)}
            className={`
              relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 text-left
              transition-all duration-150 group
              ${isSelected
                ? 'border-yellow-500 bg-yellow-500/10 shadow-lg shadow-yellow-500/10'
                : 'border-gray-700 bg-gray-900 hover:border-yellow-500/50 hover:bg-gray-800'
              }
            `}
          >
            {/* Selected tick */}
            {isSelected && (
              <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-black">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
                </svg>
              </span>
            )}

            {/* Logo */}
            <div className="w-16 h-16 relative rounded-lg overflow-hidden bg-gray-800 flex items-center justify-center shrink-0">
              <Image
                src={game.logoUrl}
                alt={game.displayName}
                fill
                className="object-contain p-1"
                sizes="64px"
              />
            </div>

            {/* Name + description */}
            <div className="text-center">
              <p className={`font-semibold text-sm ${isSelected ? 'text-yellow-400' : 'text-white group-hover:text-yellow-300'}`}>
                {game.displayName}
              </p>
              {game.description && (
                <p className="text-gray-500 text-xs mt-0.5 leading-snug line-clamp-2">
                  {game.description}
                </p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
