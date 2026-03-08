import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, text

from core.config import settings

logger = logging.getLogger(__name__)

MIGRATIONS_FOLDER = Path(__file__).parent.parent / "migrations"


def get_engine():
    return create_engine(settings.database_url, future=True)


def ensure_schema_migrations_table(engine) -> None:
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            )
        """))


def get_applied_migrations(engine) -> set[str]:
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id FROM schema_migrations")).fetchall()
    return {row[0] for row in rows}


def get_migration_files() -> list[tuple[str, Path]]:
    if not MIGRATIONS_FOLDER.exists():
        logger.warning(f"Migrations folder not found: {MIGRATIONS_FOLDER}")
        return []
    
    files = []
    for f in MIGRATIONS_FOLDER.glob("*.sql"):
        match = re.match(r"^(\d+)_.*\.sql$", f.name)
        if match:
            num = int(match.group(1))
            files.append((f"{num:03d}", f))
    
    files.sort(key=lambda x: x[0])
    return [(num, path) for num, path in files]


def split_sql_statements(sql_content: str) -> list[str]:
    statements = []
    current = []
    in_string = False
    string_char = None
    
    for char in sql_content:
        if char in ("'", '"') and not in_string:
            in_string = True
            string_char = char
        elif char == string_char and in_string:
            in_string = False
            string_char = None
        elif char == ';' and not in_string:
            stmt = "".join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
            continue
        current.append(char)
    
    remaining = "".join(current).strip()
    if remaining:
        statements.append(remaining)
    
    return statements


def run_migrations() -> dict[str, Any]:
    engine = get_engine()
    
    ensure_schema_migrations_table(engine)
    
    applied = get_applied_migrations(engine)
    migration_files = get_migration_files()
    
    run_count = 0
    skipped_count = 0
    error_count = 0
    errors: list[dict[str, str]] = []
    applied_list: list[str] = []
    
    for mig_num, mig_path in migration_files:
        if mig_num in applied:
            skipped_count += 1
            logger.info(f"Skipping migration {mig_num}: already applied")
            continue
        
        logger.info(f"Running migration {mig_num}: {mig_path.name}")
        
        try:
            sql_content = mig_path.read_text(encoding="utf-8")
            statements = split_sql_statements(sql_content)
            
            with engine.begin() as conn:
                for stmt in statements:
                    stmt = stmt.strip()
                    if not stmt:
                        continue
                    conn.execute(text(stmt))
                
                conn.execute(
                    text("INSERT INTO schema_migrations (id, applied_at) VALUES (:id, :applied_at)"),
                    {"id": mig_num, "applied_at": datetime.now(timezone.utc).isoformat()}
                )
            
            run_count += 1
            applied_list.append(mig_num)
            logger.info(f"Successfully applied migration {mig_num}")
            
        except Exception as e:
            error_count += 1
            error_msg = str(e)
            errors.append({"migration": mig_num, "error": error_msg})
            logger.error(f"Error applying migration {mig_num}: {error_msg}")
    
    summary = {
        "total_migrations": len(migration_files),
        "run": run_count,
        "skipped": skipped_count,
        "errors": error_count,
        "applied": applied_list,
        "error_details": errors,
    }
    
    logger.info(f"Migration summary: {summary}")
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    result = run_migrations()
    print(result)
