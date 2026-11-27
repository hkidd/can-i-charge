# Can I Charge? 🔋

**An intelligent EV infrastructure analysis platform that provides instant EV readiness scores for any US address.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)](https://supabase.com/)
[![Mapbox](https://img.shields.io/badge/Mapbox-Maps-blue?logo=mapbox)](https://www.mapbox.com/)

## ✨ Features

### 🎯 **Smart EV Scoring Algorithm**
- **Multi-factor Analysis**: Uses one regional calculation based on reported capacity, population, charging speeds, and connector options
- **Dynamic Scoring**: Calculates EV infrastructure readiness on a 0-100 scale
- **Scheduled Updates**: Daily refreshes from NREL charging station database

### 🗺️ **Interactive Map Experience**
- **Multi-scale Analysis**: State (zoom 0-4), county (zoom 5-8), ZIP code (zoom 9-11), individual stations (zoom 13+)
- **Futuristic UI**: Glass-morphism design with neon color coding and smooth transitions
- **Advanced Filters**: Filter by charging speed (DC Fast, Level 2, Level 1) and connector types (Tesla/NACS, CCS/J1772, CHAdeMO)
- **Port Weighting Toggle**: Switch between counting stations vs. total charging capacity (ports)
- **Opportunity Mode**: Highlights high-population areas with limited charging infrastructure

### 🔍 **Detailed Station Information**
- **Hover Tooltips**: Rich station details including connector types, port counts, power ratings, and access restrictions
- **Proximity Analysis**: Shows charging stations within 1, 5, and 10-mile radius
- **Station Composition**: Breakdown by charging speed and type
- **Network Information**: Displays charging network (Tesla, Electrify America, etc.)

### 📊 **Comprehensive Scoring Dashboard**
- **EV Readiness Score**: Visual score display with animated progress ring
- **Proximity Grid**: Station counts at different distances with toggle for DC Fast vs. all stations
- **Service Level Assessment**: Excellent/Good/Fair/Poor, with unrated results when data is incomplete
- **Nearest Charger**: Distance and details for the closest charging station

### 🔧 **Admin & Management Tools**
- **Data Pipeline Control**: Separate controls for fetching stations and aggregating data at state/county/ZIP levels
- **Staging Tables**: Zero-downtime updates using staging tables with atomic swaps
- **Background Processing**: Long-running aggregation tasks run in background
- **Health Monitoring**: API health checks and error tracking

### 🚀 **Performance & Reliability**
- **Rate Limiting**: API protection with configurable limits
- **Error Handling**: Comprehensive error tracking with Sentry integration
- **Caching**: Optimized data loading with intelligent caching strategies
- **Monitoring**: Full observability with analytics and performance tracking

## 🏗️ **Technical Architecture**

### **Frontend Stack**
- **Next.js 16** with App Router and React 19
- **TypeScript** for type safety
- **Tailwind CSS v4** with custom design system
- **Mapbox GL JS** for interactive maps
- **Custom UI Components** with glass-morphism design

### **Backend & Database**
- **Supabase** (PostgreSQL) with PostGIS for spatial data
- **NREL API** integration for charging station data
- **US Census ACS API** for population; **EPA NEI** for historical annual road-traffic estimates
- **Mapbox Geocoding** for address resolution

### **Data Pipeline**
- **Automated Data Ingestion**: Daily NREL API updates
- **Spatial Aggregation**: PostGIS-powered ZIP code boundary analysis
- **Complete Snapshots**: Rebuild every region level and report station changes
- **Multi-level Caching**: Optimized queries for different zoom levels

### **Infrastructure**
- **Vercel** deployment with Node.js functions
- **Sentry** error monitoring and performance tracking
- **Environment Configuration** for development/staging/production

## 🚀 **Getting Started**

### Prerequisites
- Node.js 26 LTS (`nvm use`)
- PostgreSQL with PostGIS extension
- Supabase account
- Mapbox account
- NREL API access

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd can-i-charge
npm install
```

2. **Environment Setup**
```bash
cp .env.example .env.local
```

Configure your `.env.local` with:
```env
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# APIs
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
NLR_API_KEY=your_station_provider_api_key
CENSUS_API_KEY=your_census_api_key
CRON_SECRET=your_long_random_server_secret
NEXT_PUBLIC_URL=http://localhost:3000

# Monitoring (optional)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

The station refresh upgrade and rollout are documented in
[docs/PRODUCTION.md](docs/PRODUCTION.md#station-refresh-rollout). The new migration
requires an existing database schema and must be applied before the new refresh
code can run.

Refresh endpoints require `Authorization: Bearer <CRON_SECRET>` for every request.
They return 503 when the secret is absent and 401 for invalid authorization.
Privileged database access requires `SUPABASE_SERVICE_ROLE_KEY` and is isolated
from client code. Station markers use the public Supabase client, so their table
must have the intended read-only RLS policy.

Billing webhooks require `POLAR_WEBHOOK_SECRET` and verify the original body with
the Polar SDK before processing. Set `POLAR_ACCESS_TOKEN` and `RESEND_API_KEY`
along with `POLAR_PRODUCT_ID` when enabling checkout and subscription emails.
Use `POLAR_ENVIRONMENT=sandbox` in preview and `production` for production.
Apply all nine upgrade migrations using the direct rollout in the production
guide before enabling the new billing handlers.

3. **Database Setup**
```bash
# Run database migrations and setup scripts
# See docs/sql-setup-summary.md for detailed instructions
```

4. **Start Development Server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 🛠️ **Development**

### **Available Scripts**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
npm test             # Run fixtures and PostgreSQL migration tests
```

### **Project Structure**
```
├── app/                 # Next.js app router pages
│   ├── api/            # API routes
│   ├── explore/        # Interactive charging map
│   └── globals.css     # Global styles
├── components/         # React components
│   ├── Map.tsx        # Main map component
│   ├── MapFilters.tsx # Filter controls
│   ├── ScoreCard.tsx  # Score display modal
│   └── ...            # Other UI components
├── lib/               # Utility libraries
│   ├── map-*.ts      # Map-related utilities
│   ├── station-model.ts       # Source validation and port normalization
│   ├── refresh-service.ts     # Complete snapshot workflow
│   ├── region-aggregation.ts  # Shared regional counts
│   ├── region-geography.ts    # Indexed county boundaries
│   └── supabase*.ts           # Public and server database clients
├── supabase/migrations/ # Versioned database upgrades
├── tests/            # Local fixtures and migration checks
├── docs/             # Documentation
└── scripts/          # Data processing scripts
```

## 📊 **Data Sources**

- **[AFDC / NLR station API](https://developer.nlr.gov/docs/transportation/alt-fuel-stations-v1/all/)**: Charging station locations and specifications
- **[US Census Bureau](https://www.census.gov/)**: Population and geographic boundary data
- **[FHWA](https://www.fhwa.dot.gov/)**: Vehicle Miles Traveled statistics
- **[US Census TIGER/Line](https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html)**: ZIP code boundary geometries

## 🎨 **Design System**

### **Color Palette**
- **Neon Green** (`#10b981`): High EV readiness scores
- **Neon Cyan** (`#06b6d4`): Medium scores  
- **Neon Purple** (`#6366f1`): Low scores
- **Neon Gold** (`#facc15`): Opportunity mode highlights
- **Glass UI**: Semi-transparent panels with backdrop blur

### **Typography**
- **Inter**: Primary font for UI elements
- **SF Mono**: Technical data and monospace elements

## 🚀 **Deployment**

### **Production Deployment**
The application is optimized for deployment on Vercel with the included `vercel.json` configuration.

```bash
npm run build
vercel --prod
```

### **Environment Variables**
See `.env.production.example` for production environment configuration.

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 **License**

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 **Acknowledgments**

- **NREL** for providing comprehensive charging station data
- **US Census Bureau** for demographic and geographic data
- **Mapbox** for mapping infrastructure
- **Supabase** for database and backend services

---

**Made with ⚡ by Harrison Kidd** | [Support the Project](https://buymeacoffee.com/harrisonkidd)