# Lumidex - Pokémon Card Collection Tracker

A modern web application for tracking your Pokémon card collection with real-time data from the Pokémon TCG API. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## ✨ Features

- **🎴 Real Pokémon Data**: Live integration with Pokémon TCG API
- **📊 Collection Tracking**: Track card quantities including variants (normal, reverse holo, holo)
- **📈 Progress Monitoring**: Visual progress bars and completion percentages
- **🏆 Achievement System**: Unlock achievements as you build your collection
- **👥 Social Features**: Public profiles to share your collection progress
- **🔒 Secure Authentication**: Google OAuth and email/password authentication via Supabase
- **📱 Responsive Design**: Works perfectly on desktop and mobile devices
- **⚡ Fast Performance**: Cached API responses and optimized loading

## 🏗️ Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **State Management**: Zustand
- **Pokemon Data**: pokemontcgsdk
- **Styling**: Tailwind CSS (Dark mode default)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Supabase account
- (Optional) Pokémon TCG API key for higher rate limits

### 1. Clone the repository

\`\`\`bash
git clone <your-repo-url>
cd lumidex
\`\`\`

### 2. Install dependencies

\`\`\`bash
npm install
\`\`\`

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Run the database schema:
   - Go to SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `/database/schema.sql`
   - Run the script

### 4. Configure environment variables

1. Copy the environment template:
\`\`\`bash
cp .env.local.example .env.local
\`\`\`

2. Fill in your Supabase credentials:
\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
\`\`\`

3. (Optional) Add your RapidAPI key for live price data sync:
```env
# Required for the Price Sync admin feature (/admin/prices).
# Obtain at: https://rapidapi.com/ → search "Pokémon TCG API"
# Host: pokemon-tcg-api.p.rapidapi.com
RAPIDAPI_KEY=your_rapidapi_key_here
```

> **Without `RAPIDAPI_KEY`:** The app works normally but the Price Sync feature
> won't be available. Card prices fall back to deterministic mock values based on rarity.
>
> **First sync tip:** On the first price sync for any set, the route logs all observed
> TCGPlayer price keys to the server console. Check those logs to confirm which keys
> the API uses for graded variants (e.g. `gradedPsa10`, `PSA 10`, etc.) before
> relying on the graded price columns in `card_prices`.

### 5. Set up authentication providers

In your Supabase dashboard:
1. Go to Authentication > Providers
2. Configure Google OAuth (recommended):
   - Enable Google provider
   - Add your site URL to authorized domains
   - Set up OAuth app in Google Cloud Console

### 6. Run the development server

\`\`\`bash
npm run dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000) to see your app!

## 📚 Usage

### For Users

1. **Sign up/Login**: Use Google OAuth or email/password
2. **Add Sets**: Browse and add Pokémon card sets to your collection
3. **Track Cards**: 
   - Click a card to add it to your collection
   - Right-click for detailed quantity/variant options
4. **View Progress**: See completion percentages and owned vs. total cards
5. **Earn Achievements**: Unlock achievements for collection milestones
6. **Share Progress**: Visit your profile to see your collection stats

### For Developers

#### Key Component Structure

\`\`\`
/app
  /dashboard        - Main collection overview
  /set/[id]        - Individual set with card grid
  /profile/[id]    - User profiles and achievements
  /login           - Authentication pages
  /api
    /sets          - Pokemon set data endpoint
    /cards         - Pokemon card data endpoint

/components
  /Navbar.tsx      - Navigation component
  /SetCard.tsx     - Set display component
  /CardGrid.tsx    - Interactive card grid
  /AchievementBadge.tsx - Achievement display

/lib
  /supabase.ts     - Database client
  /auth.ts         - Authentication helpers
  /store.ts        - Zustand state management
  /achievements.ts - Achievement system
\`\`\`

#### Database Schema

- **users**: User profiles and metadata
- **user_sets**: Sets added to user collections
- **user_cards**: Card quantities and variants (KEY TABLE)
- **achievements**: Available achievements
- **user_achievements**: Unlocked user achievements

## 🔧 Configuration

### Custom Achievements

Edit \`/lib/achievements.ts\` to add new achievements:

\`\`\`typescript
{
  id: 'custom-achievement',
  name: 'Custom Achievement',
  description: 'Your custom description',
  icon: '🎯',
  condition: (stats) => stats.totalCards >= 50
}
\`\`\`

### API Rate Limits

For higher rate limits, get a free API key from [Pokémon TCG Developer Portal](https://dev.pokemontcg.io/) and add to your environment variables.

## 🚀 Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy!

### Deploy to Other Platforms

The app is compatible with any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- Self-hosted with Docker

## 🔒 Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own data
- Public profile viewing is controlled via RLS policies
- All API endpoints are properly secured

## 📈 Performance

- Pokemon API responses are cached in memory
- Optimized image loading with Next.js Image component
- Efficient state management with Zustand
- Responsive design with mobile-first approach

## 🛠️ Development

### Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run start\` - Start production server
- \`npm run lint\` - Run ESLint

### Adding New Features

1. **New Achievement**: Add to \`/lib/achievements.ts\`
2. **New API Endpoint**: Create in \`/app/api/\`
3. **New Page**: Add to \`/app/\` directory
4. **New Component**: Add to \`/components/\`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [Pokémon TCG API](https://pokemontcg.io/) for providing card data
- [Supabase](https://supabase.com/) for backend infrastructure
- [Next.js](https://nextjs.org/) team for the incredible framework
- [Tailwind CSS](https://tailwindcss.com/) for styling utilities

## 🚨 Troubleshooting

### Common Issues

1. **Cards not loading**: Check your internet connection and API endpoints
2. **Authentication errors**: Verify Supabase environment variables
3. **Database errors**: Ensure schema is properly set up in Supabase
4. **Images not displaying**: Check Next.js image domains in \`next.config.js\`

### Support

- Check the GitHub issues page
- Review Supabase documentation
- Consult Next.js documentation

---

Built with ❤️ for Pokémon card collectors worldwide.