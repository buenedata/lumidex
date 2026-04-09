import Link from 'next/link'

const NAV_GROUPS = [
  {
    label: 'Explore',
    links: [
      { href: '/browse', label: 'Browse Cards' },
      { href: '/sets', label: 'Sets' },
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/wanted-board', label: 'Wanted Board' },
    ],
  },
  {
    label: 'My Account',
    links: [
      { href: '/collection', label: 'My Collection' },
      { href: '/lists', label: 'My Lists' },
      { href: '/profile', label: 'Profile' },
    ],
  },
  {
    label: 'Support',
    links: [
      { href: '/faq', label: 'FAQ' },
      { href: 'https://discord.gg/J86x7tccbW', label: 'Discord', external: true },
    ],
  },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-subtle bg-[color:var(--color-bg-surface)] mt-auto">
      <div className="max-w-screen-2xl mx-auto px-4 py-10 sm:py-12">

        {/* Top section: Brand + Nav groups */}
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between sm:gap-8">

          {/* Brand */}
          <div className="flex flex-col gap-3 max-w-xs">
            <Link href="/dashboard" className="flex items-center w-fit">
              <img src="/logo.svg" alt="Lumidex" className="h-8 w-auto" />
            </Link>
            <p className="text-sm text-muted leading-relaxed">
              Your ultimate trading card collection tracker. Catalogue, track and showcase your Pokémon TCG collection with style.
            </p>
            {/* Social icons */}
            <div className="flex items-center gap-3 mt-1">
              <a
                href="https://www.instagram.com/lumidex.app/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-muted hover:text-accent transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href="https://www.facebook.com/profile.php?id=61575439778957"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-muted hover:text-accent transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
              <a
                href="https://discord.gg/J86x7tccbW"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Discord"
                className="text-muted hover:text-accent transition-colors"
              >
                {/* Discord logo — filled shape; does not render well as a stroke outline */}
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.364 12.364 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.175 13.175 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Nav link groups */}
          <div className="flex flex-wrap gap-10 sm:gap-16">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-col gap-3">
                <span
                  className="text-xs font-semibold uppercase tracking-widest text-primary"
                  style={{ fontFamily: 'var(--font-space-grotesk)' }}
                >
                  {group.label}
                </span>
                <ul className="flex flex-col gap-2">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {'external' in link && link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-secondary hover:text-accent transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-secondary hover:text-accent transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mt-10 border-t border-subtle" />

        {/* Bottom: copyright + disclaimer */}
        <div className="mt-6 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            © {year} Lumidex. All rights reserved.
          </p>
          <p className="text-xs text-muted">
            Not affiliated with Nintendo, The Pokémon Company, or any card game publishers.
          </p>
          <p className="text-xs text-muted">
            Made by{' '}
            <a
              href="https://www.buenedata.no"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              Buene Data
            </a>
          </p>
        </div>

      </div>
    </footer>
  )
}
