from datetime import date, datetime, timedelta, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

# Allow a little clock difference between the browser and the server.
CLOCK_SKEW = timedelta(minutes=5)


def utc_naive(value: datetime) -> datetime:
    """Store and compare every timestamp as naive UTC (like created_at)."""
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _not_in_future(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    value = utc_naive(value)
    if value > utc_now() + CLOCK_SKEW:
        raise ValueError("Must not be in the future.")
    return value


class RecallFields(BaseModel):
    """What classification needs. The legacy import uses this directly (no timeline)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    drug_name: str = Field(min_length=1, max_length=200)
    batch_id: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=1000)
    defect_type: str = Field(min_length=1, max_length=100)
    units_affected: int = Field(ge=0)


class RecallIn(RecallFields):
    # CDSCO §8.0: the timeline runs from receipt of the information.
    information_received_at: datetime
    decision_at: datetime | None = None

    _check_received = field_validator("information_received_at")(_not_in_future)

    @field_validator("decision_at")
    @classmethod
    def _check_decision(cls, value: datetime | None, info: ValidationInfo) -> datetime | None:
        value = _not_in_future(value)
        received = info.data.get("information_received_at")
        if value is not None and received is not None and value < received:
            raise ValueError("Must not be before the information was received.")
        return value


class DecisionUpdate(BaseModel):
    decision_at: datetime | None

    _check = field_validator("decision_at")(_not_in_future)


class MilestoneUpdate(BaseModel):
    done: bool
    done_at: datetime | None = None  # defaults to now when done is true

    _check = field_validator("done_at")(_not_in_future)


class MilestoneOut(BaseModel):
    key: str
    label: str
    due_at: datetime | None
    done_at: datetime | None
    status: Literal["done", "done_late", "overdue", "due_soon", "on_track", "not_specified", "waiting"]
    source: str
    note: str
    starts_at: datetime | None


class RecallPreview(BaseModel):
    """Classified recall, not saved. defect_type is the normalised form."""

    drug_name: str
    batch_id: str
    reason: str
    defect_type: str
    units_affected: int
    recall_class: str
    action: str
    meaning: str
    recall_levels: list[str]
    public_announcement: bool
    information_received_at: datetime | None
    decision_at: datetime | None
    # None when the recall has no information-received time (saved before Phase 9).
    timeline: list[MilestoneOut] | None


class RecallOut(RecallPreview):
    id: int
    created_at: datetime


class DefectTypeOut(BaseModel):
    defect_type: str
    recall_class: str
    action: str
    meaning: str


class RecallRuleOut(BaseModel):
    recall_class: str
    stop_sale_hours: float | None
    completion_hours: float
    recall_levels: list[str]
    public_announcement: bool
    source_timelines: str
    source_levels: str


SortField = Literal[
    "created_at", "-created_at",
    "drug_name", "-drug_name",
    "recall_class", "-recall_class",
    "units_affected", "-units_affected",
]


class RecallQuery(BaseModel):
    """History filters, read from the query string."""

    recall_class: list[str] = []  # repeat the param for several: ?recall_class=Class I&recall_class=Class II
    defect_type: str | None = None
    q: str | None = Field(None, description="Search in drug name or batch ID")
    date_from: date | None = None  # inclusive, UTC date
    date_to: date | None = None  # inclusive, UTC date
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    sort: SortField = "-created_at"
    status: Literal["overdue"] | None = None


class RecallPage(BaseModel):
    items: list[RecallOut]
    total: int
    page: int
    page_size: int


class ClassCount(BaseModel):
    recall_class: str
    count: int
    units: int


class DefectCount(BaseModel):
    defect_type: str
    recall_class: str
    count: int


class StatsSummary(BaseModel):
    total_recalls: int
    total_units: int
    overdue: int
    first_created_at: datetime | None
    last_created_at: datetime | None
    by_class: list[ClassCount]
    by_defect: list[DefectCount]
