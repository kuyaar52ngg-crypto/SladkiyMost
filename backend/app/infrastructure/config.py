from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://sm:sm@localhost:5432/sladkiy_most"
    cors_origins: list[str] = ["http://localhost:3000"]
    serverless: bool = False             # Vercel: NullPool + transaction pooler

    # аккаунты
    jwt_secret: str = "dev-only-secret-change-me-in-production"
    cookie_secure: bool = True           # cookie сессии только по HTTPS (localhost браузеры разрешают)
    admin_phone: str = ""                # первый администратор создаётся при старте, если админов нет
    admin_password: str = ""

    # фото товаров: Supabase Storage; без него — локальная папка uploads/
    supabase_url: str = ""
    supabase_service_key: str = ""
    storage_bucket: str = "products"

    # уведомления
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""    # по умолчанию выводится из JWT_SECRET

    site_url: str = "http://localhost:3000"
    api_url: str = "http://localhost:8000"


settings = Settings()
