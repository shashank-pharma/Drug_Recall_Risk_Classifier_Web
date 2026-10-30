import os
import tempfile
from datetime import datetime, timedelta, timezone

# Must be set before the app is imported so tests never touch backend/recalls.db.
os.environ["RECALL_DB_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test_recalls.db"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.app import main  # noqa: E402
from backend.app.db import Base, SessionLocal, engine  # noqa: E402


@pytest.fixture(autouse=True)
def no_file_logging(monkeypatch):
    """Keep test runs out of the real recall_system_log.txt."""
    monkeypatch.setattr(main, "setup_logging", lambda: None)


@pytest.fixture
def client():
    Base.metadata.drop_all(engine)
    with TestClient(main.app) as c:  # runs lifespan -> init_db creates fresh tables
        yield c


@pytest.fixture
def db():
    with SessionLocal() as session:
        yield session


@pytest.fixture
def add_recall(client, db):
    """Insert a recall directly, so tests can control created_at."""
    from datetime import datetime

    from backend.app.models import Recall
    from drug_recall_risk_classifier import DEFECT_TO_CLASS

    def _add(drug_name, batch_id, defect_type, units=1000, created_at=None):
        cls = DEFECT_TO_CLASS[defect_type]
        row = Recall(
            drug_name=drug_name,
            batch_id=batch_id,
            reason="test",
            defect_type=defect_type,
            recall_class=cls.label,
            action=cls.action,
            meaning=cls.meaning,
            units_affected=units,
            created_at=created_at or datetime(2026, 10, 1, 12, 0),
        )
        db.add(row)
        db.commit()
        return row

    return _add


@pytest.fixture
def recall_payload():
    return {
        "drug_name": "Metformin 500mg",
        "batch_id": "BT-001",
        "reason": "Microbial contamination found",
        "defect_type": "contamination",
        "units_affected": 50000,
        # CDSCO §8.0 clock start; an hour ago keeps every milestone on track.
        "information_received_at": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
    }
