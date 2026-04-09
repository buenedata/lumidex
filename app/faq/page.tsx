import Link from 'next/link'

export const metadata = {
  title: 'FAQ — Lumidex',
  description: 'Frequently asked questions about Lumidex — the Pokémon TCG collection tracker.',
}

interface FAQItem {
  question: string
  answer: React.ReactNode
}

const FAQ_SECTIONS: { section: string; items: FAQItem[] }[] = [
  {
    section: 'General',
    items: [
      {
        question: 'What is Lumidex?',
        answer:
          'Lumidex is a Pokémon TCG collection tracker. You can catalogue every card you own, track prices from CardMarket and TCGPlayer, connect with friends, manage trade proposals, and showcase your collection.',
      },
      {
        question: 'Is Lumidex free to use?',
        answer:
          'Yes — Lumidex is free right now, but we will have two memberships in the future. One paid and one free. More information about this will come at a later stage.',
      },
      {
        question: 'Which card games does Lumidex support?',
        answer:
          'Currently Lumidex focuses on the Pokémon Trading Card Game (English and other languages). Support for additional card games may be added in the future.',
      },
    ],
  },
  {
    section: 'Collection & Cards',
    items: [
      {
        question: 'How do I add cards to my collection?',
        answer: (
          <>
            Browse to any set under{' '}
            <Link href="/sets" className="text-accent hover:underline">Sets</Link>
            {' '}or search for a card via the top search bar. Click a card to open its detail modal,
            then use the + / − buttons to set how many copies you own. You can track individual
            variants (Normal, Reverse Holo, Cosmos Holo, etc.) separately.
          </>
        ),
      },
      {
        question: 'Can I track graded cards (PSA, BGS, CGC)?',
        answer:
          'Yes. Open a card modal, scroll to the bottom of the Card tab, and use the "Add graded copy" button to log a graded card with its grade and grading company.',
      },
      {
        question: 'How do I track sealed products?',
        answer: (
          <>
            Go to your{' '}
            <Link href="/collection" className="text-accent hover:underline">Collection</Link>
            {' '}page and switch to the Sealed Products tab. You can add booster boxes, ETBs, tins, and other sealed items.
          </>
        ),
      },
      {
        question: 'What does "Missing variant?" mean?',
        answer: (
          <>
            If a card is missing a variant you own — for example a Shiny, First Edition, or
            Prerelease stamp — you can suggest it to us. Open the card&rsquo;s detail modal and
            click the <strong>Missing variant?</strong> button. A small form will appear where you
            enter the variant name (required) and an optional description. Once you submit, our
            team will review the suggestion and add the variant to the database if it&rsquo;s
            valid. You need to be logged in to use this feature.
          </>
        ),
      },
      {
        question: 'What is the Wanted Board?',
        answer: (
          <>
            The{' '}
            <Link href="/wanted-board" className="text-accent hover:underline">Wanted Board</Link>
            {' '}shows you matches between cards you want and cards your friends own — and vice versa. It&rsquo;s the starting point for proposing trades.
          </>
        ),
      },
    ],
  },
  {
    section: 'Prices',
    items: [
      {
        question: 'Where does price data come from?',
        answer:
          'Lumidex pulls market prices from CardMarket (EUR) and TCGPlayer (USD). Prices are updated on a regular schedule. You can switch your preferred currency in your profile settings.',
      },
      {
        question: 'Why does a card show no price?',
        answer:
          'Some cards or variants don\'t yet have price data from our sources. Prices for newer sets or rare variants may take a little time to appear after a set release.',
      },
      {
        question: 'How is my collection value calculated?',
        answer:
          'Your collection value is the sum of market prices for every card and sealed product you own, using your preferred currency. Graded card prices use dedicated graded-sale data where available.',
      },
    ],
  },
  {
    section: 'Friends & Trading',
    items: [
      {
        question: 'How do I add friends?',
        answer: (
          <>
            Go to your{' '}
            <Link href="/profile" className="text-accent hover:underline">Profile</Link>
            {' '}and click <strong>Find Friends</strong>. Search by username and send a friend request.
            Once the other person accepts, you&rsquo;ll appear in each other&rsquo;s friends list.
          </>
        ),
      },
      {
        question: 'How does trading work?',
        answer: (
          <>
            Open the{' '}
            <Link href="/wanted-board" className="text-accent hover:underline">Wanted Board</Link>
            {' '}to see trade matches with friends. Click <strong>Propose Trade</strong> next to a match to open the Trade Hub,
            choose which cards you&rsquo;re offering and requesting, add optional notes, and submit.
            Your friend will receive a notification and can accept or decline.
          </>
        ),
      },
      {
        question: 'Can I see which friends own a specific card?',
        answer:
          'Yes. Open any card modal and click the Friends tab. It shows every friend who owns that card, which variants they have, and a quick "Propose trade" button.',
      },
    ],
  },
  {
    section: 'Account & Privacy',
    items: [
      {
        question: 'Can I make my profile private?',
        answer:
          'You can control who sees your portfolio value (everyone, friends only, or just you) from your profile Settings. Public friends lists and collection counts are visible by default.',
      },
      {
        question: 'How do I change my username or avatar?',
        answer:
          'Open your Profile and click the Settings (gear) icon. You can update your display name, username, avatar, and banner from there.',
      },
      {
        question: 'How do I delete my account?',
        answer: (
          <>
            Please reach out to us on{' '}
            <a
              href="https://discord.gg/J86x7tccbW"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Discord
            </a>
            {' '}and we&rsquo;ll take care of it promptly.
          </>
        ),
      },
    ],
  },
  {
    section: 'Support',
    items: [
      {
        question: 'I found a bug or something looks wrong — what do I do?',
        answer: (
          <>
            Please report it in our{' '}
            <a
              href="https://discord.gg/J86x7tccbW"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Discord server
            </a>
            . Include what you were doing, what you expected to happen, and what actually happened. Screenshots are always helpful.
          </>
        ),
      },
      {
        question: 'How do I suggest a new feature?',
        answer: (
          <>
            Join the{' '}
            <a
              href="https://discord.gg/J86x7tccbW"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              Discord
            </a>
            {' '}and post in the suggestions channel. We actively read and discuss feature requests from the community.
          </>
        ),
      },
    ],
  },
]

