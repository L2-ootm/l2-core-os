from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
import os

load_dotenv()
infra_env = Path(__file__).resolve().parents[3] / "infra" / ".env"
if infra_env.exists():
    load_dotenv(infra_env, override=False)


class Settings(BaseModel):
    app_name: str = os.getenv("APP_NAME", "L2 Core OS")
    app_env: str = os.getenv("APP_ENV", "development")
    timezone: str = os.getenv("TIMEZONE", "America/Sao_Paulo")
    baileys_session_name: str = os.getenv("BAILEYS_SESSION_NAME", "main")

    database_url: str = os.getenv("DATABASE_URL", "sqlite:///./l2core.db")
    webhook_hmac_secret: str = os.getenv("WEBHOOK_HMAC_SECRET", "change_this_secret")
    webhook_replay_window_seconds: int = int(os.getenv("WEBHOOK_REPLAY_WINDOW_SECONDS", "300"))

    jwt_secret: str = os.getenv("JWT_SECRET", "change_me_please")
    jwt_algo: str = os.getenv("JWT_ALGO", "HS256")

    rate_limit_ip_per_min: int = int(os.getenv("RATE_LIMIT_IP_PER_MIN", "60"))
    rate_limit_token_per_min: int = int(os.getenv("RATE_LIMIT_TOKEN_PER_MIN", "120"))

    baileys_internal_token: str = os.getenv("BAILEYS_INTERNAL_TOKEN", "change_internal_token")


settings = Settings()
