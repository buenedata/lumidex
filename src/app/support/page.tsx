'use client'

import Navigation from '@/components/navigation/Navigation'
import Link from 'next/link'
import { 
  HelpCircle, 
  Mail, 
  MessageCircle, 
  FileText, 
  Shield, 
  Users, 
  CreditCard,
  Settings,
  Search,
  Bug,
  Lightbulb,
  ExternalLink
} from 'lucide-react'

export default function SupportPage() {
  const faqItems = [
    {
      category: "Getting Started",
      icon: HelpCircle,
      questions: [
        {
          question: "How do I add cards to my collection?",
          answer: "You can add cards by searching for them in our database, browsing sets, or using the quick-add feature from your dashboard. Click the '+' button on any card to add it to your collection."
        },
        {
          question: "How do I find other collectors to trade with?",
          answer: "Visit the Friends section to discover other collectors, use the Wanted Board to see what cards people are looking for, or check who else owns specific cards you're interested in trading."
        },
        {
          question: "Can I track card values and pricing?",
          answer: "Yes! We provide real-time pricing data from multiple sources. You can view individual card values and track your collection's total value over time."
        }
      ]
    },
    {
      category: "Trading",
      icon: Users,
      questions: [
        {
          question: "How does trading work on lumidex.app?",
          answer: "Trading happens between users directly. You can propose trades, negotiate terms, and complete exchanges. We facilitate the connection but don't handle the physical card exchange."
        },
        {
          question: "What if someone doesn't follow through on a trade?",
          answer: "Report any trading issues to our support team. We take trading disputes seriously and may take action against users who don't honor their trade agreements."
        },
        {
          question: "Can I trade internationally?",
          answer: "Yes, our platform supports international trading. However, users are responsible for understanding shipping costs, customs, and any applicable laws in their regions."
        }
      ]
    },
    {
      category: "Account & Privacy",
      icon: Shield,
      questions: [
        {
          question: "How do I change my privacy settings?",
          answer: "Go to your profile settings to control what information is public, who can see your collection, and your trading preferences."
        },
        {
          question: "Can I export my collection data?",
          answer: "Yes, you can export your collection data from your account settings. This creates a backup of your cards, values, and collection statistics."
        },
        {
          question: "How do I delete my account?",
          answer: "Account deletion can be done from your account settings. This action is permanent and cannot be undone, so make sure to export any data you want to keep first."
        }
      ]
    },
    {
      category: "Technical Issues",
      icon: Settings,
      questions: [
        {
          question: "Why are my card images not loading?",
          answer: "Try refreshing the page or clearing your browser cache. If the problem persists, it may be a temporary server issue that should resolve shortly."
        },
        {
          question: "The pricing data seems outdated. How often is it updated?",
          answer: "Pricing data is updated daily from our sources. Market fluctuations may cause temporary discrepancies. If you notice persistent issues, please report them."
        },
        {
          question: "I found a bug. How do I report it?",
          answer: "Use the bug report form below or email us directly. Please include details about what you were doing when the bug occurred and any error messages you saw."
        }
      ]
    }
  ]

  const contactMethods = [
    {
      title: "Email Support",
      description: "Get help with account issues, technical problems, or general questions",
      icon: Mail,
      contact: "hello@lumidex.app",
      response: "Usually within 24 hours"
    },
    {
      title: "Community Discord",
      description: "Join our community for real-time help and discussion",
      icon: MessageCircle,
      contact: "discord.gg/HYsr4gZjj6",
      response: "Active community support"
    },
    {
      title: "Bug Reports",
      description: "Report technical issues or suggest improvements",
      icon: Bug,
      contact: "bugs@lumidex.app",
      response: "Tracked and prioritized"
    }
  ]

  return (
    <Navigation>
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <HelpCircle className="w-12 h-12 text-pokemon-gold mr-3" />
            <h1 className="text-4xl font-bold text-white">Support Center</h1>
          </div>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Find answers to common questions, get help with technical issues, and connect with our support team
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {contactMethods.map((method, index) => (
            <div key={index} className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50 hover:border-pokemon-gold/30 transition-colors">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-pokemon-gold/10 rounded-xl flex items-center justify-center mr-4">
                  <method.icon className="w-6 h-6 text-pokemon-gold" />
                </div>
                <h3 className="text-lg font-bold text-white">{method.title}</h3>
              </div>
              <p className="text-gray-400 text-sm mb-4">{method.description}</p>
              <div className="space-y-2">
                {method.contact.includes('@') ? (
                  <a 
                    href={`mailto:${method.contact}`}
                    className="text-pokemon-gold hover:text-pokemon-gold-hover text-sm font-medium flex items-center"
                  >
                    {method.contact}
                    <ExternalLink className="w-4 h-4 ml-1" />
                  </a>
                ) : method.contact.includes('discord') ? (
                  <a 
                    href={`https://${method.contact}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-pokemon-gold hover:text-pokemon-gold-hover text-sm font-medium flex items-center"
                  >
                    Join Discord
                    <ExternalLink className="w-4 h-4 ml-1" />
                  </a>
                ) : (
                  <span className="text-pokemon-gold text-sm font-medium">{method.contact}</span>
                )}
                <p className="text-gray-500 text-xs">{method.response}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Frequently Asked Questions</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {faqItems.map((category, categoryIndex) => (
              <div key={categoryIndex} className="bg-pkmn-card rounded-xl p-6 border border-gray-700/50">
                <div className="flex items-center mb-6">
                  <category.icon className="w-6 h-6 text-pokemon-gold mr-3" />
                  <h3 className="text-xl font-bold text-white">{category.category}</h3>
                </div>
                
                <div className="space-y-6">
                  {category.questions.map((faq, faqIndex) => (
                    <div key={faqIndex} className="border-b border-gray-700/30 pb-4 last:border-b-0 last:pb-0">
                      <h4 className="text-white font-medium mb-2">{faq.question}</h4>
                      <p className="text-gray-400 text-sm leading-relaxed">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Additional Resources */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center mb-4">
              <FileText className="w-6 h-6 text-pokemon-gold mr-3" />
              <h3 className="text-xl font-bold text-white">Documentation</h3>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Learn more about our platform, features, and policies
            </p>
            <div className="space-y-2">
              <Link href="/about" className="block text-pokemon-gold hover:text-pokemon-gold-hover text-sm">
                → About lumidex.app
              </Link>
              <Link href="/privacy" className="block text-pokemon-gold hover:text-pokemon-gold-hover text-sm">
                → Privacy Policy
              </Link>
              <Link href="/terms" className="block text-pokemon-gold hover:text-pokemon-gold-hover text-sm">
                → Terms of Use
              </Link>
            </div>
          </div>

          <div className="bg-pkmn-surface rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-center mb-4">
              <Lightbulb className="w-6 h-6 text-pokemon-gold mr-3" />
              <h3 className="text-xl font-bold text-white">Feature Requests</h3>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              Have an idea for a new feature? We'd love to hear it!
            </p>
            <a 
              href="mailto:features@lumidex.app"
              className="inline-flex items-center px-4 py-2 bg-pokemon-gold/10 border border-pokemon-gold/30 text-pokemon-gold rounded-lg hover:bg-pokemon-gold/20 transition-colors text-sm"
            >
              Suggest a Feature
              <Mail className="w-4 h-4 ml-2" />
            </a>
          </div>
        </div>

        {/* Common Issues */}
        <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50 mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Common Issues & Solutions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-pkmn-surface/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">🔄 Login Problems</h3>
                <p className="text-gray-400 text-sm mb-2">Can't access your account?</p>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>• Check your email/password</li>
                  <li>• Try password reset</li>
                  <li>• Clear browser cookies</li>
                  <li>• Disable ad blockers temporarily</li>
                </ul>
              </div>

              <div className="bg-pkmn-surface/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">📱 Mobile Issues</h3>
                <p className="text-gray-400 text-sm mb-2">Problems on mobile devices?</p>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>• Update your browser</li>
                  <li>• Check internet connection</li>
                  <li>• Try desktop version</li>
                  <li>• Clear mobile browser cache</li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-pkmn-surface/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">💰 Pricing Issues</h3>
                <p className="text-gray-400 text-sm mb-2">Card values seem wrong?</p>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>• Prices update daily</li>
                  <li>• Check multiple sources</li>
                  <li>• Consider card condition</li>
                  <li>• Report persistent errors</li>
                </ul>
              </div>

              <div className="bg-pkmn-surface/50 rounded-lg p-4">
                <h3 className="text-white font-medium mb-2">🔍 Search Problems</h3>
                <p className="text-gray-400 text-sm mb-2">Can't find specific cards?</p>
                <ul className="text-gray-400 text-xs space-y-1">
                  <li>• Try different search terms</li>
                  <li>• Use set filters</li>
                  <li>• Check spelling</li>
                  <li>• Browse by series</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="bg-pkmn-card rounded-xl p-8 border border-gray-700/50">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Still Need Help?</h2>
          
          <div className="max-w-2xl mx-auto text-center">
            <p className="text-gray-400 mb-6">
              If you can't find the answer you're looking for, our support team is here to help. 
              Please include as much detail as possible about your issue.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a 
                href="mailto:hello@lumidex.app?subject=Support Request"
                className="inline-flex items-center justify-center px-6 py-3 bg-pokemon-gold text-black font-medium rounded-lg hover:bg-pokemon-gold-hover transition-colors"
              >
                <Mail className="w-5 h-5 mr-2" />
                Email Support
              </a>
              <a 
                href="https://discord.gg/HYsr4gZjj6"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-pkmn-surface border border-gray-700/50 text-white font-medium rounded-lg hover:bg-pkmn-dark transition-colors"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Join Discord
              </a>
            </div>

            <p className="text-gray-500 text-sm mt-4">
              Our support team typically responds within 24 hours during business days.
            </p>
          </div>
        </div>

        {/* Status & Updates */}
        <div className="text-center mt-8 p-4 bg-pkmn-surface/30 rounded-lg border border-gray-700/30">
          <p className="text-sm text-gray-400 mb-2">
            <strong>System Status:</strong> All systems operational ✅
          </p>
          <p className="text-xs text-gray-500">
            Follow us on Discord for real-time updates and maintenance announcements
          </p>
        </div>
      </div>
    </Navigation>
  )
}