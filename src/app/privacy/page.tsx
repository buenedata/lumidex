'use client'

import Navigation from '@/components/navigation/Navigation'
import Link from 'next/link'
import { Shield, Database, Users, Mail } from 'lucide-react'

export default function PrivacyPolicyPage() {
  return (
    <Navigation>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <Shield className="w-12 h-12 text-pokemon-gold mr-3" />
            <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
          </div>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Last updated: January 1, 2025
          </p>
        </div>

        {/* Quick Summary */}
        <div className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50 mb-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center">
            <Database className="w-5 h-5 text-pokemon-gold mr-2" />
            Quick Summary
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-pkmn-surface/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">We Collect</h3>
              <p className="text-gray-400 text-sm">Account info, collection data, and usage analytics to provide our services</p>
            </div>
            <div className="bg-pkmn-surface/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">We Use It For</h3>
              <p className="text-gray-400 text-sm">Managing your collection, connecting you with other collectors, and improving our platform</p>
            </div>
            <div className="bg-pkmn-surface/50 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">We Protect It</h3>
              <p className="text-gray-400 text-sm">Industry-standard security measures and we never sell your personal data</p>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Information We Collect */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">1. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Account Information</h3>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
              <li>Email address and username</li>
              <li>Profile information you choose to provide (display name, bio, profile picture)</li>
              <li>Account preferences and settings</li>
            </ul>

            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Collection Data</h3>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
              <li>Cards in your collection and wishlist</li>
              <li>Trading history and preferences</li>
              <li>Achievement progress and statistics</li>
              <li>Set completion tracking</li>
            </ul>

            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Usage Information</h3>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
              <li>Pages visited and features used</li>
              <li>Search queries and filters applied</li>
              <li>Device and browser information</li>
              <li>IP address and general location (country/region)</li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Your Information</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-pokemon-gold mb-2">Core Services</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>Managing and displaying your card collection</li>
                  <li>Facilitating trades between users</li>
                  <li>Providing personalized recommendations</li>
                  <li>Calculating collection statistics and values</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-pokemon-gold mb-2">Community Features</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>Connecting you with other collectors</li>
                  <li>Displaying leaderboards and achievements</li>
                  <li>Showing collection comparisons (when you choose to share)</li>
                  <li>Community statistics and trends</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-pokemon-gold mb-2">Platform Improvement</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1">
                  <li>Analyzing usage patterns to improve features</li>
                  <li>Fixing bugs and technical issues</li>
                  <li>Developing new functionality</li>
                  <li>Ensuring platform security and preventing abuse</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Information Sharing */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">3. Information Sharing</h2>
            
            <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 mb-4">
              <p className="text-green-300 font-medium">
                🛡️ We do not sell, rent, or trade your personal information to third parties.
              </p>
            </div>

            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">We may share information:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-2">
              <li><strong>With your consent:</strong> When you choose to share collection details publicly or with friends</li>
              <li><strong>For legal reasons:</strong> If required by law or to protect our rights and users</li>
              <li><strong>Service providers:</strong> With trusted partners who help us operate the platform (under strict confidentiality agreements)</li>
              <li><strong>Anonymized data:</strong> Aggregated, non-identifiable statistics for research or business purposes</li>
            </ul>
          </section>

          {/* Data Security */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Security</h2>
            
            <div className="space-y-4">
              <p className="text-gray-300">
                We implement industry-standard security measures to protect your information:
              </p>
              
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Encrypted data transmission (HTTPS/SSL)</li>
                <li>Secure data storage with encryption at rest</li>
                <li>Regular security audits and updates</li>
                <li>Access controls and authentication systems</li>
                <li>Monitoring for suspicious activity</li>
              </ul>

              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
                <p className="text-yellow-300 text-sm">
                  While we strive to protect your information, no method of transmission over the internet is 100% secure. 
                  We encourage you to use strong passwords and enable two-factor authentication when available.
                </p>
              </div>
            </div>
          </section>

          {/* Your Rights */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">5. Your Rights and Choices</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-pkmn-card/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">Access & Portability</h3>
                <p className="text-gray-400 text-sm">Request a copy of your data or export your collection</p>
              </div>
              <div className="bg-pkmn-card/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">Correction</h3>
                <p className="text-gray-400 text-sm">Update or correct your personal information</p>
              </div>
              <div className="bg-pkmn-card/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">Deletion</h3>
                <p className="text-gray-400 text-sm">Request deletion of your account and data</p>
              </div>
              <div className="bg-pkmn-card/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">Privacy Controls</h3>
                <p className="text-gray-400 text-sm">Control what information is public or private</p>
              </div>
            </div>

            <p className="text-gray-300 mt-4">
              To exercise any of these rights, please contact us at{' '}
              <a href="mailto:privacy@lumidex.app" className="text-pokemon-gold hover:text-pokemon-gold-hover">
                privacy@lumidex.app
              </a>
            </p>
          </section>

          {/* Cookies */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">6. Cookies and Tracking</h2>
            
            <p className="text-gray-300 mb-4">
              We use cookies and similar technologies to improve your experience:
            </p>

            <div className="space-y-3">
              <div>
                <h3 className="text-pokemon-gold font-medium">Essential Cookies</h3>
                <p className="text-gray-400 text-sm">Required for login, security, and basic site functionality</p>
              </div>
              <div>
                <h3 className="text-pokemon-gold font-medium">Analytics Cookies</h3>
                <p className="text-gray-400 text-sm">Help us understand how you use the site to improve performance</p>
              </div>
              <div>
                <h3 className="text-pokemon-gold font-medium">Preference Cookies</h3>
                <p className="text-gray-400 text-sm">Remember your settings like language and currency preferences</p>
              </div>
            </div>

            <p className="text-gray-300 mt-4 text-sm">
              You can control cookies through your browser settings, though some features may not work properly if disabled.
            </p>
          </section>

          {/* Changes to Policy */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">7. Changes to This Policy</h2>
            
            <p className="text-gray-300 mb-4">
              We may update this privacy policy from time to time. When we do:
            </p>

            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>We'll update the "Last updated" date at the top</li>
              <li>We'll notify you of significant changes via email or platform notification</li>
              <li>The updated policy will be posted on this page</li>
              <li>Your continued use of the platform constitutes acceptance of the updated policy</li>
            </ul>
          </section>

          {/* Contact */}
          <section className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
              <Mail className="w-5 h-5 text-pokemon-gold mr-2" />
              Contact Us
            </h2>
            
            <p className="text-gray-300 mb-4">
              If you have questions about this privacy policy or how we handle your data, please contact us:
            </p>

            <div className="space-y-2 text-gray-300">
              <p><strong>Email:</strong> <a href="mailto:privacy@lumidex.app" className="text-pokemon-gold hover:text-pokemon-gold-hover">privacy@lumidex.app</a></p>
              <p><strong>General Contact:</strong> <a href="mailto:hello@lumidex.app" className="text-pokemon-gold hover:text-pokemon-gold-hover">hello@lumidex.app</a></p>
              <p><strong>Support:</strong> <Link href="/support" className="text-pokemon-gold hover:text-pokemon-gold-hover">Visit our Support Center</Link></p>
            </div>
          </section>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-12 p-4 bg-pkmn-surface/30 rounded-lg border border-gray-700/30">
          <p className="text-xs text-gray-500 leading-relaxed">
            This privacy policy applies to lumidex.app and all related services. We are committed to protecting your privacy 
            and being transparent about our data practices.
          </p>
        </div>
      </div>
    </Navigation>
  )
}