"""SQLite engine and session handling."""

import os
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "recalls.db"
DATABASE_URL = os.environ.get("RECALL_DB_URL", f"sqlite:///{DEFAULT_DB_PATH}")

# FastAPI may run sync endpoints on different threads.
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from . import models  # noqa: F401  (registers tables on Base)

    Base.metadata.create_all(engine)
    add_missing_columns()


def add_missing_columns(bind=None) -> list[str]:
    """Bring an existing database up to date by adding new nullable columns.

    create_all() makes missing tables but never changes an existing one, so a
    recalls.db from before Phase 9 needs its new columns added here. Returns the
    names of the columns that were added.
    """
    added = []
    with (bind or engine).begin() as conn:
        for table in Base.metadata.sorted_tables:
            existing = {c["name"] for c in inspect(conn).get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                if not column.nullable:
                    raise RuntimeError(f"Cannot add required column {table.name}.{column.name} automatically")
                col_type = column.type.compile(conn.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'))
                added.append(f"{table.name}.{column.name}")
    return added


def get_session():
    with SessionLocal() as session:
        yield session
