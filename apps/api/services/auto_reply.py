from sqlalchemy import create_engine
from sqlalchemy.sql import text
import httpx
import re
from datetime import datetime
from core.config import settings

engine = create_engine(settings.database_url, future=True)


class AutoReplyService:
    def _get_config(self) -> dict:
        with engine.connect() as conn:
            rows = conn.execute(text("SELECT key, value FROM app_settings")).fetchall()
        parsed = {}
        for r in rows:
            try:
                import json
                parsed[r.key] = json.loads(r.value)
            except Exception:
                parsed[r.key] = r.value
        return parsed

    def _is_within_business_hours(self, config: dict) -> bool:
        hours_str = config.get("auto_reply_unknown_hours", "08:00-18:00")
        if not hours_str:
            return True

        match = re.match(r"(\d{2}):(\d{2})-(\d{2}):(\d{2})", hours_str)
        if not match:
            return True

        start_hour, start_min, end_hour, end_min = map(int, match.groups())
        now = datetime.now()
        current_minutes = now.hour * 60 + now.minute
        start_minutes = start_hour * 60 + start_min
        end_minutes = end_hour * 60 + end_min

        if not (start_minutes <= current_minutes < end_minutes):
            return False

        allow_weekends = config.get("auto_reply_unknown_weekends", False)
        is_weekend = now.weekday() >= 5

        if is_weekend and not allow_weekends:
            return False

        return True

    def should_auto_reply(self, phone: str, classification: str) -> bool:
        if classification != "unknown":
            return False

        config = self._get_config()

        enabled = config.get("auto_reply_unknown_enabled", False)
        if not enabled:
            return False

        if not self._is_within_business_hours(config):
            return False

        return True

    def send_auto_reply(self, phone: str) -> dict:
        config = self._get_config()
        template_name = config.get("auto_reply_unknown_template", "auto_reply_unknown")

        with engine.connect() as conn:
            template_row = conn.execute(
                text("SELECT body, variables FROM whatsapp_templates WHERE name = :name"),
                {"name": template_name}
            ).fetchone()

            if not template_row:
                return {"success": False, "error": "Template not found"}

            template_body = template_row[0]
            template_variables = template_row[1]

        variables = {}
        try:
            import json
            if template_variables:
                variables = json.loads(template_variables)
        except Exception:
            variables = {}

        message = template_body
        for var_name in variables:
            placeholder = f"{{{var_name}}}"
            if placeholder in message:
                message = message.replace(placeholder, "")

        timestamp = int(datetime.now().timestamp())
        idempotency_key = f"auto_reply_{phone}_{timestamp}"

        try:
            with httpx.Client(timeout=30.0) as client:
                response = client.post(
                    "http://baileys:8080/outbound/send",
                    json={
                        "phone": phone,
                        "message": message,
                        "idempotency_key": idempotency_key,
                    },
                    headers={
                        "Authorization": f"Bearer {settings.baileys_internal_token}",
                        "Content-Type": "application/json",
                    },
                )
                response.raise_for_status()
                return {"success": True, "idempotency_key": idempotency_key}
        except Exception as e:
            return {"success": False, "error": str(e)}


auto_reply_service = AutoReplyService()
