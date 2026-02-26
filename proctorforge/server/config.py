"""
ProctorForge AI - Configuration
Loads settings from environment variables.
"""
from pydantic_settings import BaseSettings
from typing import List
import os
from dotenv import load_dotenv

# Load from parent .env
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://localhost/proctorforge"
    DATABASE_URL_SYNC: str = "postgresql://localhost/proctorforge"

    # JWT
    JWT_SECRET_KEY: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 120

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # HMAC
    HMAC_SECRET_KEY: str = "change-me"

    # Anthropic
    ANTHROPIC_API_KEY: str = ""

    # Server
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8001
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001"

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Docker Sandbox
    SANDBOX_IMAGE: str = "proctorforge-sandbox"
    SANDBOX_TIMEOUT: int = 30
    SANDBOX_MEMORY_LIMIT: str = "256m"
    SANDBOX_CPU_LIMIT: float = 0.5

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = "../.env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
