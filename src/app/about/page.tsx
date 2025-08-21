'use client'

import Navigation from '@/components/navigation/Navigation'
import Link from 'next/link'
import { Users, Heart, Globe, Zap } from 'lucide-react'

export default function AboutPage() {
  return (
    <Navigation>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">About lumidex.app</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Your ultimate platform for Pokémon TCG collection management and community building
          </p>
        </div>

        {/* Mission Section */}
        <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 mb-8">
          <div className="flex items-center mb-6">
            <Heart className="w-8 h-8 text-pokemon-gold mr-3" />
            <h2 className="text-2xl font-bold text-white">Our Mission</h2>
          </div>
          <p className="text-gray-300 text-lg leading-relaxed mb-6">
            At lumidex.app, we're passionate about bringing Pokémon TCG collectors together in one comprehensive platform. 
            Our mission is to simplify collection management, facilitate meaningful connections between collectors, and create 
            a thriving community where everyone can enjoy their collecting journey.
          </p>
          <p className="text-gray-300 text-lg leading-relaxed">
            Whether you're a casual collector or a competitive player, lumidex.app provides the tools you need to track, 
            organize, and grow your collection while connecting with fellow enthusiasts around the world.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center mb-4">
              <Users className="w-6 h-6 text-pokemon-gold mr-3" />
              <h3 className="text-xl font-bold text-white">Community First</h3>
            </div>
            <p className="text-gray-400">
              Connect with collectors worldwide, share your achievements, and discover new trading opportunities 
              in our vibrant community.
            </p>
          </div>

          <div className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center mb-4">
              <Globe className="w-6 h-6 text-pokemon-gold mr-3" />
              <h3 className="text-xl font-bold text-white">Global Platform</h3>
            </div>
            <p className="text-gray-400">
              Multi-language support and international pricing help collectors from around the world 
              manage their collections in their preferred currency and language.
            </p>
          </div>

          <div className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center mb-4">
              <Zap className="w-6 h-6 text-pokemon-gold mr-3" />
              <h3 className="text-xl font-bold text-white">Advanced Features</h3>
            </div>
            <p className="text-gray-400">
              Real-time pricing, detailed statistics, set completion tracking, and powerful search capabilities 
              make managing your collection effortless.
            </p>
          </div>

          <div className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center mb-4">
              <Heart className="w-6 h-6 text-pokemon-gold mr-3" />
              <h3 className="text-xl font-bold text-white">Made by Collectors</h3>
            </div>
            <p className="text-gray-400">
              Built by passionate Pokémon TCG collectors who understand the needs and challenges 
              of managing and growing a collection.
            </p>
          </div>
        </div>

        {/* Story Section */}
        <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Our Story</h2>
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              lumidex.app was born from the frustration of trying to manage a growing Pokémon TCG collection 
              across multiple platforms and spreadsheets. As collectors ourselves, we experienced firsthand 
              the challenges of tracking cards, monitoring values, and connecting with other collectors.
            </p>
            <p>
              We envisioned a single platform that would solve these problems while building a community 
              where collectors could share their passion, trade cards, and celebrate their achievements together. 
              After months of development and feedback from beta users, lumidex.app was launched to serve 
              collectors worldwide.
            </p>
            <p>
              Today, we continue to evolve based on community feedback, adding new features and improvements 
              to make lumidex.app the best possible experience for Pokémon TCG collectors everywhere.
            </p>
          </div>
        </div>

        {/* Values Section */}
        <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 mb-8">
          <h2 className="text-2xl font-bold text-white mb-6">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-pokemon-gold rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-black font-bold text-xl">🤝</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Community</h3>
              <p className="text-gray-400 text-sm">
                Building meaningful connections between collectors worldwide
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-pokemon-gold rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-black font-bold text-xl">🚀</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Innovation</h3>
              <p className="text-gray-400 text-sm">
                Continuously improving with cutting-edge features and technology
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-pokemon-gold rounded-xl flex items-center justify-center mx-auto mb-3">
                <span className="text-black font-bold text-xl">🎯</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Excellence</h3>
              <p className="text-gray-400 text-sm">
                Delivering the best possible experience for every collector
              </p>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="bg-pkmn-surface rounded-xl p-8 border border-gray-700/50 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Get in Touch</h2>
          <p className="text-gray-400 mb-6">
            Have questions, suggestions, or just want to say hello? We'd love to hear from you!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a 
              href="mailto:hello@lumidex.app" 
              className="inline-flex items-center px-6 py-3 bg-pokemon-gold text-black font-medium rounded-lg hover:bg-pokemon-gold-hover transition-colors"
            >
              Email Us
            </a>
            <Link 
              href="/support" 
              className="inline-flex items-center px-6 py-3 bg-pkmn-card border border-gray-700/50 text-white font-medium rounded-lg hover:bg-pkmn-dark transition-colors"
            >
              Support Center
            </Link>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="text-center mt-8 p-4 bg-pkmn-surface/30 rounded-lg border border-gray-700/30">
          <p className="text-xs text-gray-500 leading-relaxed">
            lumidex.app is an independent platform for Pokémon TCG collectors. We are not affiliated with or endorsed by 
            Nintendo, Game Freak, Creatures Inc., or The Pokémon Company International. All Pokémon names, images, and 
            related content are trademarks and copyrights of their respective owners.
          </p>
        </div>
      </div>
    </Navigation>
  )
}