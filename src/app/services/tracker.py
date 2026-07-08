"""Application tracker with real persistence (SQLite, stdlib only).

Replaces the manual Google Sheet: add applications, list them, update status,
delete. No external dependencies.
"""
import sqlite3
from pathlib import Path

from app.config import settings
from app.models import Application, ApplicationIn

_SCHEMA = """
CREATE TABLE IF NOT EXISTS applications (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    organization TEXT NOT NULL,
    role         TEXT NOT NULL DEFAULT '',
    kind         TEXT NOT NULL DEFAULT 'job',
    status       TEXT NOT NULL DEFAULT 'planned',
    deadline     TEXT NOT NULL DEFAULT '',
    link         TEXT NOT NULL DEFAULT '',
    notes        TEXT NOT NULL DEFAULT '',
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


class TrackerService:
    def __init__(self, db_path: str | None = None) -> None:
        self._db_path = db_path or settings.db_path
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as conn:
            conn.executescript(_SCHEMA)

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def add(self, app_in: ApplicationIn) -> Application:
        with self._conn() as conn:
            cur = conn.execute(
                """INSERT INTO applications
                   (organization, role, kind, status, deadline, link, notes)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    app_in.organization, app_in.role, app_in.kind,
                    app_in.status, app_in.deadline, app_in.link, app_in.notes,
                ),
            )
            row = conn.execute(
                "SELECT * FROM applications WHERE id = ?", (cur.lastrowid,)
            ).fetchone()
        return Application(**dict(row))

    def list(self) -> list[Application]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM applications ORDER BY "
                "CASE WHEN deadline = '' THEN 1 ELSE 0 END, deadline ASC, id DESC"
            ).fetchall()
        return [Application(**dict(r)) for r in rows]

    def update_status(self, app_id: int, status: str) -> Application | None:
        with self._conn() as conn:
            conn.execute(
                "UPDATE applications SET status = ? WHERE id = ?", (status, app_id)
            )
            row = conn.execute(
                "SELECT * FROM applications WHERE id = ?", (app_id,)
            ).fetchone()
        return Application(**dict(row)) if row else None

    def delete(self, app_id: int) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM applications WHERE id = ?", (app_id,)
            )
        return cur.rowcount > 0
