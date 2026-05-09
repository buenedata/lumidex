/**
 * English (en) — default locale for Lumidex.
 * This file is the source of truth for all translatable strings.
 * Every key added here MUST also be added to nb.ts.
 */
const en = {
  // ── Navbar ──────────────────────────────────────────────────────────────────
  nav_dashboard:           'Dashboard',
  nav_profile:             'Profile',
  nav_sets:                'Sets',
  nav_collection:          'Collection',
  nav_wanted_board:        'Wanted Board',
  nav_faq:                 'FAQ',
  nav_admin:               '🛠️ Admin',
  nav_upgrade:             '💎 Upgrade',
  nav_sign_in:             'Sign In',
  nav_sign_out:            'Sign Out',
  nav_search_placeholder:  'Search cards...',
  nav_notifications:       'Notifications',
  nav_no_notifications:    'No new notifications',
  /** {count} pending */
  nav_pending:             '{count} pending',
  nav_friend_requests_link:'Friend requests →',
  nav_trade_offers_link:   'Trade offers →',
  /** {name} sent you a friend request */
  nav_friend_sent:         '{name} sent you a friend request',
  /** {name} accepted your friend request */
  nav_friend_accepted:     '{name} accepted your friend request',
  /** {name} declined your friend request */
  nav_friend_declined:     '{name} declined your friend request',
  /** {name} proposed a trade */
  nav_trade_proposed:      '{name} proposed a trade',
  /** {count} card{s} · {time}  — caller builds the full string */
  nav_card_count_singular: '{count} card',
  nav_card_count_plural:   '{count} cards',

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer_brand_description:  'Your ultimate trading card collection tracker. Catalogue, track and showcase your Pokémon TCG collection with style.',
  footer_explore:            'Explore',
  footer_browse_cards:       'Browse Cards',
  footer_sets:               'Sets',
  footer_dashboard:          'Dashboard',
  footer_wanted_board:       'Wanted Board',
  footer_my_account:         'My Account',
  footer_my_collection:      'My Collection',
  footer_my_lists:           'My Lists',
  footer_profile:            'Profile',
  footer_support:            'Support',
  footer_faq:                'FAQ',
  footer_discord:            'Discord',
  /** © {year} Lumidex. All rights reserved. */
  footer_copyright:          '© {year} Lumidex. All rights reserved.',
  footer_disclaimer:         'Not affiliated with Nintendo, The Pokémon Company, or any card game publishers.',
  footer_made_by:            'Made by',

  // ── Dashboard Hero ──────────────────────────────────────────────────────────
  greeting_morning:          'Good morning',
  greeting_afternoon:        'Good afternoon',
  greeting_evening:          'Good evening',
  rank_master:               'Master Trainer',
  rank_elite:                'Elite Trainer',
  rank_veteran:              'Veteran Trainer',
  rank_rising:               'Rising Trainer',
  rank_new:                  'New Trainer',
  hero_card_singular:        'card',
  hero_card_plural:          'cards',
  hero_set_singular:         'set tracked',
  hero_set_plural:           'sets tracked',
  hero_set_complete_singular:'set complete',
  hero_set_complete_plural:  'sets complete',
  hero_view_profile:         'View Profile',

  // ── Dashboard Stats ─────────────────────────────────────────────────────────
  stat_cards_owned:          'Cards Owned',
  stat_unique_cards:         'Unique Cards',
  stat_sets_tracked:         'Sets Tracked',
  stat_sets_available:       'Sets Available',

  // ── Quick Actions ───────────────────────────────────────────────────────────
  quick_actions_title:       'Quick Actions',
  quick_find_card:           'Find a Card',
  quick_browse_sets:         'Browse Sets',
  quick_my_collection:       'My Collection',
  quick_my_profile:          'My Profile',
  quick_wanted_list:         'Wanted List',
  quick_wanted_board:        'Wanted Board',

  // ── Browse Hero ─────────────────────────────────────────────────────────────
  browse_headline:           'Find any card, artist or product',
  browse_subheadline:        'Search the complete Pokémon TCG catalogue',
  browse_mode_cards:         'Cards',
  browse_mode_artists:       'Artists',
  browse_mode_products:      'Products',
  browse_placeholder_cards:  'Search by card name or number…',
  browse_placeholder_artists:'Search artists…',
  browse_placeholder_products:'Search products…',
  browse_aria_search:        'Search cards, artists or products',
  browse_aria_clear:         'Clear search',
} as const

export type TranslationKey = keyof typeof en
/** Looser record type so other locales (with different string literals) can satisfy it. */
export type TranslationDict = Record<TranslationKey, string>

export default en
