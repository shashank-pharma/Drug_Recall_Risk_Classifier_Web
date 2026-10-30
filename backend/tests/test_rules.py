"""CDSCO rules (docs/regulatory/CDSCO_Recall_Rapid_Alert_Guidelines_2024.pdf) and recall_timeline()."""

from datetime import datetime, timedelta

import pytest

from drug_recall_risk_classifier import (
    COMMUNICATION_WINDOW,
    DECISION_WINDOW,
    RULES_SOURCE,
    RecallClass,
    recall_timeline,
)

H = timedelta(hours=1)
START = datetime(2026, 10, 1, 9, 0)


def by_key(milestones):
    return {m.key: m for m in milestones}


# --- the rule table ---------------------------------------------------------

@pytest.mark.parametrize(
    ("cls", "stop_sale", "completion", "levels", "public"),
    [
        # §8.0: Class I stop sale 24 h, physical recall 72 h; II 10 days; III 30 days.
        # §7.0: I wholesale/retail/consumer + public announcement; II wholesale+retail; III wholesale.
        (RecallClass.CLASS_I, timedelta(hours=24), timedelta(hours=72), ("wholesale", "retail", "consumer"), True),
        (RecallClass.CLASS_II, None, timedelta(days=10), ("wholesale", "retail"), False),
        (RecallClass.CLASS_III, None, timedelta(days=30), ("wholesale",), False),
    ],
)
def test_class_rules_match_cdsco(cls, stop_sale, completion, levels, public):
    assert cls.stop_sale == stop_sale
    assert cls.completion == completion
    assert cls.levels == levels
    assert cls.public_announcement is public


def test_section_9_windows():
    assert DECISION_WINDOW == timedelta(hours=72)
    assert COMMUNICATION_WINDOW == timedelta(hours=24)


def test_every_milestone_cites_a_section():
    for cls in RecallClass:
        for m in recall_timeline(cls, START, START + H, now=START):
            assert m.source.startswith(RULES_SOURCE)
            assert m.source.endswith(("§8.0", "§9.0"))
            assert m.note


# --- recall_timeline --------------------------------------------------------

def test_class_i_milestones_and_due_times():
    ms = recall_timeline(RecallClass.CLASS_I, START, decision_at=START + 2 * H, now=START + 3 * H)
    assert [m.key for m in ms] == ["decision", "communication", "stop_sale", "completion"]
    m = by_key(ms)
    assert m["decision"].due_at == START + 72 * H
    assert m["decision"].done_at == START + 2 * H
    assert m["decision"].status == "done"
    assert m["communication"].due_at == START + 2 * H + 24 * H
    assert m["stop_sale"].due_at == START + 24 * H
    assert m["completion"].due_at == START + 72 * H


@pytest.mark.parametrize(("cls", "days"), [(RecallClass.CLASS_II, 10), (RecallClass.CLASS_III, 30)])
def test_class_ii_iii_use_calendar_days_and_no_stop_sale(cls, days):
    m = by_key(recall_timeline(cls, START, now=START))
    assert "decision" not in m
    assert m["completion"].due_at == START + timedelta(days=days)
    assert f"{days} calendar days" in m["completion"].note
    assert m["stop_sale"].status == "not_specified"
    assert m["stop_sale"].due_at is None


def test_communication_waits_for_a_decision():
    m = by_key(recall_timeline(RecallClass.CLASS_II, START, now=START))
    assert m["communication"].status == "waiting"
    assert m["communication"].due_at is None


@pytest.mark.parametrize(
    ("now", "status"),
    [
        (START + H, "due_soon"),                          # 23 h left (≤ 24 h)
        (START + 24 * H, "due_soon"),                     # exactly at the deadline: not yet late
        (START + 24 * H + timedelta(minutes=1), "overdue"),
        (START - 2 * H, "on_track"),                      # more than 24 h left
    ],
)
def test_status_around_the_stop_sale_deadline(now, status):
    m = by_key(recall_timeline(RecallClass.CLASS_I, START, now=now))
    assert m["stop_sale"].status == status


def test_done_on_time_and_late():
    on_time = by_key(recall_timeline(
        RecallClass.CLASS_I, START, done_at={"stop_sale": START + 24 * H}, now=START + 100 * H
    ))
    late = by_key(recall_timeline(
        RecallClass.CLASS_I, START, done_at={"stop_sale": START + 24 * H + timedelta(seconds=1)}, now=START
    ))
    assert on_time["stop_sale"].status == "done"
    assert late["stop_sale"].status == "done_late"


def test_each_milestone_knows_when_its_clock_started():
    decided = START + 5 * H
    m = by_key(recall_timeline(RecallClass.CLASS_I, START, decision_at=decided, now=START))
    assert m["decision"].starts_at == START
    assert m["stop_sale"].starts_at == START
    assert m["completion"].starts_at == START
    assert m["communication"].starts_at == decided  # its 24 h run from the decision


def test_milestones_without_a_deadline_have_no_start():
    m = by_key(recall_timeline(RecallClass.CLASS_II, START, now=START))
    assert m["communication"].starts_at is None  # waiting for a decision
    assert m["stop_sale"].starts_at is None  # not specified for Class II
    assert m["completion"].starts_at == START


def test_late_decision_is_done_late():
    m = by_key(recall_timeline(RecallClass.CLASS_I, START, decision_at=START + 73 * H, now=START + 80 * H))
    assert m["decision"].status == "done_late"
