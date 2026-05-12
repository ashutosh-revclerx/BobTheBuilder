from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    port: int = 8000
    log_level: str = "INFO"
    llm_service_url: str = "http://localhost:8001"
    llm_timeout_ms: int = 180_000
    llm_chat_timeout_ms: int = 60_000


settings = Settings()
