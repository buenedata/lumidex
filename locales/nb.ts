/**
 * Norwegian Bokmål (nb) — translations for Lumidex.
 * Norwegian Bokmål is the primary written standard used by ~85–90 % of Norwegians.
 * All keys must mirror locales/en.ts exactly.
 */
const nb = {
  // ── Navbar ──────────────────────────────────────────────────────────────────
  nav_dashboard:           'Dashbord',
  nav_profile:             'Profil',
  nav_sets:                'Sett',
  nav_collection:          'Samling',
  nav_wanted_board:        'Ønsketavle',
  nav_faq:                 'Hjelp',
  nav_admin:               '🛠️ Admin',
  nav_upgrade:             '💎 Oppgrader',
  nav_sign_in:             'Logg inn',
  nav_sign_out:            'Logg ut',
  nav_search_placeholder:  'Søk etter kort...',
  nav_notifications:       'Varsler',
  nav_no_notifications:    'Ingen nye varsler',
  nav_pending:             '{count} ventende',
  nav_friend_requests_link:'Venneforespørsler →',
  nav_trade_offers_link:   'Byttetilbud →',
  nav_friend_sent:         '{name} sendte deg en venneforespørsel',
  nav_friend_accepted:     '{name} godtok venneforespørselen din',
  nav_friend_declined:     '{name} avslo venneforespørselen din',
  nav_trade_proposed:      '{name} foreslo en byttehandel',
  nav_card_count_singular: '{count} kort',
  nav_card_count_plural:   '{count} kort',

  // ── Footer ──────────────────────────────────────────────────────────────────
  footer_brand_description:  'Den ultimate samlersporeren for Pokémon TCG-kort. Katalogiser, spor og vis frem samlingen din med stil.',
  footer_explore:            'Utforsk',
  footer_browse_cards:       'Bla gjennom kort',
  footer_sets:               'Sett',
  footer_dashboard:          'Dashbord',
  footer_wanted_board:       'Ønsketavle',
  footer_my_account:         'Min konto',
  footer_my_collection:      'Min samling',
  footer_my_lists:           'Mine lister',
  footer_profile:            'Profil',
  footer_support:            'Support',
  footer_faq:                'Vanlige spørsmål',
  footer_discord:            'Discord',
  footer_copyright:          '© {year} Lumidex. Alle rettigheter forbeholdt.',
  footer_disclaimer:         'Ikke tilknyttet Nintendo, The Pokémon Company eller andre kortspillutgivere.',
  footer_made_by:            'Laget av',

  // ── Dashboard Hero ──────────────────────────────────────────────────────────
  greeting_morning:          'God morgen',
  greeting_afternoon:        'God ettermiddag',
  greeting_evening:          'God kveld',
  rank_master:               'Mestertrener',
  rank_elite:                'Elitetrener',
  rank_veteran:              'Veterantrener',
  rank_rising:               'Oppadstrebende trener',
  rank_new:                  'Ny trener',
  hero_card_singular:        'kort',
  hero_card_plural:          'kort',
  hero_set_singular:         'sett sporet',
  hero_set_plural:           'sett sporet',
  hero_set_complete_singular:'sett fullført',
  hero_set_complete_plural:  'sett fullført',
  hero_view_profile:         'Se profil',

  // ── Dashboard Stats ─────────────────────────────────────────────────────────
  stat_cards_owned:          'Eide kort',
  stat_unique_cards:         'Unike kort',
  stat_sets_tracked:         'Sporede sett',
  stat_sets_available:       'Tilgjengelige sett',

  // ── Quick Actions ───────────────────────────────────────────────────────────
  quick_actions_title:       'Hurtighandlinger',
  quick_find_card:           'Finn et kort',
  quick_browse_sets:         'Bla gjennom sett',
  quick_my_collection:       'Min samling',
  quick_my_profile:          'Min profil',
  quick_wanted_list:         'Ønskeliste',
  quick_wanted_board:        'Ønsketavle',

  // ── Browse Hero ─────────────────────────────────────────────────────────────
  browse_headline:            'Finn ethvert kort, kunstner eller produkt',
  browse_subheadline:         'Søk i hele Pokémon TCG-katalogen',
  browse_mode_cards:          'Kort',
  browse_mode_artists:        'Kunstnere',
  browse_mode_products:       'Produkter',
  browse_placeholder_cards:   'Søk etter kortnavn eller nummer…',
  browse_placeholder_artists: 'Søk etter kunstnere…',
  browse_placeholder_products:'Søk etter produkter…',
  browse_aria_search:         'Søk etter kort, kunstnere eller produkter',
  browse_aria_clear:          'Tøm søk',
} as const

export default nb
