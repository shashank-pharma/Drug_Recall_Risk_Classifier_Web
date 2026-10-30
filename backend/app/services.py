"""Thin layer between the API and the classifier; all rules stay in the classifier."""

import logging
from dataclasses import asdict
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from drug_recall_risk_classifier import (
    DEFECT_TO_CLASS,
    MARKABLE_MILESTONES,
    DrugRecall,
    RecallClass,
    UnknownDefectError,
    recall_timeline,
)

from .models import Recall
from .schemas import MilestoneUpdate, RecallFields, RecallIn, RecallQuery, StatsQuery, utc_now

# Same logger the classifier uses, so entries land in recall_system_log.txt.
logger = logging.getLogger("recall_system")

CLASS_BY_LABEL = {c.label: c for c in RecallClass}

# Columns copied as-is into every API response.
STORED_FIELDS = (
    "drug_name", "batch_id", "reason", "defect_type", "units_affected",
    "recall_class", "action", "meaning",
)


class TimelineError(ValueError):
    """A timeline change that breaks the CDSCO rules or the recall's own dates."""


def classify(data: RecallFields) -> dict:
    """Return the classified recall fields that get stored. Raises UnknownDefectError."""
    recall = DrugRecall(**data.model_dump(include=set(RecallFields.model_fields)))
    try:
        fields = recall.to_dict()
    except UnknownDefectError as exc:
        # Lets the API error handler name the (normalised) defect type.
        exc.defect_type = recall.defect_type
        raise
    fields.pop("date")  # the DB records its own created_at
    return fields


def _derived(recall_class: str, received, decision, done: dict, now: datetime) -> dict:
    """Recall levels and the CDSCO timeline. Timeline is None without a received time."""
    cls = CLASS_BY_LABEL.get(recall_class)
    if cls is None:
        return {"recall_levels": [], "public_announcement": False, "timeline": None}
    timeline = None
    if received is not None:
        timeline = [asdict(m) for m in recall_timeline(cls, received, decision, done, now)]
    return {
        "recall_levels": list(cls.levels),
        "public_announcement": cls.public_announcement,
        "timeline": timeline,
    }


def preview(data: RecallIn, now: datetime | None = None) -> dict:
    fields = classify(data)
    return {
        **fields,
        "information_received_at": data.information_received_at,
        "decision_at": data.decision_at,
        **_derived(fields["recall_class"], data.information_received_at, data.decision_at, {}, now or utc_now()),
    }


def recall_out(row: Recall, now: datetime | None = None) -> dict:
    """API view of a stored recall; timeline statuses are worked out at `now`."""
    done = {key: getattr(row, f"{key}_done_at") for key in MARKABLE_MILESTONES}
    return {
        **{name: getattr(row, name) for name in STORED_FIELDS},
        "id": row.id,
        "created_at": row.created_at,
        "information_received_at": row.information_received_at,
        "decision_at": row.decision_at,
        **_derived(row.recall_class, row.information_received_at, row.decision_at, done, now or utc_now()),
    }


