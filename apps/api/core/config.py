from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseModel):
    app_name: str = os.getenv("APP_NAME", "L2 Core OS")
    app_env: str = os.getenv("APP_ENV", "development")
    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./l2core.db")
    webhook_hmac_secret: str = os.getenv("WEBHOOK_HMAC_SECRET", "change_this_secret")
    baileys_internal_token: str = os.getenv("BAILEYS_INTERNAL_TOKEN", "change_internal_token")

settings = Settings()
