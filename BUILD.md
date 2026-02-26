# Build Configuration

Build the project with production optimizations:

## Frontend

```bash
cd proctorforge/client
npm run build
```

Output: `.next` directory (optimized Next.js app)

## Backend

```bash
cd proctorforge/server
pip install -r requirements.txt
```

No build step needed - Python files are ready to run.

## Docker

```bash
docker-compose build
```

## Performance

- Frontend: Code splitting, lazy loading, image optimization
- Backend: Uvicorn with multiple workers (production)
- Database: Connection pooling configured
- Caching: Redis integration for session/event caching

