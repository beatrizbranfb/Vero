from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    APP_NAME: str = "Vero"

    # Autenticação e Banco
    DATABASE_URL: str
    SECRET_KEY: str
    JWT_ALGORITMO: str = "HS256"

    # WhatsApp / Evolution API
    EVOLUTION_URL: str
    AUTHENTICATION_API_KEY: str
    INSTANCE_NAME: str

    model_config = SettingsConfigDict(
        env_file=[
            BASE_DIR.parent.parent.parent / ".env",
            BASE_DIR.parent.parent / ".env",
            ".env",
        ],
        env_file_encoding="utf-8",
        extra="ignore",
    )

settings = Settings()
