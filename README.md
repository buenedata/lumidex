# Lumidex - European Pokemon Card Tracker

![Lumidex Logo](public/images/logo.png)

Lumidex is a comprehensive Pokemon card collection tracking application designed specifically for European collectors. Track your collection, monitor prices, trade with friends, and achieve collection goals.

## 🌟 Features

### Core Features
- **Collection Management**: Track owned cards with variants and conditions
- **Wishlist System**: Manage wanted cards with priority levels
- **Price Tracking**: Real-time pricing from European markets
- **Trading Platform**: Connect and trade with other collectors
- **Achievement System**: Unlock achievements and track progress
- **Social Features**: Friends, profiles, and collection sharing

### Technical Features
- **Real-time Updates**: Live price feeds and collection syncing
- **Multi-language Support**: Available in multiple European languages
- **Mobile Responsive**: Optimized for all devices
- **PWA Ready**: Progressive Web App capabilities
- **Performance Optimized**: Fast loading with image optimization

## 🚀 Live Application

**Production:** [https://lumidex.app](https://lumidex.app)

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Headless UI
- **State Management**: Zustand
- **Data Fetching**: TanStack Query
- **Forms**: React Hook Form with Zod validation

### Backend & Database
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth with Google OAuth
- **Real-time**: Supabase Realtime
- **Storage**: Supabase Storage for images

### External APIs
- **Pokemon Data**: Pokemon TCG API
- **Price Data**: CardMarket API integration
- **Images**: Pokemon TCG IO image CDN

### Deployment & Infrastructure
- **Hosting**: Vercel
- **Domain**: lumidex.app
- **CDN**: Vercel Edge Network
- **SSL**: Automatic HTTPS with Vercel

## 📋 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account and project
- Pokemon TCG API key
- Google OAuth client (for social login)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/lumidex.git
   cd lumidex
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Configure environment variables**
   See `.env.example` for required variables:
   - Supabase URL and keys
   - Pokemon TCG API key
   - Google OAuth client ID
   - Application URLs

5. **Run development server**
   ```bash
   npm run dev
   ```

6. **Open application**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🚀 Deployment

For complete deployment instructions to production, see [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md).

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/lumidex)

## 📁 Project Structure

```
lumidex/
├── public/                     # Static assets
│   ├── images/                # Application images
│   │   ├── rarities/         # Card rarity symbols
│   │   └── sets/             # Pokemon set assets
├── src/
│   ├── app/                   # Next.js 14 App Router
│   │   ├── api/              # API routes
│   │   ├── auth/             # Authentication pages
│   │   ├── cards/            # Card-related pages
│   │   ├── collection/       # Collection management
│   │   └── ...               # Other app pages
│   ├── components/           # React components
│   │   ├── auth/            # Authentication components
│   │   ├── dashboard/       # Dashboard widgets
│   │   ├── navigation/      # Navigation components
│   │   ├── pokemon/         # Pokemon card components
│   │   ├── profile/         # User profile components
│   │   ├── setup/           # Setup wizard components
│   │   ├── trading/         # Trading system components
│   │   └── ui/              # Reusable UI components
│   ├── contexts/            # React contexts
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility libraries
│   ├── locales/            # Internationalization
│   └── types/              # TypeScript type definitions
├── scripts/                 # Database and utility scripts
├── sql/                    # SQL migration files
└── supabase/               # Supabase configuration
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run perf` - Performance analysis
- `npm run build:analyze` - Bundle analysis

### Environment Configuration

#### Development (`.env.local`)
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

#### Production (Vercel Environment Variables)
```env
NEXT_PUBLIC_APP_URL=https://lumidex.app
NODE_ENV=production
```

### Database Management

#### Supabase Migrations
Database schema changes are managed through Supabase migrations in the `sql/` directory.

#### Local Development
```bash
# Initialize Supabase locally (optional)
npx supabase init
npx supabase start
```

## 🎯 Key Features Deep Dive

### Collection Management
- Track owned cards with conditions and variants
- Bulk import from CSV or collection management tools
- Advanced filtering and search capabilities
- Collection statistics and insights

### Price Tracking
- Real-time pricing from European markets
- Historical price charts and trends
- Price alerts for wishlist items
- Market analysis and recommendations

### Trading System
- Find trading partners with matching cards
- Secure trade proposals and negotiations
- Trade history and feedback system
- Integration with collection data

### Achievement System
- Collection milestones and goals
- Social achievements for community engagement
- Streak tracking for daily activities
- Leaderboards and competitions

## 🌍 Internationalization

Lumidex supports multiple European languages:
- English (Default)
- German
- French
- Spanish
- Italian
- Dutch

Language files are located in `src/locales/`.

## 🔒 Security & Privacy

- **Authentication**: Secure authentication with Supabase Auth
- **Data Protection**: GDPR compliant data handling
- **API Security**: Rate limiting and validation
- **Content Security**: CSP headers and XSS protection

## 📈 Performance

### Optimization Features
- **Image Optimization**: Next.js Image component with WebP/AVIF
- **Code Splitting**: Automatic code splitting with Next.js
- **Caching**: Strategic caching of static and dynamic content
- **Compression**: Gzip compression enabled
- **CDN**: Global CDN with Vercel Edge Network

### Performance Metrics
- **Lighthouse Score**: 90+ across all metrics
- **Core Web Vitals**: Optimized for excellent user experience
- **Bundle Size**: Optimized with tree-shaking and dynamic imports

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Guidelines
- Follow TypeScript best practices
- Use ESLint configuration
- Write meaningful commit messages
- Update documentation for new features

## 📊 Monitoring & Analytics

### Application Monitoring
- **Vercel Analytics**: Built-in performance monitoring
- **Error Tracking**: Sentry integration (optional)
- **User Analytics**: Google Analytics (optional)

### Database Monitoring
- **Supabase Dashboard**: Real-time database metrics
- **Query Performance**: Optimized queries and indexes
- **Storage Usage**: Image storage monitoring

## 🆘 Support & Troubleshooting

### Common Issues
- **Authentication Problems**: Check Supabase and Google OAuth configuration
- **Image Loading**: Verify CDN and Next.js image configuration
- **API Errors**: Check environment variables and API keys
- **Performance**: Use `npm run perf` for analysis

### Getting Help
- **Documentation**: Check the deployment guide and this README
- **Issues**: Create a GitHub issue for bugs or feature requests
- **Community**: Join our Discord server (link coming soon)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Pokemon Company**: For the amazing Pokemon TCG
- **Pokemon TCG API**: For providing comprehensive card data
- **Supabase**: For the excellent backend infrastructure
- **Vercel**: For seamless deployment and hosting
- **Community**: All the collectors who make this project possible

## 📞 Contact

- **Website**: [https://lumidex.app](https://lumidex.app)
- **GitHub**: [https://github.com/YOUR_USERNAME/lumidex](https://github.com/YOUR_USERNAME/lumidex)
- **Email**: support@lumidex.app

---

**Made with ❤️ for the European Pokemon collecting community**