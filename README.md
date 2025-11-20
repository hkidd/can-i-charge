# Can I Charge? 🔋

**An intelligent EV infrastructure analysis platform that provides instant EV readiness scores for any US address.**

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)](https://supabase.com/)
[![Mapbox](https://img.shields.io/badge/Mapbox-Maps-blue?logo=mapbox)](https://www.mapbox.com/)

## ✨ Features

### 🎯 **Smart EV Scoring Algorithm**
- **Multi-factor Analysis**: Combines population density, station/port counts, vehicle miles traveled, and connector compatibility
- **Dynamic Scoring**: Calculates EV infrastructure readiness on a 0-100 scale
- **Real-time Updates**: Daily refreshes from NREL charging station database

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
- **Service Level Assessment**: Excellent/Good/Fair/Poor/Rural classifications
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
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** with custom design system
- **Mapbox GL JS** for interactive maps
- **Custom UI Components** with glass-morphism design

### **Backend & Database**
- **Supabase** (PostgreSQL) with PostGIS for spatial data
- **NREL API** integration for charging station data
- **US Census API** for population and traffic data
- **Mapbox Geocoding** for address resolution

### **Data Pipeline**
- **Automated Data Ingestion**: Daily NREL API updates
- **Spatial Aggregation**: PostGIS-powered ZIP code boundary analysis
- **Smart Updates**: Only process regions with new/changed data
- **Multi-level Caching**: Optimized queries for different zoom levels

### **Infrastructure**
- **Vercel** deployment with edge functions
- **Sentry** error monitoring and performance tracking
- **Environment Configuration** for development/staging/production

## 🚀 **Getting Started**

### Prerequisites
- Node.js 18+
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
DATABASE_URL=your_supabase_database_url
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# APIs
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
NREL_API_KEY=your_nrel_api_key

# Monitoring (optional)
SENTRY_DSN=your_sentry_dsn
SENTRY_AUTH_TOKEN=your_sentry_auth_token
```

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
npm run type-check   # Run TypeScript checks
```

### **Project Structure**
```
├── app/                 # Next.js app router pages
│   ├── api/            # API routes
│   ├── admin/          # Admin dashboard
│   └── globals.css     # Global styles
├── components/         # React components
│   ├── Map.tsx        # Main map component
│   ├── MapFilters.tsx # Filter controls
│   ├── ScoreCard.tsx  # Score display modal
│   └── ...            # Other UI components
├── lib/               # Utility libraries
│   ├── map-*.ts      # Map-related utilities
│   ├── aggregation.ts # Data aggregation logic
│   ├── scoring.ts    # EV scoring algorithm
│   └── supabase.ts   # Database client
├── docs/             # Documentation
└── scripts/          # Data processing scripts
```

## 📊 **Data Sources**

- **[NREL Alternative Fuels Data Center](https://afdc.energy.gov/)**: Charging station locations and specifications
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