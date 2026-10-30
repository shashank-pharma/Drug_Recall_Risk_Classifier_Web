"""CDSCO timeline through the API: create, milestones, decision, overdue, migration."""

import logging
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

from backend.app.db import add_missing_columns


def ago(**delta) -> str:
    return (datetime.now(timezone.utc) - timedelta(**delta)).isoformat()


def milestones(body) -> dict:
    return {m["key"]: m for m in body["timeline"]}


@pytest.fixture
def class_i_overdue(client, recall_payload):
    """Class I recall whose information arrived 50 h ago: stop sale (24 h) is overdue."""
    res = client.post("/api/recalls", json={**recall_payload, "information_received_at": ago(hours=50)})
    assert res.status_code == 201
    return res.json()


# --- create -----------------------------------------------------------------

def test_create_returns_levels_and_timeline(class_i_overdue):
    body = class_i_overdue
    assert body["recall_levels"] == ["wholesale", "retail", "consumer"]
    assert body["public_announcement"] is True
    m = milestones(body)
    assert list(m) == ["decision", "communication", "stop_sale", "completion"]
    assert m["stop_sale"]["status"] == "overdue"
    assert m["completion"]["status"] == "due_soon"  # 72 h - 50 h = 22 h left
    assert m["decision"]["status"] == "due_soon"
    assert m["communication"]["status"] == "waiting"
    assert m["stop_sale"]["source"] == "CDSCO/RRAS Ver. 00 (2024) §8.0"


def test_class_ii_has_no_stop_sale_deadline(client, recall_payload):
    body = client.post("/api/recalls", json={**recall_payload, "defect_type": "mislabeling"}).json()
    m = milestones(body)
    assert "decision" not in m
    assert m["stop_sale"]["status"] == "not_specified"
    assert body["recall_levels"] == ["wholesale", "retail"]


def test_preview_includes_timeline_without_saving(client, recall_payload):
    body = client.post("/api/recalls/preview", json=recall_payload).json()
    assert milestones(body)["stop_sale"]["status"] == "due_soon"
    assert client.get("/api/recalls").json()["total"] == 0


def test_received_time_with_offset_is_stored_as_utc(client, recall_payload):
    received = (datetime.now(timezone.utc) - timedelta(hours=3)).replace(microsecond=0)
    local = received.astimezone(timezone(timedelta(hours=5, minutes=30)))
    body = client.post("/api/recalls", json={**recall_payload, "information_received_at": local.isoformat()}).json()
    assert body["information_received_at"] == received.replace(tzinfo=None).isoformat()


