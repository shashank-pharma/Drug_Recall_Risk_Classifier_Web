from datetime import datetime

from drug_recall_risk_classifier import DEFECT_TO_CLASS


def test_summary_empty_db_is_zero_filled(client):
    body = client.get("/api/stats/summary").json()

    assert body["total_recalls"] == 0
    assert body["total_units"] == 0
    assert body["first_created_at"] is None
    assert body["last_created_at"] is None
    assert body["by_class"] == [
        {"recall_class": "Class I", "count": 0, "units": 0},
        {"recall_class": "Class II", "count": 0, "units": 0},
        {"recall_class": "Class III", "count": 0, "units": 0},
    ]
    assert sorted(d["defect_type"] for d in body["by_defect"]) == sorted(DEFECT_TO_CLASS)
    assert all(d["count"] == 0 for d in body["by_defect"])


def test_summary_counts(client, add_recall):
    add_recall("A", "B1", "contamination", 50000)
    add_recall("B", "B2", "contamination", 1000)
    add_recall("C", "B3", "wrong_drug", 10000)
    add_recall("D", "B4", "mislabeling", 25000)
    add_recall("E", "B5", "packaging_defect", 15000)

    body = client.get("/api/stats/summary").json()

    assert body["total_recalls"] == 5
    assert body["total_units"] == 101000
    assert body["by_class"] == [
        {"recall_class": "Class I", "count": 3, "units": 61000},
        {"recall_class": "Class II", "count": 1, "units": 25000},
        {"recall_class": "Class III", "count": 1, "units": 15000},
    ]
    # Highest count first, ties broken by name.
    assert body["by_defect"] == [
        {"defect_type": "contamination", "recall_class": "Class I", "count": 2},
        {"defect_type": "mislabeling", "recall_class": "Class II", "count": 1},
        {"defect_type": "packaging_defect", "recall_class": "Class III", "count": 1},
        {"defect_type": "wrong_drug", "recall_class": "Class I", "count": 1},
        {"defect_type": "subpotent", "recall_class": "Class II", "count": 0},
    ]


def test_summary_ignores_rejected_unknown_defects(client, recall_payload):
    client.post("/api/recalls", json=recall_payload)
    client.post("/api/recalls", json={**recall_payload, "defect_type": "colour_change"})

    body = client.get("/api/stats/summary").json()
    assert body["total_recalls"] == 1
    assert body["by_class"][0] == {"recall_class": "Class I", "count": 1, "units": 50000}


def test_summary_gives_the_date_range(client, add_recall):
    add_recall("A", "B1", "contamination", created_at=datetime(2026, 8, 3, 10, 30))
    add_recall("B", "B2", "mislabeling", created_at=datetime(2026, 10, 1, 9, 0))
    add_recall("C", "B3", "subpotent", created_at=datetime(2026, 9, 12, 18, 45))

    body = client.get("/api/stats/summary").json()
    assert body["first_created_at"] == "2026-08-03T10:30:00"
    assert body["last_created_at"] == "2026-10-01T09:00:00"
