from datetime import date, datetime, timedelta

import pytest

from backend.app import services
from backend.app.db import SessionLocal

TODAY = date(2026, 10, 30)


def at(day: date, hour: int = 12) -> datetime:
    return datetime(day.year, day.month, day.day, hour)


@pytest.fixture
def trend(client):
    """Call the service with a fixed 'today' so tests do not depend on the clock."""
    def _trend(days: int) -> dict:
        with SessionLocal() as session:
            return services.stats_trend(session, days, today=TODAY)
    return _trend


def test_empty_database_is_zero_filled(trend):
    body = trend(7)
    assert body["start"] == date(2026, 10, 24)
    assert body["end"] == TODAY
    assert [d["date"] for d in body["series"]] == [date(2026, 10, 24) + timedelta(days=i) for i in range(7)]
    assert all(d["total"] == 0 for d in body["series"])
    assert body["series"][0]["by_class"] == {"Class I": 0, "Class II": 0, "Class III": 0}
    assert body["current"] == body["previous"] == {
        "recalls": 0, "units": 0, "by_class": {"Class I": 0, "Class II": 0, "Class III": 0},
    }


def test_counts_land_on_their_utc_day_and_class(trend, add_recall):
    add_recall("A", "B1", "contamination", 100, created_at=at(TODAY, 0))  # first minute-ish of today
    add_recall("B", "B2", "mislabeling", 50, created_at=at(TODAY, 23))
    add_recall("C", "B3", "contamination", 10, created_at=at(TODAY - timedelta(days=6)))  # first day of window

    body = trend(7)
    today = body["series"][-1]
    assert today["total"] == 2
    assert today["by_class"] == {"Class I": 1, "Class II": 1, "Class III": 0}
    assert body["series"][0]["total"] == 1
    assert body["current"] == {"recalls": 3, "units": 160, "by_class": {"Class I": 2, "Class II": 1, "Class III": 0}}


def test_previous_window_is_counted_separately(trend, add_recall):
    add_recall("Now", "N1", "contamination", 5, created_at=at(TODAY - timedelta(days=2)))
    add_recall("Before", "P1", "contamination", 7, created_at=at(TODAY - timedelta(days=7)))  # day before window
    add_recall("Before", "P2", "packaging_defect", 3, created_at=at(TODAY - timedelta(days=13)))  # last previous day
    add_recall("Too old", "X1", "contamination", 1, created_at=at(TODAY - timedelta(days=14)))  # outside both

    body = trend(7)
    assert body["current"]["recalls"] == 1
    assert body["previous"] == {"recalls": 2, "units": 10, "by_class": {"Class I": 1, "Class II": 0, "Class III": 1}}
    assert sum(d["total"] for d in body["series"]) == 1  # the series only covers the current window


def test_future_records_are_ignored(trend, add_recall):
    add_recall("Tomorrow", "T1", "contamination", created_at=at(TODAY + timedelta(days=1)))
    assert trend(7)["current"]["recalls"] == 0


@pytest.mark.parametrize("days", [7, 30, 90])
def test_endpoint_accepts_the_three_windows(client, days):
    body = client.get("/api/stats/trend", params={"days": days}).json()
    assert body["days"] == days
    assert len(body["series"]) == days


def test_endpoint_defaults_to_30_days(client):
    assert client.get("/api/stats/trend").json()["days"] == 30


@pytest.mark.parametrize("days", ["14", "0", "abc"])
def test_endpoint_rejects_other_windows(client, days):
    res = client.get("/api/stats/trend", params={"days": days})
    assert res.status_code == 422
    assert res.json()["code"] == "validation_error"
    assert [e["field"] for e in res.json()["errors"]] == ["days"]
