from datetime import datetime

import pytest


@pytest.fixture
def seeded(add_recall):
    add_recall("Metformin 500mg", "BT-001", "contamination", 50000, datetime(2026, 10, 1, 9, 0))
    add_recall("Aspirin 75mg", "BT-002", "mislabeling", 25000, datetime(2026, 10, 2, 9, 0))
    add_recall("Insulin 100IU", "BT-003", "wrong_drug", 10000, datetime(2026, 10, 3, 9, 0))
    add_recall("Atorvastatin 10mg", "BT-004", "packaging_defect", 15000, datetime(2026, 10, 4, 23, 59))
    add_recall("Aspirin 150mg", "AX_100%", "subpotent", 5000, datetime(2026, 10, 5, 9, 0))


def batch_ids(res) -> list[str]:
    return [r["batch_id"] for r in res.json()["items"]]


def test_list_defaults_newest_first(client, seeded):
    res = client.get("/api/recalls")

    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 5
    assert body["page"] == 1 and body["page_size"] == 20
    assert batch_ids(res) == ["AX_100%", "BT-004", "BT-003", "BT-002", "BT-001"]
    assert set(body["items"][0]) >= {"id", "recall_class", "action", "meaning", "created_at"}


def test_list_empty(client):
    assert client.get("/api/recalls").json() == {"items": [], "total": 0, "page": 1, "page_size": 20}


def test_filter_by_one_class(client, seeded):
    res = client.get("/api/recalls", params={"recall_class": "Class I"})
    assert res.json()["total"] == 2
    assert sorted(batch_ids(res)) == ["BT-001", "BT-003"]


def test_filter_by_several_classes(client, seeded):
    res = client.get("/api/recalls", params=[("recall_class", "Class II"), ("recall_class", "Class III")])
    assert sorted(batch_ids(res)) == ["AX_100%", "BT-002", "BT-004"]


def test_filter_by_defect_type_is_normalised(client, seeded):
    res = client.get("/api/recalls", params={"defect_type": " Wrong Drug"})
    assert batch_ids(res) == ["BT-003"]


@pytest.mark.parametrize(
    ("q", "expected"),
    [
        ("aspirin", ["AX_100%", "BT-002"]),  # drug name, case-insensitive
        ("bt-00", ["BT-004", "BT-003", "BT-002", "BT-001"]),  # batch id
        ("%", ["AX_100%"]),  # % is matched literally, not as a wildcard
        ("T_00", []),  # _ is literal too (as a wildcard it would match "BT-001")
        ("nothing-like-this", []),
    ],
)
def test_search(client, seeded, q, expected):
    assert batch_ids(client.get("/api/recalls", params={"q": q})) == expected


def test_date_range_is_inclusive(client, seeded):
    res = client.get("/api/recalls", params={"date_from": "2026-10-02", "date_to": "2026-10-04"})
    # BT-004 was created at 23:59 on the 4th and must still be included.
    assert batch_ids(res) == ["BT-004", "BT-003", "BT-002"]


def test_filters_combine(client, seeded):
    res = client.get(
        "/api/recalls",
        params={"recall_class": "Class II", "q": "aspirin", "date_to": "2026-10-03"},
    )
    assert batch_ids(res) == ["BT-002"]


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("created_at", ["BT-001", "BT-002", "BT-003", "BT-004", "AX_100%"]),
        ("units_affected", ["AX_100%", "BT-003", "BT-004", "BT-002", "BT-001"]),
        ("-units_affected", ["BT-001", "BT-002", "BT-004", "BT-003", "AX_100%"]),
        ("drug_name", ["AX_100%", "BT-002", "BT-004", "BT-003", "BT-001"]),
    ],
)
def test_sort(client, seeded, sort, expected):
    assert batch_ids(client.get("/api/recalls", params={"sort": sort})) == expected


def test_sort_by_class_groups_classes(client, seeded):
    res = client.get("/api/recalls", params={"sort": "recall_class"})
    classes = [r["recall_class"] for r in res.json()["items"]]
    assert classes == ["Class I", "Class I", "Class II", "Class II", "Class III"]


def test_pagination(client, seeded):
    page1 = client.get("/api/recalls", params={"page": 1, "page_size": 2, "sort": "created_at"})
    page3 = client.get("/api/recalls", params={"page": 3, "page_size": 2, "sort": "created_at"})
    past_end = client.get("/api/recalls", params={"page": 9, "page_size": 2})

    assert batch_ids(page1) == ["BT-001", "BT-002"]
    assert batch_ids(page3) == ["AX_100%"]
    assert page1.json()["total"] == page3.json()["total"] == 5
    assert past_end.json()["items"] == [] and past_end.json()["total"] == 5


@pytest.mark.parametrize(
    ("params", "field"),
    [
        ({"sort": "reason"}, "sort"),
        ({"page": 0}, "page"),
        ({"page_size": 101}, "page_size"),
        ({"date_from": "not-a-date"}, "date_from"),
    ],
)
def test_bad_query_params(client, params, field):
    res = client.get("/api/recalls", params=params)
    assert res.status_code == 422
    assert res.json()["code"] == "validation_error"
    assert [e["field"] for e in res.json()["errors"]] == [field]


def test_get_one(client, seeded):
    first = client.get("/api/recalls").json()["items"][0]
    res = client.get(f"/api/recalls/{first['id']}")
    assert res.status_code == 200
    assert res.json() == first


def test_get_missing_is_friendly_404(client):
    res = client.get("/api/recalls/999")
    assert res.status_code == 404
    assert res.json() == {"code": "not_found", "message": "Recall 999 was not found."}


def test_created_via_api_shows_in_history(client, recall_payload):
    client.post("/api/recalls", json=recall_payload)
    client.post("/api/recalls", json={**recall_payload, "defect_type": "colour_change"})  # rejected

    body = client.get("/api/recalls").json()
    assert body["total"] == 1
    assert body["items"][0]["batch_id"] == "BT-001"