def create_recall(session: Session, data: RecallIn) -> Recall:
    try:
        fields = classify(data)
    except UnknownDefectError as exc:
        logger.warning("%s - %s UNKNOWN DEFECT - %s", data.drug_name, data.batch_id, exc)
        raise
    row = Recall(
        **fields,
        information_received_at=data.information_received_at,
        decision_at=data.decision_at,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    logger.info("%s | %s | %s", row.drug_name, row.batch_id, row.recall_class)
    return row


def get_recall(session: Session, recall_id: int) -> Recall | None:
    return session.get(Recall, recall_id)


def _require_timeline(row: Recall) -> None:
    if row.information_received_at is None:
        raise TimelineError(
            "This recall has no information-received time, so it has no CDSCO timeline."
        )


def set_decision(session: Session, recall_id: int, decision_at: datetime | None) -> Recall | None:
    row = session.get(Recall, recall_id)
    if row is None:
        return None
    _require_timeline(row)
    if decision_at is not None:
        if decision_at < row.information_received_at:
            raise TimelineError("The recall decision can't be before the information was received.")
        if row.communication_done_at is not None and decision_at > row.communication_done_at:
            raise TimelineError("The recall decision can't be after the supply chain was informed.")
    else:
        # The communication deadline runs from the decision, so it goes too.
        row.communication_done_at = None
    row.decision_at = decision_at
    session.commit()
    session.refresh(row)
    logger.info(
        "%s | %s | recall decision %s",
        row.drug_name, row.batch_id, f"recorded at {decision_at:%Y-%m-%d %H:%M} UTC" if decision_at else "cleared",
    )
    return row


def set_milestone(
    session: Session, recall_id: int, key: str, update: MilestoneUpdate, now: datetime | None = None
) -> Recall | None:
    row = session.get(Recall, recall_id)
    if row is None:
        return None
    _require_timeline(row)
    cls = CLASS_BY_LABEL[row.recall_class]
    if key == "stop_sale" and cls.stop_sale is None:
        raise TimelineError(
            f"{cls.label} has no separate stop sale deadline (CDSCO §8.0), so it can't be marked done."
        )
    if key == "communication" and row.decision_at is None:
        raise TimelineError("Record the recall decision first: the supply chain deadline starts from it.")

    done_at = None
    if update.done:
        done_at = update.done_at or now or utc_now()
        earliest = row.decision_at if key == "communication" else row.information_received_at
        if done_at < earliest:
            raise TimelineError(
                "This can't be done before the recall decision."
                if key == "communication"
                else "This can't be done before the information was received."
            )
    setattr(row, f"{key}_done_at", done_at)
    session.commit()
    session.refresh(row)
    logger.info(
        "%s | %s | %s %s",
        row.drug_name, row.batch_id, key, f"done at {done_at:%Y-%m-%d %H:%M} UTC" if done_at else "marked not done",
    )
    return row


def _normalise_defect(defect_type: str) -> str:
    # Same normalisation as DrugRecall.__post_init__.
    return defect_type.strip().lower().replace(" ", "_")


def _filtered(stmt, recall_class: str | None = None, defect_type: str | None = None):
    if recall_class:
        stmt = stmt.where(Recall.recall_class == recall_class)
    if defect_type:
        stmt = stmt.where(Recall.defect_type == _normalise_defect(defect_type))
    return stmt


def overdue_ids(session: Session, now: datetime | None = None, stmt=None) -> list[int]:
    """Recalls with at least one overdue milestone.

    Statuses depend on the current time, so they are worked out in Python rather
    than stored; fine for this app's data size.
    """
    now = now or utc_now()
    rows = session.scalars((stmt if stmt is not None else select(Recall)).where(Recall.information_received_at.is_not(None)))
    return [
        row.id for row in rows
        if any(m["status"] == "overdue" for m in recall_out(row, now)["timeline"] or [])
    ]


def list_recalls(session: Session, params: RecallQuery) -> tuple[list[Recall], int]:
    """One page of recalls matching the filters, plus the total match count."""
    stmt = select(Recall)
    if params.recall_class:
        stmt = stmt.where(Recall.recall_class.in_(params.recall_class))
    if params.defect_type:
        stmt = stmt.where(Recall.defect_type == _normalise_defect(params.defect_type))
    if params.q and params.q.strip():
        q = params.q.strip()
        stmt = stmt.where(
            or_(
                Recall.drug_name.icontains(q, autoescape=True),
                Recall.batch_id.icontains(q, autoescape=True),
            )
        )
    if params.date_from:
        stmt = stmt.where(Recall.created_at >= datetime.combine(params.date_from, time.min))
    if params.date_to:
        next_day = params.date_to + timedelta(days=1)
        stmt = stmt.where(Recall.created_at < datetime.combine(next_day, time.min))
    if params.status == "overdue":
        stmt = stmt.where(Recall.id.in_(overdue_ids(session, params.at)))

    total = session.scalar(select(func.count()).select_from(stmt.subquery()))

    descending = params.sort.startswith("-")
    column = getattr(Recall, params.sort.lstrip("-"))
    order = [column.desc(), Recall.id.desc()] if descending else [column.asc(), Recall.id.asc()]
    items = session.scalars(
        stmt.order_by(*order)
        .offset((params.page - 1) * params.page_size)
        .limit(params.page_size)
    ).all()
    return list(items), total


def recall_count(session: Session) -> int:
    return session.scalar(select(func.count()).select_from(Recall))


# Example recalls for a demo database: (drug, defect, units, saved days ago, which milestones are done).
# Batches start with "SAMPLE-" so they are easy to spot. Times are relative to when they are loaded.
SAMPLE_RECALLS = (
    ("Metformin 500mg", "contamination", 48_000, 0.1, ()),
    ("Amoxicillin 250mg", "wrong_drug", 12_500, 2, ("decision",)),
    ("Atorvastatin 10mg", "mislabeling", 30_000, 4, ()),
    ("Cetirizine 10mg", "packaging_defect", 8_000, 6, ("completion",)),
    ("Paracetamol 500mg", "subpotent", 75_000, 9, ("completion",)),
    ("Omeprazole 20mg", "contamination", 22_000, 13, ("decision", "communication", "stop_sale", "completion")),
    ("Losartan 50mg", "mislabeling", 16_000, 18, ()),
    ("Amlodipine 5mg", "packaging_defect", 5_500, 24, ()),
    ("Ibuprofen 400mg", "subpotent", 40_000, 33, ("completion",)),
    ("Azithromycin 500mg", "wrong_drug", 9_000, 41, ("decision", "communication", "stop_sale", "completion")),
    ("Pantoprazole 40mg", "contamination", 27_000, 52, ("decision", "communication", "stop_sale")),
    ("Levothyroxine 50mcg", "packaging_defect", 3_000, 58, ("completion",)),
)


def load_sample_data(session: Session, now: datetime | None = None) -> int:
    """Insert the example recalls with CDSCO timelines; done milestones are marked as met in time."""
    now = now or utc_now()

    def past(when: datetime) -> datetime:  # never record a milestone as done in the future
        return min(when, now - timedelta(minutes=30))

    for i, (drug, defect, units, days_ago, done) in enumerate(SAMPLE_RECALLS, start=1):
        received = now - timedelta(days=days_ago)
        cls = DEFECT_TO_CLASS[defect]
        fields = classify(RecallFields(
            drug_name=drug, batch_id=f"SAMPLE-{i:03d}", reason="Example recall (sample data)",
            defect_type=defect, units_affected=units,
        ))
        row = Recall(**fields, created_at=received, information_received_at=received)
        decision = past(received + timedelta(hours=12))
        if "decision" in done:
            row.decision_at = decision
        if "communication" in done:
            row.communication_done_at = past(decision + timedelta(hours=6))
        if "stop_sale" in done and cls.stop_sale is not None:
            row.stop_sale_done_at = past(received + cls.stop_sale / 2)
        if "completion" in done:
            row.completion_done_at = past(received + cls.completion / 2)
        session.add(row)
    session.commit()
    logger.info("Loaded %d sample recalls (batches SAMPLE-001 to SAMPLE-%03d)", len(SAMPLE_RECALLS), len(SAMPLE_RECALLS))
    return len(SAMPLE_RECALLS)


def stats_summary(session: Session, params: StatsQuery | None = None) -> dict:
    """Counts for the dashboard; every class and known defect type appears, even at zero.

    Filters work like linked charts: totals use both, by_class only the defect filter and
    by_defect only the class filter (see StatsQuery).
    """
    params = params or StatsQuery()
    cls_f, defect_f = params.recall_class, params.defect_type
    by_class = {c.label: {"recall_class": c.label, "count": 0, "units": 0} for c in RecallClass}
    class_rows = session.execute(
        _filtered(select(Recall.recall_class, func.count(), func.sum(Recall.units_affected)), defect_type=defect_f)
        .group_by(Recall.recall_class)
    )
    for label, count, units in class_rows:
        by_class[label] = {"recall_class": label, "count": count, "units": units}

    # Keyed by (defect, class): stored rows keep the class they were saved with.
    by_defect = {
        (defect, cls.label): {"defect_type": defect, "recall_class": cls.label, "count": 0, "units": 0}
        for defect, cls in DEFECT_TO_CLASS.items()
    }
    defect_rows = session.execute(
        _filtered(
            select(Recall.defect_type, Recall.recall_class, func.count(), func.sum(Recall.units_affected)),
            recall_class=cls_f,
        ).group_by(Recall.defect_type, Recall.recall_class)
    )
    for defect, label, count, units in defect_rows:
        by_defect[(defect, label)] = {"defect_type": defect, "recall_class": label, "count": count, "units": units or 0}

    count, units = session.execute(
        _filtered(select(func.count(), func.coalesce(func.sum(Recall.units_affected), 0)), cls_f, defect_f)
    ).one()
    # The date bounds stay unfiltered: they size the History date-range slider.
    first, last = session.execute(select(func.min(Recall.created_at), func.max(Recall.created_at))).one()
    return {
        "total_recalls": count,
        "total_units": units,
        "overdue": len(overdue_ids(session, params.at, _filtered(select(Recall), cls_f, defect_f))),
        # Bounds for the History date-range slider (None when there are no recalls).
        "first_created_at": first,
        "last_created_at": last,
        "by_class": list(by_class.values()),
        "by_defect": sorted(by_defect.values(), key=lambda d: (-d["count"], d["defect_type"])),
    }


def stats_trend(
    session: Session,
    days: int,
    today: date | None = None,
    recall_class: str | None = None,
    defect_type: str | None = None,
) -> dict:
    """Recalls per UTC day for the last `days` days (today included), zero-filled, and the totals
    of this window and the one before it, so the dashboard can show a change only from real data."""
    end = today or utc_now().date()
    start = end - timedelta(days=days - 1)
    previous_start = start - timedelta(days=days)
    labels = [c.label for c in RecallClass]

    def empty_window() -> dict:
        return {"recalls": 0, "units": 0, "by_class": dict.fromkeys(labels, 0)}

    series = {
        start + timedelta(days=i): {"total": 0, "by_class": dict.fromkeys(labels, 0)} for i in range(days)
    }
    current, previous = empty_window(), empty_window()
    rows = session.execute(
        _filtered(select(Recall.created_at, Recall.recall_class, Recall.units_affected), recall_class, defect_type).where(
            Recall.created_at >= datetime.combine(previous_start, time.min),
            Recall.created_at < datetime.combine(end + timedelta(days=1), time.min),
        )
    )
    for created_at, recall_class, units in rows:
        day = created_at.date()
        window = current if day >= start else previous
        window["recalls"] += 1
        window["units"] += units
        window["by_class"][recall_class] = window["by_class"].get(recall_class, 0) + 1
        if day in series:
            series[day]["total"] += 1
            series[day]["by_class"][recall_class] = series[day]["by_class"].get(recall_class, 0) + 1

    return {
        "days": days,
        "start": start,
        "end": end,
        "series": [{"date": day, **counts} for day, counts in series.items()],
        "current": current,
        "previous": previous,
    }
