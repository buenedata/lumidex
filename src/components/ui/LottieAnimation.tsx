'use client'

import React, { useState, useEffect } from 'react'
import Lottie from 'lottie-react'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { cn } from '@/lib/utils'

interface LottieAnimationProps {
  animationData?: any
  animationUrl?: string
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loop?: boolean
  autoplay?: boolean
  speed?: number
}

// Default Pokemon card animation data (simple card flip animation)
const defaultCardAnimation = {
  "v": "5.7.4",
  "fr": 30,
  "ip": 0,
  "op": 60,
  "w": 200,
  "h": 200,
  "nm": "Pokemon Card Loading",
  "ddd": 0,
  "assets": [],
  "layers": [
    {
      "ddd": 0,
      "ind": 1,
      "ty": 4,
      "nm": "Card",
      "sr": 1,
      "ks": {
        "o": {"a": 0, "k": 100},
        "r": {
          "a": 1,
          "k": [
            {"i": {"x": [0.833], "y": [0.833]}, "o": {"x": [0.167], "y": [0.167]}, "t": 0, "s": [0]},
            {"i": {"x": [0.833], "y": [0.833]}, "o": {"x": [0.167], "y": [0.167]}, "t": 30, "s": [180]},
            {"t": 60, "s": [360]}
          ]
        },
        "p": {"a": 0, "k": [100, 100, 0]},
        "a": {"a": 0, "k": [0, 0, 0]},
        "s": {
          "a": 1,
          "k": [
            {"i": {"x": [0.833, 0.833, 0.833], "y": [0.833, 0.833, 0.833]}, "o": {"x": [0.167, 0.167, 0.167], "y": [0.167, 0.167, 0.167]}, "t": 0, "s": [80, 80, 100]},
            {"i": {"x": [0.833, 0.833, 0.833], "y": [0.833, 0.833, 0.833]}, "o": {"x": [0.167, 0.167, 0.167], "y": [0.167, 0.167, 0.167]}, "t": 15, "s": [120, 120, 100]},
            {"i": {"x": [0.833, 0.833, 0.833], "y": [0.833, 0.833, 0.833]}, "o": {"x": [0.167, 0.167, 0.167], "y": [0.167, 0.167, 0.167]}, "t": 30, "s": [80, 80, 100]},
            {"i": {"x": [0.833, 0.833, 0.833], "y": [0.833, 0.833, 0.833]}, "o": {"x": [0.167, 0.167, 0.167], "y": [0.167, 0.167, 0.167]}, "t": 45, "s": [120, 120, 100]},
            {"t": 60, "s": [80, 80, 100]}
          ]
        }
      },
      "ao": 0,
      "shapes": [
        {
          "ty": "gr",
          "it": [
            {
              "ty": "rc",
              "d": 1,
              "s": {"a": 0, "k": [60, 80]},
              "p": {"a": 0, "k": [0, 0]},
              "r": {"a": 0, "k": 8}
            },
            {
              "ty": "fl",
              "c": {
                "a": 1,
                "k": [
                  {"i": {"x": [0.833, 0.833, 0.833, 0.833], "y": [0.833, 0.833, 0.833, 0.833]}, "o": {"x": [0.167, 0.167, 0.167, 0.167], "y": [0.167, 0.167, 0.167, 0.167]}, "t": 0, "s": [0.2, 0.4, 0.8, 1]},
                  {"i": {"x": [0.833, 0.833, 0.833, 0.833], "y": [0.833, 0.833, 0.833, 0.833]}, "o": {"x": [0.167, 0.167, 0.167, 0.167], "y": [0.167, 0.167, 0.167, 0.167]}, "t": 30, "s": [0.8, 0.2, 0.4, 1]},
                  {"t": 60, "s": [0.2, 0.4, 0.8, 1]}
                ]
              },
              "o": {"a": 0, "k": 100}
            },
            {
              "ty": "st",
              "c": {"a": 0, "k": [1, 1, 1, 1]},
              "o": {"a": 0, "k": 100},
              "w": {"a": 0, "k": 2}
            },
            {
              "ty": "tr",
              "p": {"a": 0, "k": [0, 0]},
              "a": {"a": 0, "k": [0, 0]},
              "s": {"a": 0, "k": [100, 100]},
              "r": {"a": 0, "k": 0},
              "o": {"a": 0, "k": 100}
            }
          ]
        }
      ],
      "ip": 0,
      "op": 60,
      "st": 0,
      "bm": 0
    }
  ]
}

export const LottieAnimation: React.FC<LottieAnimationProps> = ({
  animationData,
  animationUrl,
  className,
  size = 'md',
  loop = true,
  autoplay = true,
  speed = 1
}) => {
  const [loadedAnimationData, setLoadedAnimationData] = useState(animationData || defaultCardAnimation)
  const [isLoading, setIsLoading] = useState(false)

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
    xl: 'w-32 h-32'
  }

  useEffect(() => {
    if (animationUrl && !animationUrl.endsWith('.lottie')) {
      setIsLoading(true)
      // For .json files, fetch and parse
      fetch(animationUrl)
        .then(response => response.json())
        .then(data => {
          setLoadedAnimationData(data)
          setIsLoading(false)
        })
        .catch(error => {
          console.error('Failed to load Lottie animation:', error)
          setLoadedAnimationData(defaultCardAnimation)
          setIsLoading(false)
        })
    }
  }, [animationUrl])

  if (isLoading) {
    return (
      <div className={cn(sizeClasses[size], 'flex items-center justify-center', className)}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    )
  }

  // Use DotLottieReact for .lottie files
  if (animationUrl && animationUrl.endsWith('.lottie')) {
    return (
      <div className={cn(sizeClasses[size], className)}>
        <DotLottieReact
          src={animationUrl}
          loop={loop}
          autoplay={autoplay}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    )
  }

  // Use regular Lottie for .json files or animationData
  return (
    <div className={cn(sizeClasses[size], className)}>
      <Lottie
        animationData={loadedAnimationData}
        loop={loop}
        autoplay={autoplay}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}

export default LottieAnimation