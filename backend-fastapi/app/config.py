from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    database_url: str
    database_migration_url: str | None = None
    cors_origins: str = "http://localhost:3001"
    firebase_project_id: str
    firebase_client_email: str
    firebase_private_key: str
    cloudinary_url: str
    bootstrap_secret: str

    @field_validator("database_url")
    @classmethod
    def async_driver(cls, value: str) -> str:
        if value.startswith("postgres://"):
            value = "postgresql://" + value.removeprefix("postgres://")
        if value.startswith("postgresql://"):
            value = "postgresql+psycopg://" + value.removeprefix("postgresql://")
        return value

    @field_validator("database_migration_url")
    @classmethod
    def async_migration_driver(cls, value: str | None) -> str | None:
        return cls.async_driver(value) if value else None

    @field_validator("firebase_private_key")
    @classmethod
    def decode_private_key(cls, value: str) -> str:
        return value.replace("\\n", "\n")

    @field_validator("bootstrap_secret")
    @classmethod
    def strong_bootstrap_secret(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("BOOTSTRAP_SECRET must be at least 32 characters")
        return value

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
