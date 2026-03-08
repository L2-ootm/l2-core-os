from sqlalchemy import create_engine
from sqlalchemy.sql import text
from datetime import datetime, timezone
from core.config import settings
from typing import Any


class LeadScorer:
    BASE_SCORE = 50

    def __init__(self, engine):
        self.engine = engine

    def calculate_score(self, entity_id: str) -> int:
        with self.engine.begin() as conn:
            entity = conn.execute(
                text("SELECT id, full_name, contact_phone, lead_score, updated_at FROM entities WHERE id = :id"),
                {"id": entity_id}
            ).fetchone()

            if not entity:
                return 0

            events = conn.execute(
                text("SELECT id, status, updated_at FROM events WHERE entity_id = :entity_id"),
                {"entity_id": entity_id}
            ).fetchall()

            transactions = conn.execute(
                text("SELECT id, amount, status, type FROM transactions WHERE entity_id = :entity_id"),
                {"entity_id": entity_id}
            ).fetchall()

            score = self._calculate(entity, events, transactions)

            conn.execute(
                text("UPDATE entities SET lead_score = :score, updated_at = :updated_at WHERE id = :id"),
                {"score": score, "updated_at": now_iso(), "id": entity_id}
            )

            return score

    def _calculate(self, entity: Any, events: list, transactions: list) -> int:
        score = self.BASE_SCORE
        now = datetime.now(timezone.utc)

        last_contacted = None
        if entity[4]:
            try:
                last_contacted = datetime.fromisoformat(str(entity[4]).replace('Z', '+00:00'))
            except Exception:
                pass

        if last_contacted:
            days_since_contact = (now - last_contacted).days
            if days_since_contact < 7:
                score += 20
            elif days_since_contact < 30:
                score += 10

        completed_events = 0
        confirmed_events = 0
        canceled_count = 0
        no_show_count = 0

        for event in events:
            status = str(event[1]).lower() if event[1] else ""
            if status in ["confirmed", "concluded", "completed"]:
                completed_events += 1
            if status == "confirmed":
                confirmed_events += 1
            if status == "canceled":
                canceled_count += 1
            if status == "no_show":
                no_show_count += 1

        score += min(completed_events * 5, 15)
        score += min(confirmed_events * 5, 10)

        paid_total = 0
        for tx in transactions:
            tx_status = str(tx[2]).lower() if tx[2] else ""
            tx_type = str(tx[3]).lower() if tx[3] else ""
            if tx_status == "paid" and tx_type == "income":
                try:
                    amount = float(str(tx[1]).replace(',', '.'))
                    paid_total += amount
                except Exception:
                    pass

        score += min(int(paid_total / 100), 20)

        if canceled_count >= 3:
            score -= 15

        score -= no_show_count * 5

        return max(0, min(100, score))

    def recalculate_all(self) -> int:
        with self.engine.begin() as conn:
            rows = conn.execute(text("SELECT id FROM entities")).fetchall()

        count = 0
        for row in rows:
            self.calculate_score(row[0])
            count += 1

        return count

    def get_score_label(self, score: int) -> str:
        if score <= 40:
            return "Frio"
        elif score <= 80:
            return "Morno"
        else:
            return "Quente"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