export default function FAQPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 py-12 sm:py-16">

      {/* Header */}
      <div className="mb-12">
        <h1
          className="text-3xl sm:text-4xl font-bold text-primary mb-3"
          style={{ fontFamily: 'var(--font-space-grotesk)' }}
        >
          Frequently Asked Questions
        </h1>
        <p className="text-secondary text-base leading-relaxed">
          Can&rsquo;t find your answer here? Come chat with us on{' '}
          <a
            href="https://discord.gg/J86x7tccbW"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline font-medium"
          >
            Discord
          </a>
          .
        </p>
      </div>

      {/* Sections */}
      <div className="flex flex-col gap-12">
        {FAQ_SECTIONS.map((section) => (
          <section key={section.section}>
            <h2
              className="text-xs font-semibold uppercase tracking-widest text-accent mb-5"
              style={{ fontFamily: 'var(--font-space-grotesk)' }}
            >
              {section.section}
            </h2>

            <div className="flex flex-col divide-y divide-subtle border border-subtle rounded-2xl overflow-hidden">
              {section.items.map((item) => (
                <div key={item.question} className="px-5 py-5 bg-[color:var(--color-bg-surface)]">
                  <p className="text-sm font-semibold text-primary mb-2">{item.question}</p>
                  <div className="text-sm text-secondary leading-relaxed">{item.answer}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Bottom CTA */}
      <div className="mt-16 rounded-2xl border border-subtle bg-elevated px-6 py-8 text-center">
        <p className="text-base font-semibold text-primary mb-2">Still have questions?</p>
        <p className="text-sm text-secondary mb-5">
          Our community and team are happy to help.
        </p>
        <a
          href="https://discord.gg/J86x7tccbW"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 h-10 px-6 text-sm font-semibold rounded-xl bg-accent text-white hover:bg-accent-light transition-colors"
        >
          {/* Discord icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.364 12.364 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.175 13.175 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
          </svg>
          Join Discord
        </a>
      </div>

    </main>
  )
}
