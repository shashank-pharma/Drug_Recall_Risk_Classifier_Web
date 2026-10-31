"""Public demo mode (seed, cap, notice flag) and serving the built frontend."""

from datetime import datetime

import pytest

from backend.app import demo
from backend.app.schemas import MAX_UNITS, utc_now
from backend.app.services import DEMO_RECALLS


@pytest.fixture
def demo_on(monkeypatch):
    monkeypatch.setenv(demo.FLAG, "1")


def recalls(client):
    return client.get("/api/recalls", params={"page_size": 100}).json()


def test_demo_is_off_by_default(monkeypatch, client):
    monkeypatch.delenv(demo.FLAG, raising=False)
    assert client.get("/api/demo").json()["enabled"] is False
    assert recalls(client)["total"] == 0


def test_seeds_an_empty_database_on_start(demo_on, client):
    assert client.get("/api/demo").json() == {"enabled": True, "max_recalls": demo.MAX_RECALLS}
    page = recalls(client)
    assert page["total"] == len(DEMO_RECALLS) == 5
    assert {r["recall_class"] for r in page["items"]} == {"Class I", "Class II", "Class III"}
    by_drug = {r["drug_name"]: r for r in page["items"]}

    def statuses(drug):
        return {m["key"]: m["status"] for m in by_drug[drug]["timeline"]}

    overdue = statuses("Metformin 500mg")  # 5 days old, nothing done
    assert overdue["decision"] == overdue["stop_sale"] == overdue["completion"] == "overdue"
    assert "done" not in overdue.values()
    mostly_done = statuses("Amoxicillin 250mg")
    assert [k for k, v in mostly_done.items() if v == "done"] == ["decision", "communication", "stop_sale"]
    assert sum(1 for v in mostly_done.values() if v == "done") == len(mostly_done) - 1
    # The rest is pending or in progress.
    assert "overdue" not in statuses("Paracetamol 500mg").values()


def test_seed_dates_are_relative_to_start(demo_on, client):
    now = utc_now().isoformat()
    for r in recalls(client)["items"]:
        assert r["information_received_at"] <= now
        assert r["created_at"] <= now
    metformin = next(r for r in recalls(client)["items"] if r["drug_name"] == "Metformin 500mg")
    age = utc_now() - datetime.fromisoformat(metformin["information_received_at"])
    assert 4.9 < age.total_seconds() / 86400 < 5.1


def test_seed_never_touches_existing_data(demo_on, monkeypatch, client, db):
    from backend.app.services import seed_demo_data

    assert seed_demo_data(db) == 0  # the lifespan already seeded
    assert recalls(client)["total"] == 5


def test_demo_cap_gives_a_friendly_error(demo_on, monkeypatch, client, recall_payload):
    monkeypatch.setattr(demo, "MAX_RECALLS", 6)
    assert client.post("/api/recalls", json=recall_payload).status_code == 201  # 5 seeded + 1
    res = client.post("/api/recalls", json=recall_payload)
    assert res.status_code == 409
    assert res.json() == {"code": "demo_full", "message": "Demo is full. It resets when the server restarts."}
    assert recalls(client)["total"] == 6


def test_no_cap_outside_demo(monkeypatch, client, recall_payload):
    monkeypatch.delenv(demo.FLAG, raising=False)
    monkeypatch.setattr(demo, "MAX_RECALLS", 1)
    for _ in range(3):
        assert client.post("/api/recalls", json=recall_payload).status_code == 201


@pytest.mark.parametrize(
    "field, value",
    [
        ("drug_name", "x" * 201),
        ("batch_id", "x" * 101),
        ("reason", "x" * 1001),
        ("defect_type", "x" * 101),
        ("units_affected", MAX_UNITS + 1),
    ],
)
def test_field_limits(client, recall_payload, field, value):
    res = client.post("/api/recalls", json={**recall_payload, field: value})
    assert res.status_code == 422
    assert res.json()["code"] == "validation_error"
    assert res.json()["errors"][0]["field"] == field


def test_field_limits_accept_the_maximum(client, recall_payload):
    payload = {**recall_payload, "drug_name": "x" * 200, "batch_id": "y" * 100, "reason": "z" * 1000,
               "units_affected": MAX_UNITS}
    assert client.post("/api/recalls", json=payload).status_code == 201


@pytest.fixture
def dist(tmp_path, monkeypatch):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<!doctype html><title>app</title>")
    (tmp_path / "assets" / "app-abc.js").write_text("console.log(1)")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    monkeypatch.setenv("RECALL_STATIC_DIR", str(tmp_path))
    return tmp_path


@pytest.mark.parametrize("path", ["/", "/explorer", "/dashboard", "/history", "/recalls/3"])
def test_client_routes_get_the_app(client, dist, path):
    res = client.get(path)
    assert res.status_code == 200
    assert "<title>app</title>" in res.text


def test_files_are_served(client, dist):
    js = client.get("/assets/app-abc.js")
    assert js.status_code == 200 and "immutable" in js.headers["cache-control"]
    assert client.get("/favicon.svg").status_code == 200


def test_missing_file_is_404_not_the_app(client, dist):
    assert client.get("/assets/nope.js").status_code == 404


def test_api_is_untouched(client, dist):
    assert client.get("/api/health").json() == {"status": "ok"}
    res = client.get("/api/nope")
    assert res.status_code == 404 and res.json()["code"] == "not_found"
    assert client.get("/api/recalls/999").json()["code"] == "not_found"
    assert client.delete("/api/recalls/1").json()["code"] == "method_not_allowed"
    assert client.post("/explorer").status_code in (404, 405)


def test_no_path_escape(client, dist):
    secret = dist.parent / "secret.txt"
    secret.write_text("secret")
    res = client.get("/..%2fsecret.txt")
    assert "secret" not in res.text


def test_api_only_without_a_build(client, tmp_path, monkeypatch):
    monkeypatch.setenv("RECALL_STATIC_DIR", str(tmp_path / "missing"))
    res = client.get("/explorer")
    assert res.status_code == 404 and res.json()["code"] == "not_found"
