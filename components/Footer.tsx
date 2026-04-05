import Link from 'next/link'

const NAV_GROUPS = [
  {
    label: 'Explore',
    links: [
      { href: '/browse', label: 'Browse Cards' },
      { href: '/sets', label: 'Sets' },
      { href: '/dashboard', label: 'Dashboard' },
    ],
  },
  {
    label: 'My Account',
    links: [
      { href: '/collection', label: 'My Collection' },
      { href: '/profile', label: 'Profile' },
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
                      <Link
                        href={link.href}
                        className="text-sm text-secondary hover:text-accent transition-colors"
                      >
                        {link.label}
                      </Link>
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
