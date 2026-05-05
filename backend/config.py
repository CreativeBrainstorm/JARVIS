from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    openai_api_key: str

    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    neurons_path: str = "backend/neurons"
    log_level: str = "INFO"


settings = Settings()
