# ProctorForge AI - Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Netlify Deployment (Frontend)](#netlify-deployment-frontend)
4. [Backend Deployment](#backend-deployment)
5. [Environment Configuration](#environment-configuration)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required
- Node.js 18+ (for frontend)
- Python 3.12+ (for backend)
- PostgreSQL/Supabase account (for database)
- Docker (for code sandbox execution)

### Optional
- Netlify account (free tier available)
- Heroku/Railway account (for backend hosting)

---

## Local Development

### 1. Frontend Setup

```bash
cd proctorforge/client

# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local

# Development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint:fix
```

### 2. Backend Setup

```bash
cd proctorforge/server

# Create Python virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp ../.env.example ../.env
# Edit ../.env with your values

# Run development server (http://localhost:8000)
python main.py

# API documentation: http://localhost:8000/docs
```

---

## Netlify Deployment (Frontend)

### 1. Connect Repository

1. Push code to GitHub/GitLab/Bitbucket
2. Visit [Netlify.com](https://netlify.com)
3. Click "New site from Git"
4. Connect your repository
5. Select branch: `main` (or your primary branch)

### 2. Configure Build Settings

**Netlify automatically detects:**
- Build command: `cd proctorforge/client && npm run build`
- Publish directory: `proctorforge/client/.next`

**These settings are in `netlify.toml`**

### 3. Set Environment Variables

In Netlify dashboard → Site settings → Environment:

```env
NEXT_PUBLIC_API_URL=https://your-backend-api.com
NEXT_PUBLIC_WS_URL=wss://your-backend-api.com
NEXT_PUBLIC_ENABLE_AI_TWIN=true
NEXT_PUBLIC_ENABLE_TYPING_ANALYTICS=true
NEXT_PUBLIC_ENABLE_GAZE_TRACKING=true
NODE_VERSION=18
```

### 4. Deploy

```bash
# Deploy from command line (optional)
npm install -g netlify-cli
netlify deploy --prod
```

Netlify will automatically redeploy on push to main branch.

---

## Backend Deployment

### Option 1: Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create new project
railway init

# Set environment variables
railway variables

# Deploy
railway deploy
```

### Option 2: Heroku

```bash
# Install Heroku CLI
brew tap heroku/brew && brew install heroku

# Login
heroku login

# Create app
heroku create proctorforge-api

# Set environment variables
heroku config:set DATABASE_URL=postgresql://...
heroku config:set JWT_SECRET_KEY=your-key

# Deploy
git push heroku main
```

### Option 3: Self-Hosted (Docker)

```bash
# Build Docker image
docker build -t proctorforge-server .

# Run container
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql://... \
  -e JWT_SECRET_KEY=your-key \
  proctorforge-server

# Or use Docker Compose
docker-compose up
```

---

## Environment Configuration

### Frontend (.env.local)

```env
# Local development
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Production (set in Netlify UI)
# NEXT_PUBLIC_API_URL=https://api.proctorforge.ai
# NEXT_PUBLIC_WS_URL=wss://api.proctorforge.ai
```

### Backend (../.env)

**Database:**
```env
# Supabase (recommended)
DATABASE_URL=postgresql+asyncpg://user:pass@db.supabase.co/postgres
DATABASE_URL_SYNC=postgresql://user:pass@db.supabase.co/postgres

# Local PostgreSQL
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/proctorforge
```

**Security Keys (generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"`):**
```env
JWT_SECRET_KEY=your-generated-secret-key
HMAC_SECRET_KEY=your-generated-hmac-key
```

**CORS for production:**
```env
CORS_ORIGINS=https://app.proctorforge.ai,https://proctorforge.ai
```

**AI Features:**
```env
ANTHROPIC_API_KEY=sk-ant-xxx...
```

---

## Production Checklist

- [ ] Frontend built with `npm run build` (no errors)
- [ ] Backend environment variables set correctly
- [ ] Database migrations applied (`alembic upgrade head`)
- [ ] CORS origins configured for production domain
- [ ] JWT_SECRET_KEY and HMAC_SECRET_KEY are strong & unique
- [ ] Environment variables NOT in version control
- [ ] HTTPS enforced on production
- [ ] Database backups configured
- [ ] API rate limiting configured
- [ ] Monitoring/logs enabled

---

## Troubleshooting

### Build Errors

**Frontend:**
```bash
# Clear Next.js cache
rm -rf .next
npm run build

# Check TypeScript
npm run type-check

# Check ESLint
npm run lint
```

**Backend:**
```bash
# Install missing deps
pip install -r requirements.txt

# Test database connection
python test_supabase.py
```

### API Connection Issues

1. **Check environment variables** in `frontend/.env.local`
2. **Verify backend is running** at `http://localhost:8000`
3. **Check CORS origins** in backend config
4. **Inspect browser console** for detailed error messages

### WebSocket Connection Failed

```typescript
// This occurs when NEXT_PUBLIC_WS_URL is not set correctly
// Ensure it matches your backend WebSocket URL
NEXT_PUBLIC_WS_URL=wss://your-domain.com (production)
NEXT_PUBLIC_WS_URL=ws://localhost:8000 (development)
```

### Database Connection Failed

```bash
# Test Supabase connection
python proctorforge/server/test_supabase.py

# Check credentials in .env
# Ensure firewall allows connections
# Verify DATABASE_URL format
```

---

## Monitoring & Logs

### Frontend (Netlify)
- Dashboard → Deploys → Show logs
- Real-time monitoring available

### Backend
- **Railway**: Dashboard → Logs
- **Heroku**: `heroku logs --tail`
- **Self-hosted**: Docker logs or stdout

### Database (Supabase)
- Dashboard → Database → Logs
- Query analytics
- Performance monitoring

---

## Performance Tips

1. **Frontend**: Netlify Edge Cache enabled by default
2. **Backend**: Redis caching for frequently accessed data
3. **Database**: Add indexes on frequently queried columns
4. **Images**: Use WebP format, optimize before upload
5. **Code**: Code splitting and lazy loading enabled in Next.js

---

## Support

For issues:
1. Check logs (Netlify, Railway, or application logs)
2. Review environment variables
3. Test locally first before pushing to production
4. Check database connectivity
5. Review API response in browser DevTools

