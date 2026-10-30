"""Sample data: off by default, only into an empty database, and never with done times in the future."""

import pytest

from backend.app.routers.sample import FLAG
from backend.app.schemas import utc_now
from backend.app.services import SAMPLE_RECALLS


@pytest.fixture
def flag_on(monkeypatch):
    monkeypatch.setenv(FLAG, "1")


def test_off_by_default(client, monkeypatch):
    monkeypatch.delenv(FLAG, raising=False)
    assert client.get("/api/sample-data").json() == {"enabled": False, "available": False}
    res = client.post("/api/sample-data")
    assert res.status_code == 404
    assert res.json()["code"] == "not_found"
    assert client.get("/api/recalls").json()["total"] == 0


def test_flag_must_be_exactly_one(client, monkeypatch):
    monkeypatch.setenv(FLAG, "true")
    assert client.post("/api/sample-data").status_code == 404


def test_loads_into_an_empty_database(client, flag_on, caplog):
    assert client.get("/api/sample-data").json() == {"enabled": True, "available": True}
    with caplog.at_level("INFO", logger="recall_system"):
        res = client.post("/api/sample-data")
    assert res.status_code == 201
    assert res.json() == {"created": len(SAMPLE_RECALLS)}
    assert "sample recalls" in caplog.text

    page = client.get("/api/recalls", params={"page_size": 100}).json()
    assert page["total"] == len(SAMPLE_RECALLS)
    assert all(r["batch_id"].startswith("SAMPLE-") for r in page["items"])
    assert all(r["timeline"] for r in page["items"])
    assert {r["recall_class"] for r in page["items"]} == {"Class I", "Class II", "Class III"}
    # A mix of statuses, so the dashboard and History have something to show.
    statuses = {m["status"] for r in page["items"] for m in r["timeline"]}
    assert {"overdue", "done"} <= statuses
    # No milestone is done in the future.
    now = utc_now().isoformat()
    assert all(m["done_at"] is None or m["done_at"] <= now for r in page["items"] for m in r["timeline"])

    assert client.get("/api/sample-data").json()["available"] is False


def test_refuses_a_database_with_recalls(client, flag_on, add_recall):
    add_recall("Real", "R-1", "contamination")
    res = client.post("/api/sample-data")
    assert res.status_code == 409
    assert res.json()["code"] == "conflict"
    assert client.get("/api/recalls").json()["total"] == 1