@pytest.mark.parametrize(
    ("changes", "field", "message"),
    [
        ({"information_received_at": None}, "information_received_at", None),
        ({"information_received_at": "__drop__"}, "information_received_at", "Field required"),
        ({"information_received_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()},
         "information_received_at", "Must not be in the future."),
        ({"decision_at": ago(hours=2)}, "decision_at", "Must not be before the information was received."),
    ],
)
def test_bad_timeline_input(client, recall_payload, changes, field, message):
    payload = {**recall_payload, **changes}
    if changes.get("information_received_at") == "__drop__":
        del payload["information_received_at"]
    res = client.post("/api/recalls", json=payload)
    assert res.status_code == 422
    errors = res.json()["errors"]
    assert [e["field"] for e in errors] == [field]
    if message:
        assert errors[0]["message"] == message


def test_legacy_recall_has_no_timeline(client, add_recall):
    row = add_recall("Old drug", "OLD-1", "contamination")
    body = client.get(f"/api/recalls/{row.id}").json()
    assert body["timeline"] is None
    assert body["information_received_at"] is None
    assert body["recall_levels"] == ["wholesale", "retail", "consumer"]


# --- milestones -------------------------------------------------------------

def test_mark_done_and_undo(client, class_i_overdue, caplog):
    rid = class_i_overdue["id"]
    with caplog.at_level(logging.INFO, logger="recall_system"):
        done = client.patch(f"/api/recalls/{rid}/milestones/stop_sale", json={"done": True})
    assert done.status_code == 200
    assert milestones(done.json())["stop_sale"]["status"] == "done_late"  # 50 h > 24 h
    assert "BT-001 | stop_sale done at" in caplog.text

    undone = client.patch(f"/api/recalls/{rid}/milestones/stop_sale", json={"done": False})
    assert milestones(undone.json())["stop_sale"]["status"] == "overdue"
    assert milestones(undone.json())["stop_sale"]["done_at"] is None


def test_mark_done_with_an_earlier_time(client, class_i_overdue):
    rid = class_i_overdue["id"]
    res = client.patch(f"/api/recalls/{rid}/milestones/stop_sale", json={"done": True, "done_at": ago(hours=40)})
    assert milestones(res.json())["stop_sale"]["status"] == "done"  # 10 h after receipt


def test_decision_then_communication(client, class_i_overdue):
    rid = class_i_overdue["id"]
    blocked = client.patch(f"/api/recalls/{rid}/milestones/communication", json={"done": True})
    assert blocked.status_code == 422
    assert blocked.json()["code"] == "timeline_error"

    decided = client.patch(f"/api/recalls/{rid}", json={"decision_at": ago(hours=45)}).json()
    m = milestones(decided)
    assert m["decision"]["status"] == "done"
    assert m["communication"]["status"] == "overdue"  # due 21 h ago

    told = client.patch(f"/api/recalls/{rid}/milestones/communication", json={"done": True, "done_at": ago(hours=30)})
    assert milestones(told.json())["communication"]["status"] == "done"

    # Clearing the decision also clears the communication it started.
    cleared = client.patch(f"/api/recalls/{rid}", json={"decision_at": None}).json()
    assert cleared["decision_at"] is None
    assert milestones(cleared)["communication"]["status"] == "waiting"


@pytest.mark.parametrize(
    ("path", "payload", "status", "code"),
    [
        ("milestones/stop_sale", {"done": True, "done_at": ago(hours=60)}, 422, "timeline_error"),  # before receipt
        ("milestones/stop_sale", {"done": True, "done_at": ago(hours=-30)}, 422, "validation_error"),  # future
        ("milestones/decision", {"done": True}, 422, "validation_error"),  # not a markable milestone
        ("", {"decision_at": ago(hours=60)}, 422, "timeline_error"),  # decision before receipt
    ],
)
def test_bad_milestone_updates(client, class_i_overdue, path, payload, status, code):
    url = f"/api/recalls/{class_i_overdue['id']}" + (f"/{path}" if path else "")
    res = client.patch(url, json=payload)
    assert res.status_code == status
    assert res.json()["code"] == code


def test_class_ii_stop_sale_cannot_be_marked(client, recall_payload):
    rid = client.post("/api/recalls", json={**recall_payload, "defect_type": "subpotent"}).json()["id"]
    res = client.patch(f"/api/recalls/{rid}/milestones/stop_sale", json={"done": True})
    assert res.status_code == 422
    assert "§8.0" in res.json()["message"]


def test_legacy_and_missing_recalls(client, add_recall):
    legacy = add_recall("Old drug", "OLD-1", "contamination")
    res = client.patch(f"/api/recalls/{legacy.id}/milestones/completion", json={"done": True})
    assert res.json()["code"] == "timeline_error"
    missing = client.patch("/api/recalls/999/milestones/completion", json={"done": True})
    assert missing.status_code == 404
    assert missing.json()["code"] == "not_found"


# --- overdue in history and stats --------------------------------------------

def test_overdue_filter_and_count(client, recall_payload, class_i_overdue, add_recall):
    client.post("/api/recalls", json=recall_payload | {"batch_id": "FRESH"})  # nothing overdue yet
    add_recall("Old drug", "OLD-1", "contamination")  # no timeline

    overdue = client.get("/api/recalls", params={"status": "overdue"}).json()
    assert [r["batch_id"] for r in overdue["items"]] == ["BT-001"]
    assert overdue["total"] == 1
    assert client.get("/api/recalls").json()["total"] == 3
    assert client.get("/api/stats/summary").json()["overdue"] == 1

    rid = class_i_overdue["id"]
    client.patch(f"/api/recalls/{rid}/milestones/stop_sale", json={"done": True})
    assert client.get("/api/stats/summary").json()["overdue"] == 0


def test_recall_rules_endpoint(client):
    rules = {r["recall_class"]: r for r in client.get("/api/recall-rules").json()}
    assert rules["Class I"]["stop_sale_hours"] == 24
    assert rules["Class I"]["completion_hours"] == 72
    assert rules["Class II"]["stop_sale_hours"] is None
    assert rules["Class II"]["completion_hours"] == 240
    assert rules["Class III"]["completion_hours"] == 720
    assert rules["Class III"]["recall_levels"] == ["wholesale"]
    assert rules["Class I"]["source_levels"].endswith("§7.0")


# --- migration ----------------------------------------------------------------

def test_old_database_gets_new_columns_and_keeps_data(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'old.db'}")
    with engine.begin() as conn:  # the Phase 8 schema
        conn.execute(text(
            "CREATE TABLE recalls (id INTEGER PRIMARY KEY, drug_name VARCHAR NOT NULL, batch_id VARCHAR NOT NULL,"
            " reason VARCHAR NOT NULL, defect_type VARCHAR NOT NULL, recall_class VARCHAR NOT NULL,"
            " action VARCHAR NOT NULL, meaning VARCHAR NOT NULL, units_affected INTEGER NOT NULL,"
            " created_at DATETIME NOT NULL)"
        ))
        conn.execute(text(
            "INSERT INTO recalls VALUES (1, 'Metformin 500mg', 'BT-001', 'r', 'contamination', 'Class I',"
            " 'Immediate withdrawal', 'm', 50000, '2026-06-08 00:00:00')"
        ))

    added = add_missing_columns(engine)
    assert sorted(added) == sorted(f"recalls.{c}" for c in (
        "information_received_at", "decision_at", "communication_done_at", "stop_sale_done_at", "completion_done_at"
    ))
    assert add_missing_columns(engine) == []  # running again changes nothing

    with engine.connect() as conn:
        row = conn.execute(text("SELECT drug_name, units_affected, information_received_at FROM recalls")).one()
    assert tuple(row) == ("Metformin 500mg", 50000, None)
    assert "completion_done_at" in {c["name"] for c in inspect(engine).get_columns("recalls")}


def test_migration_works_in_a_fresh_process(tmp_path):
    """Regression: called on its own (models not yet imported) it used to add nothing."""
    db_file = tmp_path / "old.db"
    with create_engine(f"sqlite:///{db_file}").begin() as conn:
        conn.execute(text(
            "CREATE TABLE recalls (id INTEGER PRIMARY KEY, drug_name VARCHAR NOT NULL, batch_id VARCHAR NOT NULL,"
            " reason VARCHAR NOT NULL, defect_type VARCHAR NOT NULL, recall_class VARCHAR NOT NULL,"
            " action VARCHAR NOT NULL, meaning VARCHAR NOT NULL, units_affected INTEGER NOT NULL,"
            " created_at DATETIME NOT NULL)"
        ))
    result = subprocess.run(
        [sys.executable, "-c", "from backend.app import db; print(len(db.add_missing_columns()))"],
        cwd=Path(__file__).resolve().parents[2],
        env={**os.environ, "RECALL_DB_URL": f"sqlite:///{db_file}"},
        capture_output=True, text=True, check=True,
    )
    assert result.stdout.strip() == "5"
