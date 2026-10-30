import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from backend.app import main
from backend.app.models import Recall
from drug_recall_risk_classifier import DEFECT_TO_CLASS


def count_recalls(db) -> int:
    return db.scalar(select(func.count()).select_from(Recall))


# --- meta -------------------------------------------------------------------

def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_defect_types_mirror_classifier_rules(client):
    body = client.get("/api/defect-types").json()
    assert [d["defect_type"] for d in body] == sorted(DEFECT_TO_CLASS)
    by_type = {d["defect_type"]: d for d in body}
    assert by_type["contamination"] == {
        "defect_type": "contamination",
        "recall_class": "Class I",
        "action": "Immediate withdrawal",
        "meaning": "May cause serious adverse health consequences or death",
    }


def test_startup_calls_setup_logging(monkeypatch):
    calls = []
    monkeypatch.setattr(main, "setup_logging", lambda: calls.append(True))
    with TestClient(main.app):
        pass
    assert calls == [True]


# --- create / preview -------------------------------------------------------

@pytest.mark.parametrize(
    ("defect_type", "recall_class", "action"),
    [
        ("contamination", "Class I", "Immediate withdrawal"),
        ("wrong_drug", "Class I", "Immediate withdrawal"),
        ("mislabeling", "Class II", "Urgent recall"),
        ("subpotent", "Class II", "Urgent recall"),
        ("packaging_defect", "Class III", "Market withdrawal"),
    ],
)
def test_create_classifies_and_saves(client, db, recall_payload, defect_type, recall_class, action):
    res = client.post("/api/recalls", json={**recall_payload, "defect_type": defect_type})

    assert res.status_code == 201
    body = res.json()
    assert body["recall_class"] == recall_class
    assert body["action"] == action
    assert body["id"] >= 1
    assert "created_at" in body

    row = db.get(Recall, body["id"])
    assert row.recall_class == recall_class
    assert row.units_affected == recall_payload["units_affected"]


def test_create_normalises_defect_type(client, recall_payload):
    res = client.post("/api/recalls", json={**recall_payload, "defect_type": "  Wrong Drug "})
    assert res.status_code == 201
    assert res.json()["defect_type"] == "wrong_drug"
    assert res.json()["recall_class"] == "Class I"


def test_preview_classifies_without_saving(client, db, recall_payload):
    res = client.post("/api/recalls/preview", json={**recall_payload, "defect_type": "mislabeling"})

    assert res.status_code == 200
    body = res.json()
    assert body["recall_class"] == "Class II"
    assert body["meaning"].startswith("May cause temporary")
    assert "id" not in body
    assert count_recalls(db) == 0


def test_create_logs_info(client, recall_payload, caplog):
    with caplog.at_level(logging.INFO, logger="recall_system"):
        client.post("/api/recalls", json=recall_payload)
    assert "Metformin 500mg | BT-001 | Class I" in caplog.text


# --- UnknownDefectError -----------------------------------------------------

def test_create_unknown_defect_returns_friendly_error(client, db, recall_payload, caplog):
    payload = {**recall_payload, "defect_type": "Colour Change"}
    with caplog.at_level(logging.WARNING, logger="recall_system"):
        res = client.post("/api/recalls", json=payload)

    assert res.status_code == 422
    assert res.json() == {
        "code": "unknown_defect",
        "message": "Defect type 'colour_change' is not recognised.",
        "defect_type": "colour_change",
        "known_types": sorted(DEFECT_TO_CLASS),
    }
    assert count_recalls(db) == 0
    assert "Metformin 500mg - BT-001 UNKNOWN DEFECT" in caplog.text


def test_preview_unknown_defect_is_not_logged(client, recall_payload, caplog):
    with caplog.at_level(logging.WARNING, logger="recall_system"):
        res = client.post("/api/recalls/preview", json={**recall_payload, "defect_type": "rust"})

    assert res.status_code == 422
    assert res.json()["code"] == "unknown_defect"
    assert "UNKNOWN DEFECT" not in caplog.text


# --- validation -------------------------------------------------------------

def test_negative_units_is_validation_error(client, db, recall_payload):
    res = client.post("/api/recalls", json={**recall_payload, "units_affected": -5})

    assert res.status_code == 422
    body = res.json()
    assert body["code"] == "validation_error"
    assert [e["field"] for e in body["errors"]] == ["units_affected"]
    assert count_recalls(db) == 0


def test_missing_and_blank_fields_are_reported(client, recall_payload):
    payload = {**recall_payload, "drug_name": "   "}
    del payload["batch_id"]

    res = client.post("/api/recalls", json=payload)

    assert res.status_code == 422
    fields = sorted(e["field"] for e in res.json()["errors"])
    assert fields == ["batch_id", "drug_name"]


def test_no_delete_endpoint(client, recall_payload):
    rid = client.post("/api/recalls", json=recall_payload).json()["id"]
    assert client.delete(f"/api/recalls/{rid}").status_code in (404, 405)
