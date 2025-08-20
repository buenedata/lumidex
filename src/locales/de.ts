import { TranslationKeys } from './en'

export const de: TranslationKeys = {
  // Navigation
  nav: {
    dashboard: 'Dashboard',
    cards: 'Karten durchsuchen',
    collection: 'Meine Sammlung',
    friends: 'Freunde',
    wishlist: 'Wunschliste',
    matches: 'Sammlungsübereinstimmungen',
    trades: 'Handel',
    achievements: 'Erfolge',
    statistics: 'Statistiken',
    profile: 'Profil',
    admin: 'Admin-Panel'
  },

  // Common
  common: {
    loading: 'Lädt...',
    error: 'Fehler',
    success: 'Erfolg',
    cancel: 'Abbrechen',
    save: 'Speichern',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    add: 'Hinzufügen',
    remove: 'Entfernen',
    search: 'Suchen',
    filter: 'Filter',
    sort: 'Sortieren',
    clear: 'Löschen',
    close: 'Schließen',
    back: 'Zurück',
    next: 'Weiter',
    previous: 'Vorherige',
    submit: 'Absenden',
    confirm: 'Bestätigen',
    yes: 'Ja',
    no: 'Nein'
  },

  // Authentication
  auth: {
    signIn: 'Anmelden',
    signUp: 'Registrieren',
    signOut: 'Abmelden',
    email: 'E-Mail',
    password: 'Passwort',
    confirmPassword: 'Passwort bestätigen',
    forgotPassword: 'Passwort vergessen?',
    resetPassword: 'Passwort zurücksetzen',
    createAccount: 'Konto erstellen',
    alreadyHaveAccount: 'Bereits ein Konto?',
    dontHaveAccount: 'Noch kein Konto?',
    signInWithEmail: 'Mit E-Mail anmelden',
    signUpWithEmail: 'Mit E-Mail registrieren'
  },

  // Dashboard
  dashboard: {
    welcome: 'Willkommen!',
    welcomeMessage: 'Beginnen Sie mit dem Aufbau Ihrer Pokemon-Kartensammlung',
    collectionStats: 'Sammlung',
    quickActions: 'Schnellaktionen',
    browseCards: 'Karten durchsuchen',
    browseCardsDesc: 'Entdecken Sie Pokemon-Karten mit europäischen Preisen',
    myCollection: 'Meine Sammlung',
    myCollectionDesc: 'Verwalten Sie Ihre Kartensammlung',
    friendsDesc: 'Verbinden Sie sich mit anderen Sammlern',
    wishlistDesc: 'Verfolgen Sie Karten, die Sie erwerben möchten',
    collectionMatchesDesc: 'Finden Sie Karten, die Ihre Freunde haben und die Sie wollen',
    tradingDesc: 'Handeln Sie Karten mit Freunden',
    achievementsDesc: 'Schalten Sie Sammlungsmeilensteine frei und verdienen Sie Belohnungen',
    statisticsDesc: 'Sehen Sie detaillierte Sammlungsanalysen und Einblicke',
    profileDesc: 'Sehen und bearbeiten Sie Ihr Profil und Ihre Sammlungsübersicht'
  },

  // Cards
  cards: {
    title: 'Pokemon-Karten',
    searchPlaceholder: 'Nach Pokemon-Karten suchen...',
    noResults: 'Keine Karten gefunden',
    noResultsDesc: 'Versuchen Sie, Ihre Suche oder Filter anzupassen',
    rarity: 'Seltenheit',
    set: 'Set',
    type: 'Typ',
    addToCollection: 'Zur Sammlung hinzufügen',
    addToWishlist: 'Zur Wunschliste hinzufügen',
    viewDetails: 'Details anzeigen',
    estimatedValue: 'Geschätzter Wert',
    cardNumber: 'Kartennummer',
    artist: 'Künstler',
    releaseDate: 'Veröffentlichungsdatum'
  },

  // Collection
  collection: {
    title: 'Meine Sammlung',
    totalCards: 'Gesamte Karten',
    uniqueCards: 'Einzigartige Karten',
    totalValue: 'Gesamtwert',
    recentAdditions: 'Neueste Ergänzungen',
    noCards: 'Keine Karten in der Sammlung',
    noCardsDesc: 'Beginnen Sie mit dem Hinzufügen von Karten, um Ihre Sammlung aufzubauen!',
    removeFromCollection: 'Aus Sammlung entfernen',
    quantity: 'Anzahl',
    condition: 'Zustand',
    addedDate: 'Hinzugefügt am'
  },

  // Friends
  friends: {
    title: 'Freunde',
    addFriend: 'Freund hinzufügen',
    friendRequests: 'Freundschaftsanfragen',
    myFriends: 'Meine Freunde',
    findFriends: 'Freunde finden',
    sendRequest: 'Anfrage senden',
    acceptRequest: 'Akzeptieren',
    declineRequest: 'Ablehnen',
    removeFriend: 'Freund entfernen',
    noFriends: 'Noch keine Freunde',
    noFriendsDesc: 'Verbinden Sie sich mit anderen Sammlern!',
    friendsSince: 'Freunde seit',
    pendingRequests: 'Ausstehende Anfragen',
    searchFriends: 'Nach Freunden per E-Mail suchen...'
  },

  // Trading
  trading: {
    title: 'Handel',
    proposeTrade: 'Handel vorschlagen',
    myTrades: 'Meine Handelsgeschäfte',
    sentTrades: 'Gesendete Handelsgeschäfte',
    receivedTrades: 'Erhaltene Handelsgeschäfte',
    acceptTrade: 'Handel akzeptieren',
    declineTrade: 'Handel ablehnen',
    cancelTrade: 'Handel abbrechen',
    tradeWith: 'Handeln mit',
    yourCards: 'Ihre Karten',
    theirCards: 'Deren Karten',
    selectCards: 'Karten auswählen',
    noTrades: 'Noch keine Handelsgeschäfte',
    noTradesDesc: 'Beginnen Sie den Handel mit Ihren Freunden!',
    tradeStatus: 'Handelsstatus',
    pending: 'Ausstehend',
    accepted: 'Akzeptiert',
    declined: 'Abgelehnt',
    completed: 'Abgeschlossen'
  },

  // Achievements
  achievements: {
    title: 'Erfolge',
    overview: 'Übersicht',
    progress: 'Fortschritt',
    unlocked: 'Freigeschaltet',
    locked: 'Gesperrt',
    points: 'Punkte',
    totalPoints: 'Gesamtpunkte',
    unlockedAt: 'Freigeschaltet',
    categories: {
      collection: 'Sammlung',
      social: 'Sozial',
      trading: 'Handel',
      special: 'Besonders'
    },
    rarity: {
      common: 'Häufig',
      rare: 'Selten',
      epic: 'Episch',
      legendary: 'Legendär'
    }
  },

  // Statistics
  statistics: {
    title: 'Sammlungsstatistiken',
    overview: 'Übersicht',
    setProgress: 'Set-Fortschritt',
    valueAnalysis: 'Wertanalyse',
    insights: 'Einblicke',
    totalCards: 'Gesamte Karten',
    uniqueCards: 'Einzigartige Karten',
    totalValue: 'Gesamtwert',
    averageValue: 'Durchschnittlicher Kartenwert',
    mostValuable: 'Wertvollste Karte',
    rarityBreakdown: 'Seltenheitsaufschlüsselung',
    recentAdditions: 'Neueste Ergänzungen',
    setCompletion: 'Set-Vervollständigung',
    topValueCards: 'Wertvollste Karten',
    noInsights: 'Keine Einblicke verfügbar',
    noInsightsDesc: 'Bauen Sie Ihre Sammlung auf, um personalisierte Einblicke und Empfehlungen freizuschalten.'
  },

  // Profile
  profile: {
    title: 'Profil',
    editProfile: 'Profil bearbeiten',
    memberSince: 'Mitglied seit',
    bio: 'Biografie',
    location: 'Standort',
    favoriteSet: 'Lieblings-Set',
    collectionValue: 'Sammlungswert',
    recentCards: 'Neueste Karten',
    recentAchievements: 'Neueste Erfolge',
    viewAll: 'Alle anzeigen',
    noCollection: 'Keine Sammlungsdaten',
    noCollectionDesc: 'Beginnen Sie mit dem Hinzufügen von Karten zu Ihrer Sammlung, um Statistiken zu sehen.'
  },

  // Wishlist
  wishlist: {
    title: 'Wunschliste',
    addToWishlist: 'Zur Wunschliste hinzufügen',
    removeFromWishlist: 'Von Wunschliste entfernen',
    priority: 'Priorität',
    maxPrice: 'Höchstpreis',
    notes: 'Notizen',
    noItems: 'Keine Artikel in der Wunschliste',
    noItemsDesc: 'Fügen Sie Karten, die Sie erwerben möchten, zu Ihrer Wunschliste hinzu!',
    priorities: {
      low: 'Niedrig',
      medium: 'Mittel',
      high: 'Hoch'
    }
  },

  // Errors
  errors: {
    generic: 'Etwas ist schief gelaufen. Bitte versuchen Sie es erneut.',
    network: 'Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung.',
    unauthorized: 'Sie sind nicht berechtigt, diese Aktion durchzuführen.',
    notFound: 'Die angeforderte Ressource wurde nicht gefunden.',
    validation: 'Bitte überprüfen Sie Ihre Eingabe und versuchen Sie es erneut.',
    server: 'Serverfehler. Bitte versuchen Sie es später erneut.'
  },

  // Success messages
  success: {
    cardAdded: 'Karte zur Sammlung hinzugefügt',
    cardRemoved: 'Karte aus Sammlung entfernt',
    friendAdded: 'Freundschaftsanfrage gesendet',
    friendRemoved: 'Freund entfernt',
    tradeProposed: 'Handel erfolgreich vorgeschlagen',
    tradeAccepted: 'Handel akzeptiert',
    profileUpdated: 'Profil erfolgreich aktualisiert',
    wishlistUpdated: 'Wunschliste aktualisiert'
  }
}