import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/crypto_kline"
    REDIS_URL: str = "redis://localhost:6379/0"
    BINANCE_API_URL: str = "https://api.binance.com"
    BINANCE_PROXY: Optional[str] = None

    class Config:
        env_file = ".env"
        @classmethod
        def parse_env(cls, env_file: str = ".env") -> None:
            pass


settings = Settings()
