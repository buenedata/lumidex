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
  footer_brand_description:  'Your ultimate trading card game collection tracker. Catalogue, track and showcase your TCG collection with style.',
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
  rank_master:               'Luminary',
  rank_virtuoso:             'Virtuoso',
  rank_elite:                'Curator',
  rank_veteran:              'Archivist',
  rank_rising:               'Enthusiast',
  rank_new:                  'Newcomer',
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
  browse_subheadline:        'Search the complete TCG catalogue',
  browse_mode_cards:         'Cards',
  browse_mode_artists:       'Artists',
  browse_mode_products:      'Products',
  browse_placeholder_cards:  'Search by card name or number…',
  browse_placeholder_artists:'Search artists…',
  browse_placeholder_products:'Search products…',
  browse_aria_search:        'Search cards, artists or products',
  browse_aria_clear:         'Clear search',

  // ── Profile page ─────────────────────────────────────────────────────────────
  profile_not_found:               'User not found',
  profile_not_found_desc:          "This profile doesn't exist or has been removed.",
  profile_go_back:                 'Go Back',
  profile_you:                     'You',
  /** Member since {date} */
  profile_member_since:            'Member since {date}',
  profile_settings_aria:           'Open profile settings',
  profile_settings_label:          'Settings',
  profile_private_notice:          'This profile is private.',
  profile_cards_collected:         'Cards Collected',
  profile_sets_started:            'Sets Started',
  profile_stat_friends:            'Friends',
  profile_friends_heading:         'Friends',
  /** {name}'s Friends */
  profile_friends_heading_other:   "{name}'s Friends",
  profile_sets_heading:            'Your Sets',
  /** {name}'s Sets */
  profile_sets_heading_other:      "{name}'s Sets",
  profile_sets_show:               'Show',
  profile_sets_hide:               'Hide',
  profile_no_collection:           'No collection yet',
  profile_no_sets_started:         'No sets started yet',
  profile_no_sets_own_desc:        'Start by browsing sets and tracking your cards',
  /** {name} hasn't added any sets yet */
  profile_no_sets_other_desc:      "{name} hasn't added any sets yet",
  profile_browse_sets:             'Browse Sets',
  profile_view_dashboard:          'View Dashboard',
  profile_achievements:            'Achievements',
  profile_achievements_own_empty:  "You haven't unlocked any achievements yet",
  profile_achievements_other_empty:'No achievements unlocked yet',
  profile_view_collection:         'View Collection',

  // ── Achievement categories ───────────────────────────────────────────────────
  achieve_cat_collection_size:  'Collection Size',
  achieve_cat_unique_cards:     'Unique Cards',
  achieve_cat_sets_tracked:     'Sets Tracked',
  achieve_cat_set_completion:   'Set Completion',
  achieve_cat_duplicates:       'Duplicates',
  achieve_cat_wanted_list:      'Wanted List',
  achieve_cat_sealed_products:  'Sealed Products',
  achieve_cat_social:           'Social',
  achieve_cat_profile:          'Profile',

  // ── Settings Form ────────────────────────────────────────────────────────────
  settings_section_identity:       'Identity',
  settings_display_name:           'Display Name',
  settings_display_name_ph:        'How you appear to others',
  settings_bio:                    'Bio',
  settings_bio_ph:                 'Tell the community a little about yourself…',
  settings_location:               'Location',
  settings_location_ph:            'e.g. Oslo, Norway',
  settings_section_locale:         'Locale',
  settings_preferred_language:     'Preferred Language',
  settings_preferred_currency:     'Preferred Currency',
  settings_section_display:        'Collection Display',
  settings_grey_out:               'Grey out unowned cards',
  settings_grey_out_desc:          "Cards you don't own will appear dimmed in set views",
  settings_section_privacy:        'Privacy',
  settings_private_profile:        'Private profile',
  settings_private_profile_desc:   'Your bio, location, sets and achievements will be hidden from other users',
  settings_lists_public:           'New lists are public by default',
  settings_lists_public_desc:      'When you create a new custom list it will be publicly visible unless you change it',
  settings_section_social:         'Social & Marketplace Links',
  settings_social_desc:            'These will appear as icons on your public profile.',
  settings_cardmarket_url:         'Cardmarket Profile URL',
  settings_instagram_label:        'Instagram',
  settings_facebook_url:           'Facebook Profile URL',

  // ── Settings Modal ───────────────────────────────────────────────────────────
  settings_modal_title:            'Profile Settings',
  settings_save:                   'Save Changes',
  settings_saving:                 'Saving…',
  settings_saved:                  '✓ Settings saved',
  settings_save_error:             'Failed to save settings. Please try again.',
  settings_cancel:                 'Cancel',
  settings_section_subscription:   'Subscription',
  settings_pro_active:             'All Pro features are active',
  settings_billing_opening:        'Opening…',
  settings_manage_billing:         'Manage Billing',
  settings_free_plan:              'Free Plan',
  settings_upgrade_cta:            'Upgrade to unlock graded cards, custom lists & more',
  settings_upgrade_link:           'Upgrade →',
  settings_section_danger:         'Danger Zone',
  settings_danger_desc:            'These actions are permanent and cannot be undone.',
  settings_reset_collection:       'Reset Collection',
  settings_reset_desc:             'Remove all cards and sealed products from your collection.',
  settings_reset_btn:              'Reset',
  settings_delete_account:         'Delete Account',
  settings_delete_desc:            'Permanently delete your account and all associated data.',
  settings_delete_btn:             'Delete',
  settings_reset_warning:          'This will permanently delete ALL cards and sealed products from your collection. Your account, friends, and settings will remain intact. This cannot be undone.',
  settings_delete_warning:         'This will permanently delete your account and all associated data — including your collection, friends list, and settings. You will be signed out immediately. This cannot be undone.',
  settings_confirm_reset:          'Yes, reset my collection',
  settings_confirm_delete:         'Yes, delete my account',
  settings_resetting:              'Resetting…',
  settings_deleting:               'Deleting…',
  /** Type your username {handle} to confirm */
  settings_type_username:          'Type your username {handle} to confirm',

  // ── First-time setup wizard ──────────────────────────────────────────────────
  setup_welcome_title:   'Welcome to Lumidex ✨',
  setup_skip:            'Skip setup',
  setup_personalise:     "Let's personalise your profile in a few quick steps.",
  setup_step_identity:   'Identity',
  setup_step_locale:     'Locale',
  setup_step_privacy:    'Privacy',
  setup_banner_label:    'Profile Banner',
  setup_display_name:    'Display Name',
  setup_display_name_ph: 'How you appear to others',
  setup_bio:             'Bio',
  setup_bio_ph:          'Tell the community a little about yourself…',
  setup_location:        'Location',
  setup_location_ph:     'e.g. Oslo, Norway',
  setup_back:            '← Back',
  setup_continue:        'Continue →',
  setup_finish:          'Finish Setup ✓',

  // ── Last Activity ────────────────────────────────────────────────────────────
  activity_title:  'Last Activity',
  activity_empty:  'No recent activity yet — start adding cards to your collection!',

  // ── Profile Lists ────────────────────────────────────────────────────────────
  lists_own_title:      'Your Lists',
  /** {name}'s Lists */
  lists_other_title:    "{name}'s Lists",
  lists_new:            'New List',
  lists_manage_all:     'Manage all →',
  lists_create_title:   'Create a new list',
  lists_name_placeholder:'List name…',
  lists_creating:       'Creating…',
  lists_create_btn:     'Create List',
  lists_cancel:         'Cancel',
  lists_loading:        'Loading lists…',
  lists_load_error:     'Could not load lists.',
  lists_create_error:   'Could not create list. Please try again.',
  lists_delete_confirm: 'Delete this list? This cannot be undone.',
  lists_own_empty:      'You have no lists yet.',
  lists_create_first:   'Create your first list',
  lists_other_empty:    'No public lists yet.',
  lists_no_cards:       'No cards yet',
  lists_card_count_1:   '{count} card',
  lists_card_count_n:   '{count} cards',
  lists_is_public:      '🌐 Public',
  lists_is_private:     '🔒 Private',
  lists_delete_title:   'Delete list',

  // ── Wanted Cards ─────────────────────────────────────────────────────────────
  wanted_own_title:     'Wanted Cards',
  /** {name}'s Wanted Cards */
  wanted_other_title:   "{name}'s Wanted Cards",
  wanted_own_empty:     'You have no wanted cards yet.',
  wanted_browse:        'Browse Cards',
  wanted_other_empty:   'No wanted cards yet.',
  wanted_loading:       'Loading wanted cards…',
  /** View all {count} → */
  wanted_view_all:      'View all {count} →',
  wanted_count_1:       '{count} card wanted',
  wanted_count_n:       '{count} cards wanted',
  /** showing 12 of {count} */
  wanted_showing:       'showing 12 of {count}',
  wanted_remove_title:  'Remove from wanted',
  wanted_more:          'more',

  // ── Friends ───────────────────────────────────────────────────────────────────
  friends_no_friends:        'No friends yet',
  friends_find:              'Find Friends',
  friends_requests_heading:  'Friend Requests',
  friends_sent_heading:      'Sent Friend Requests',
  friends_accept:            'Accept',
  friends_decline:           'Decline',
  friends_pending:           'Pending…',
  friends_cancelling:        'Cancelling…',
  friends_cancel:            'Cancel',
  friends_adding:            'Sending…',
  friends_add:               '+ Add Friend',
  friends_request_sent:      'Request Sent',
  friends_wants_to_friend:   'Wants to be friends',
  friends_friends_label:     'Friends',
  friends_remove:            'Remove',
  friends_remove_title:      'Remove friend',
  friends_cancel_title:      'Cancel request',
  friends_remove_confirm:    'Remove this friend?',

  // ── Add Friend Modal ──────────────────────────────────────────────────────────
  add_friend_title:       'Find Friends',
  add_friend_placeholder: 'Search by username or name…',
  add_friend_min_chars:   'Type at least 2 characters to search',
  /** No users found for "{query}" */
  add_friend_no_results:  'No users found for "{query}"',
  add_friend_friends:     '✓ Friends',

  // ── Collection Spotlight ──────────────────────────────────────────────────────
  spotlight_title:          'Collection Spotlight',
  /** {owned} / {total} cards collected */
  spotlight_cards_collected:'{owned} / {total} cards collected',
  spotlight_card_to_go:     '{n} card to go',
  spotlight_cards_to_go:    '{n} cards to go',
  spotlight_set_complete:   '🎉 Set complete!',
  spotlight_continue:       'Continue collecting',
  spotlight_sets_complete:  'Avg Completion',
  spotlight_avg_subtitle:   'avg across your sets',
  spotlight_cards_needed:   'Cards Needed',
  spotlight_all_complete:   'All sets complete!',
  spotlight_to_finish:      'to finish tracked sets',

  // ── Coming Soon / Roadmap ────────────────────────────────────────────────────
  coming_soon_heading:         "What's Coming to Lumidex",
  coming_soon_badge:           'Roadmap',
  coming_soon_label:           'Coming Soon',
  feature_trade_hub_title:     'Trade Hub',
  feature_trade_hub_tagline:   'Trade cards with friends',
  feature_trade_hub_desc:      'List your duplicates, browse what friends have, and arrange trades directly on Lumidex — no middlemen, no fees.',
  feature_marketplace_title:   'Marketplace',
  feature_marketplace_tagline: 'Buy & sell with ease',
  feature_marketplace_desc:    'A dedicated card marketplace to buy, sell and price-check any TCG card in your preferred local currency.',

  // ── Wanted Board (dashboard widget) ──────────────────────────────────────────
  wb_title:           'Wanted Board',
  wb_view_all:        'View all →',
  wb_match_single:    '{n} match',
  wb_match_plural:    '{n} matches',
  /** {name} proposed a trade */
  wb_proposed_trade:  '{name} proposed a trade',
  wb_card_single:     '{n} card',
  wb_card_plural:     '{n} cards',
  /** + {currency} cash */
  wb_cash:            ' + {currency} cash',
  /** {name} declined your trade offer */
  wb_declined:        '{name} declined your trade offer',
  wb_view:            'View →',
  wb_no_matches:      'No trade matches yet',
  wb_empty_desc:      'Star cards on your wanted list and connect with friends — when a friend owns a card you want (or vice‑versa), a trade match will appear here.',
  wb_add_wanted:      '★ Add Wanted Cards',
  wb_view_board:      'View Wanted Board →',
  wb_they_want:       'They want from you',
  wb_you_want:        'You want from them',
  wb_mutual:          'MUTUAL',
  /** Wants {n} card you own */
  wb_wants_card:      'Wants {n} card you own',
  /** Wants {n} cards you own */
  wb_wants_cards:     'Wants {n} cards you own',
  /** you want {n} */
  wb_you_want_n:      'you want {n}',
  wb_propose_trade:   '🔄 Propose Trade',

  // ── Sets page ─────────────────────────────────────────────────────────────────
  sets_search_placeholder: 'Search sets...',
  sets_lang_english:       'English',
  sets_lang_japanese:      'Japanese',
  sets_filter_all:         'All',
  sets_not_found:          'No sets found',
  sets_not_found_hint:     'Try a different search term',
  sets_favorites_heading:  '⭐ Favorites',
  sets_products_title:     'Products',
  sets_products_desc:      'Sealed product collection',
  sets_products_view_all:  'View all →',

  // ── News / Stories ────────────────────────────────────────────────────────────
  news_heading:   'Stories',
  news_subtitle:  'News, trivia and fun from the TCG world.',
  news_view_all:  'View All',
} as const

export type TranslationKey = keyof typeof en
/** Looser record type so other locales (with different string literals) can satisfy it. */
export type TranslationDict = Record<TranslationKey, string>

export default en
