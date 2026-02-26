"""
ProctorForge AI - Backend Server
FastAPI application entry point with CORS, routing, and database initialization.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from routers.auth import router as auth_router
from routers.exams import router as exams_router
from routers.attempts import router as attempts_router
from routers.websocket import router as websocket_router
from routers.code_execution import router as code_router
from routers.monitoring import router as monitoring_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Create tables on startup
    await init_db()
    print("✅ Database tables created")
    yield
    print("🛑 Server shutting down")


app = FastAPI(
    title="ProctorForge AI",
    description="AI-native zero-trust remote assessment platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth_router)
app.include_router(exams_router)
app.include_router(attempts_router)
app.include_router(websocket_router)
app.include_router(code_router)
app.include_router(monitoring_router)


@app.get("/")
async def root():
    return {
        "name": "ProctorForge AI",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": "proctorforge-backend"}


if __name__ == "__main__":
    import uvicorn
    
    # Development mode detection
    is_development = os.getenv("ENVIRONMENT", "development") == "development"
    
    uvicorn.run(
        "main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=is_development,
        workers=1 if is_development else 4,
        log_level="debug" if is_development else "info",
    )
