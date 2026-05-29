import secrets

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Application
    app_name: str = "Taiwan Stock Analysis API"
    environment: str = "development"
    debug: bool = False

    # Security
    secret_key: str = secrets.token_urlsafe(32)
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # Database
    database_url: str = "postgresql://authservice:authservice_password@localhost:5432/auth_db"

    # Stock data sync
    stock_history_start_date: str = "2010-01-01"
    stock_sync_rate_limit_seconds: float = 0.3
    stock_sync_max_concurrent: int = 8
    stock_daily_sync_enabled: bool = True
    stock_daily_sync_hour: int = 16
    stock_daily_sync_minute: int = 30
    stock_daily_sync_lookback_days: int = 10

    # CORS
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    DEEPSEEK_API_KEY: str | None = None
    ai_analysis_cache_ttl_seconds: int = 300
    ai_analysis_provider_timeout_seconds: float = 20.0
    ai_analysis_max_concurrent_jobs: int = 2
    ai_analysis_max_queued_jobs: int = 20
    ai_analysis_circuit_failure_threshold: int = 3
    ai_analysis_circuit_cooldown_seconds: int = 60
    ai_analysis_job_stale_seconds: int = 300


settings = Settings()
