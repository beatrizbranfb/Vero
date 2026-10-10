from pathlib import Path
from pydantic_settings import BaseSettings

BASE_DIR = Path(__file__).resolve().parent

class Settings(BaseSettings):
    APP_NAME: str = "Vero WhatsApp Service"

    EVOLUTION_URL: str
    AUTHENTICATION_API_KEY: str
    INSTANCE_NAME: str

    class Config:
        env_file = [
            BASE_DIR.parent.parent.parent / ".env",
            BASE_DIR.parent.parent / ".env",
            ".env"
        ]
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()