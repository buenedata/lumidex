'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Throttle scroll event for better performance
  const throttle = useCallback((func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout | null = null
    let lastExecTime = 0
    return function (this: any, ...args: any[]) {
      const currentTime = Date.now()
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args)
        lastExecTime = currentTime
      } else {
        if (timeoutId) clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          func.apply(this, args)
          lastExecTime = Date.now()
        }, delay - (currentTime - lastExecTime))
      }
    }
  }, [])

  useEffect(() => {
    const toggleVisibility = throttle(() => {
      const scrollY = window.pageYOffset || document.documentElement.scrollTop
      // Show button when page is scrolled down 300px
      setIsVisible(scrollY > 300)
    }, 100)

    window.addEventListener('scroll', toggleVisibility, { passive: true })

    return () => {
      window.removeEventListener('scroll', toggleVisibility)
    }
  }, [throttle])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  // Enhanced smooth scroll with custom easing and progress tracking
  const scrollToTop = useCallback(() => {
    const startPosition = window.pageYOffset || document.documentElement.scrollTop
    const startTime = performance.now()
    const duration = Math.min(1200, Math.max(500, startPosition / 2)) // Dynamic duration based on scroll distance
    
    setIsScrolling(true)

    // Custom easing function for smooth animation
    const easeOutCubic = (t: number): number => {
      return 1 - Math.pow(1 - t, 3)
    }

    const animateScroll = (currentTime: number) => {
      const timeElapsed = currentTime - startTime
      const progress = Math.min(timeElapsed / duration, 1)
      const easedProgress = easeOutCubic(progress)
      
      const currentPosition = startPosition * (1 - easedProgress)
      
      window.scrollTo(0, currentPosition)
      
      if (progress < 1) {
        requestAnimationFrame(animateScroll)
      } else {
        setIsScrolling(false)
        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
        // Set a small delay before allowing the button to potentially hide
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false)
        }, 150)
      }
    }

    // Always use custom animation for reliable smooth scrolling
    requestAnimationFrame(animateScroll)
  }, [])

  return (
    <button
      onClick={scrollToTop}
      className={`
        fixed bottom-6 right-6 z-50
        w-12 h-12
        bg-pokemon-gold hover:bg-pokemon-gold-hover
        text-white font-bold
        rounded-full
        shadow-lg hover:shadow-xl
        transition-all duration-500 ease-out
        hover:scale-110 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-pokemon-gold focus:ring-offset-2 focus:ring-offset-pkmn-dark
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}
        ${isScrolling ? 'animate-pulse scale-105' : ''}
      `}
      style={{
        boxShadow: isVisible 
          ? 'var(--shadow-gaming-lg), 0 0 20px rgba(255, 215, 0, 0.3)' 
          : 'none'
      }}
      aria-label="Scroll to top"
      title="Scroll to top"
    >
      <svg
        className={`w-6 h-6 mx-auto transition-transform duration-300 ${isScrolling ? 'scale-110' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    </button>
  )
}