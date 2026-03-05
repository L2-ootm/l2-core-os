from pydantic import BaseModel
from dotenv import load_dotenv
from pathlib import Path
import os

# Em container, variáveis vêm de env_file. Em local, tenta achar infra/.env.
load_dotenv()

try:
    file_path = Path(__file__).resolve()
    for p in [file_path.parent, *file_path.parents]:
        candidate = p / "infra" / ".env"
        if candidate.exists():
            load_dotenv(candidate, override=False)
            break
except Exception:
    pass


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

    redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379/0")
    baileys_internal_token: str = os.getenv("BAILEYS_INTERNAL_TOKEN", "change_internal_token")


settings = Settings()
