from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://sm:sm@localhost:5432/sladkiy_most"
    admin_token: str = "admin"           # пароль администратора (заголовок X-Admin-Token)
    cors_origins: list[str] = ["http://localhost:3000"]
    serverless: bool = False             # Vercel: NullPool + transaction pooler


settings = Settings()
