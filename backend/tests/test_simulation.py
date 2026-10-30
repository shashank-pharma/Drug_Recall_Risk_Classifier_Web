"""Linked dashboard filters and the "what if" simulation time (`?at=`), which must never write anything."""

from datetime import datetime, timedelta, timezone

import pytest

from backend.app.db import SessionLocal
from backend.app.models import Recall


def ahead(**delta) -> str:
    return (datetime.now(timezone.utc) + timedelta(**delta)).isoformat()


def milestones(body) -> dict:
    return {m["key"]: m for m in body["timeline"]}


def snapshot() -> list[tuple]:
    with SessionLocal() as session:
        return [
            tuple(getattr(r, c.name) for c in Recall.__table__.columns)
            for r in session.query(Recall).order_by(Recall.id)
        ]


@pytest.fixture
def fresh_class_i(client, recall_payload):
    """Class I recall received an hour ago: stop sale is due in 23 h, completion in 71 h."""
    res = client.post("/api/recalls", json=recall_payload)
    assert res.status_code == 201
    return res.json()


# --- simulation -------------------------------------------------------------

def test_detail_statuses_move_with_the_simulation_time(client, fresh_class_i):
    rid = fresh_class_i["id"]
    assert milestones(fresh_class_i)["stop_sale"]["status"] == "due_soon"

    later = client.get(f"/api/recalls/{rid}", params={"at": ahead(hours=30)}).json()
    assert milestones(later)["stop_sale"]["status"] == "overdue"
    assert milestones(later)["completion"]["status"] == "on_track"

    end = client.get(f"/api/recalls/{rid}", params={"at": ahead(hours=72)}).json()
    assert milestones(end)["completion"]["status"] == "overdue"

    # Without `at` it is back to the real time.
    assert milestones(client.get(f"/api/recalls/{rid}").json())["stop_sale"]["status"] == "due_soon"


def test_list_and_summary_count_overdue_at_the_simulation_time(client, fresh_class_i):
    at = ahead(hours=30)
    assert client.get("/api/recalls", params={"status": "overdue"}).json()["total"] == 0
    page = client.get("/api/recalls", params={"status": "overdue", "at": at}).json()
    assert [r["id"] for r in page["items"]] == [fresh_class_i["id"]]
    assert milestones(page["items"][0])["stop_sale"]["status"] == "overdue"

    assert client.get("/api/stats/summary").json()["overdue"] == 0
    assert client.get("/api/stats/summary", params={"at": at}).json()["overdue"] == 1


def test_simulation_saves_nothing(client, fresh_class_i):
    before = snapshot()
    at = ahead(hours=48)
    client.get(f"/api/recalls/{fresh_class_i['id']}", params={"at": at})
    client.get("/api/recalls", params={"status": "overdue", "at": at})
    client.get("/api/stats/summary", params={"at": at})
    assert snapshot() == before


@pytest.mark.parametrize("at", [ahead(hours=80), ahead(hours=-2), "tomorrow"])
def test_simulation_time_outside_the_window_is_rejected(client, fresh_class_i, at):
    for path in (f"/api/recalls/{fresh_class_i['id']}", "/api/recalls", "/api/stats/summary"):
        res = client.get(path, params={"at": at})
        assert res.status_code == 422, path
        assert res.json()["code"] == "validation_error"


# --- linked filters ---------------------------------------------------------

@pytest.fixture
def mixed(add_recall):
    add_recall("A", "A1", "contamination", 100)
    add_recall("B", "B1", "contamination", 200)
    add_recall("C", "C1", "wrong_drug", 10)
    add_recall("D", "D1", "mislabeling", 5)
    add_recall("E", "E1", "packaging_defect", 1)


def counts(rows, key) -> dict:
    return {r[key]: r["count"] for r in rows if r["count"]}


def test_class_filter_narrows_totals_and_defects_but_not_the_class_chart(client, mixed):
    body = client.get("/api/stats/summary", params={"recall_class": "Class I"}).json()
    assert body["total_recalls"] == 3
    assert body["total_units"] == 310
    assert counts(body["by_defect"], "defect_type") == {"contamination": 2, "wrong_drug": 1}
    # The donut still shows every class, so the chosen one can be clicked again to clear it.
    assert counts(body["by_class"], "recall_class") == {"Class I": 3, "Class II": 1, "Class III": 1}


def test_defect_filter_narrows_totals_and_classes_but_not_the_defect_chart(client, mixed):
    body = client.get("/api/stats/summary", params={"defect_type": "Contamination"}).json()
    assert body["total_recalls"] == 2
    assert counts(body["by_class"], "recall_class") == {"Class I": 2}
    assert len(counts(body["by_defect"], "defect_type")) == 4


def test_both_filters_and_no_match(client, mixed):
    body = client.get("/api/stats/summary", params={"recall_class": "Class II", "defect_type": "contamination"}).json()
    assert body["total_recalls"] == 0
    assert body["total_units"] == 0
    # Date bounds stay unfiltered (they size the History slider).
    assert body["first_created_at"] is not None


def test_trend_follows_the_filters(client, add_recall):
    today = datetime.now(timezone.utc).replace(tzinfo=None)
    add_recall("A", "A1", "contamination", 100, created_at=today)
    add_recall("D", "D1", "mislabeling", 5, created_at=today)
    body = client.get("/api/stats/trend", params={"days": 7, "recall_class": "Class II"}).json()
    assert body["current"]["recalls"] == 1
    assert body["current"]["units"] == 5
    assert client.get("/api/stats/trend", params={"days": 7, "defect_type": "contamination"}).json()["current"]["recalls"] == 1
