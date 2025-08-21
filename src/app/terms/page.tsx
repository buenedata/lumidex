'use client'

import Navigation from '@/components/navigation/Navigation'
import Link from 'next/link'
import { FileText, AlertTriangle, Users, Gavel } from 'lucide-react'

export default function TermsOfUsePage() {
  return (
    <Navigation>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <FileText className="w-12 h-12 text-pokemon-gold mr-3" />
            <h1 className="text-4xl font-bold text-white">Terms of Use</h1>
          </div>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Please read these terms carefully before using lumidex.app
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Last updated: January 1, 2025
          </p>
        </div>

        {/* Agreement Notice */}
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-6 mb-8">
          <div className="flex items-start">
            <AlertTriangle className="w-6 h-6 text-yellow-400 mr-3 mt-1 flex-shrink-0" />
            <div>
              <h2 className="text-lg font-bold text-yellow-300 mb-2">Agreement to Terms</h2>
              <p className="text-yellow-200 text-sm leading-relaxed">
                By accessing or using lumidex.app, you agree to be bound by these Terms of Use and our Privacy Policy. 
                If you do not agree to these terms, please do not use our platform.
              </p>
            </div>
          </div>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Service Description */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">1. Service Description</h2>
            
            <p className="text-gray-300 mb-4">
              lumidex.app is a digital platform designed for Pokémon Trading Card Game (TCG) collectors to:
            </p>

            <ul className="list-disc list-inside text-gray-300 space-y-1 mb-4">
              <li>Manage and track their card collections</li>
              <li>Connect and trade with other collectors</li>
              <li>Access pricing information and market data</li>
              <li>Participate in community features and leaderboards</li>
              <li>Discover new cards and sets</li>
            </ul>

            <p className="text-gray-300 text-sm">
              We reserve the right to modify, suspend, or discontinue any part of our service at any time with reasonable notice.
            </p>
          </section>

          {/* User Accounts */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">2. User Accounts and Registration</h2>
            
            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Account Requirements</h3>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
              <li>You must be at least 13 years old to create an account</li>
              <li>You must provide accurate and complete information</li>
              <li>You are responsible for maintaining account security</li>
              <li>You may not share your account credentials</li>
              <li>You may not create multiple accounts</li>
            </ul>

            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Account Responsibilities</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>Keep your login information secure</li>
              <li>Notify us immediately of any unauthorized access</li>
              <li>Update your information when it changes</li>
              <li>Comply with all applicable laws and regulations</li>
            </ul>
          </section>

          {/* Acceptable Use */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">3. Acceptable Use Policy</h2>
            
            <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 mb-4">
              <h3 className="text-green-300 font-medium mb-2">✅ You may:</h3>
              <ul className="list-disc list-inside text-green-200 text-sm space-y-1">
                <li>Use the platform for personal, non-commercial collection management</li>
                <li>Trade cards with other users through our platform</li>
                <li>Share collection information with the community</li>
                <li>Participate in discussions and community features</li>
              </ul>
            </div>

            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
              <h3 className="text-red-300 font-medium mb-2">❌ You may not:</h3>
              <ul className="list-disc list-inside text-red-200 text-sm space-y-1">
                <li>Use the platform for commercial purposes without permission</li>
                <li>Post offensive, abusive, or inappropriate content</li>
                <li>Attempt to hack, reverse engineer, or disrupt our services</li>
                <li>Create fake accounts or impersonate others</li>
                <li>Spam other users or send unsolicited messages</li>
                <li>Share copyrighted material without permission</li>
                <li>Engage in fraudulent trading or misrepresent cards</li>
                <li>Use automated tools to scrape data or create accounts</li>
              </ul>
            </div>
          </section>

          {/* Trading and Community */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
              <Users className="w-5 h-5 text-pokemon-gold mr-2" />
              4. Trading and Community Guidelines
            </h2>
            
            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Trading Rules</h3>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
              <li>All trades are between users - lumidex.app facilitates but does not participate</li>
              <li>Accurately represent the condition and authenticity of your cards</li>
              <li>Complete trades in good faith and in a timely manner</li>
              <li>Report any issues or disputes to our support team</li>
              <li>Follow through on agreed trades unless both parties consent to cancel</li>
            </ul>

            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Community Standards</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>Treat all users with respect and courtesy</li>
              <li>Keep discussions relevant to Pokémon TCG collecting</li>
              <li>No harassment, discrimination, or offensive behavior</li>
              <li>Respect others' privacy and personal information</li>
              <li>Report inappropriate behavior to moderators</li>
            </ul>

            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4 mt-4">
              <p className="text-blue-200 text-sm">
                <strong>Important:</strong> lumidex.app is not responsible for trades between users. 
                We provide the platform but cannot guarantee the completion or satisfaction of any trade.
              </p>
            </div>
          </section>

          {/* Intellectual Property */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">5. Intellectual Property</h2>
            
            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Pokémon Content</h3>
            <p className="text-gray-300 mb-4">
              All Pokémon names, characters, images, and related content are trademarks and copyrights of Nintendo, 
              Game Freak, Creatures Inc., and The Pokémon Company International. lumidex.app is not affiliated with 
              or endorsed by these companies.
            </p>

            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Platform Content</h3>
            <p className="text-gray-300 mb-4">
              The lumidex.app platform, including its design, features, and original content, is owned by us and 
              protected by copyright and other intellectual property laws.
            </p>

            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">User Content</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>You retain ownership of content you create (profile information, comments, etc.)</li>
              <li>By posting content, you grant us a license to display and distribute it on our platform</li>
              <li>You are responsible for ensuring you have rights to any content you post</li>
              <li>We may remove content that violates these terms or applicable laws</li>
            </ul>
          </section>

          {/* Privacy and Data */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">6. Privacy and Data Protection</h2>
            
            <p className="text-gray-300 mb-4">
              Your privacy is important to us. Our collection, use, and protection of your personal information 
              is governed by our <Link href="/privacy" className="text-pokemon-gold hover:text-pokemon-gold-hover">Privacy Policy</Link>, 
              which is incorporated into these terms by reference.
            </p>

            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Key Points</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>We collect information necessary to provide our services</li>
              <li>We protect your data using industry-standard security measures</li>
              <li>We do not sell your personal information to third parties</li>
              <li>You have rights regarding your data as described in our Privacy Policy</li>
            </ul>
          </section>

          {/* Disclaimers */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center">
              <Gavel className="w-5 h-5 text-pokemon-gold mr-2" />
              7. Disclaimers and Limitations
            </h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-pokemon-gold mb-2">Service Availability</h3>
                <p className="text-gray-300 text-sm">
                  We strive to maintain high uptime but cannot guarantee uninterrupted service. 
                  We are not liable for any downtime or service disruptions.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-pokemon-gold mb-2">Pricing Information</h3>
                <p className="text-gray-300 text-sm">
                  Card prices are estimates based on third-party data and market analysis. 
                  We do not guarantee price accuracy and are not responsible for trading decisions based on our pricing data.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-pokemon-gold mb-2">User Interactions</h3>
                <p className="text-gray-300 text-sm">
                  We facilitate connections between users but are not responsible for the actions, 
                  conduct, or content of other users. Trade at your own risk.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-pokemon-gold mb-2">Data Loss</h3>
                <p className="text-gray-300 text-sm">
                  While we implement robust backup systems, we recommend users maintain their own 
                  records of important collection data.
                </p>
              </div>
            </div>
          </section>

          {/* Termination */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">8. Account Termination</h2>
            
            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Your Rights</h3>
            <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">
              <li>You may delete your account at any time through your account settings</li>
              <li>You can export your collection data before deletion</li>
              <li>Account deletion is typically permanent and cannot be undone</li>
            </ul>

            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">Our Rights</h3>
            <p className="text-gray-300 mb-2">We may suspend or terminate accounts that:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>Violate these Terms of Use</li>
              <li>Engage in fraudulent or abusive behavior</li>
              <li>Compromise platform security or other users' safety</li>
              <li>Remain inactive for extended periods (with notice)</li>
            </ul>
          </section>

          {/* Changes to Terms */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">9. Changes to Terms</h2>
            
            <p className="text-gray-300 mb-4">
              We may update these Terms of Use from time to time to reflect changes in our services, 
              applicable laws, or business practices.
            </p>

            <h3 className="text-lg font-semibold text-pokemon-gold mb-3">When we update terms:</h3>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              <li>We'll update the "Last updated" date</li>
              <li>We'll notify users of significant changes via email or platform notification</li>
              <li>The updated terms will be posted on this page</li>
              <li>Continued use of the platform constitutes acceptance of updated terms</li>
              <li>If you don't agree to updated terms, you may delete your account</li>
            </ul>
          </section>

          {/* Governing Law */}
          <section className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">10. Governing Law and Disputes</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-pokemon-gold mb-2">Governing Law</h3>
                <p className="text-gray-300 text-sm">
                  These terms are governed by the laws of Norway, without regard to conflict of law principles.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-pokemon-gold mb-2">Dispute Resolution</h3>
                <p className="text-gray-300 text-sm mb-2">
                  We encourage users to contact us first to resolve any disputes informally. 
                  If informal resolution is not possible:
                </p>
                <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                  <li>Disputes will be resolved through binding arbitration</li>
                  <li>Arbitration will be conducted in accordance with Norwegian arbitration rules</li>
                  <li>Each party will bear their own costs unless otherwise determined by the arbitrator</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-bold text-white mb-4">11. Contact Information</h2>
            
            <p className="text-gray-300 mb-4">
              If you have questions about these Terms of Use, please contact us:
            </p>

            <div className="space-y-2 text-gray-300">
              <p><strong>Legal inquiries:</strong> <a href="mailto:legal@lumidex.app" className="text-pokemon-gold hover:text-pokemon-gold-hover">legal@lumidex.app</a></p>
              <p><strong>General questions:</strong> <a href="mailto:hello@lumidex.app" className="text-pokemon-gold hover:text-pokemon-gold-hover">hello@lumidex.app</a></p>
              <p><strong>Support:</strong> <Link href="/support" className="text-pokemon-gold hover:text-pokemon-gold-hover">Visit our Support Center</Link></p>
            </div>
          </section>
        </div>

        {/* Acknowledgment */}
        <div className="text-center mt-12 p-6 bg-pkmn-card rounded-xl border border-gray-700/50">
          <h3 className="text-lg font-bold text-white mb-3">Acknowledgment</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            By using lumidex.app, you acknowledge that you have read, understood, and agree to be bound by these Terms of Use. 
            These terms, together with our Privacy Policy, constitute the complete agreement between you and lumidex.app.
          </p>
        </div>
      </div>
    </Navigation>
  )
}