from datetime import datetime, timezone

from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Recall(Base):
    __tablename__ = "recalls"

    id: Mapped[int] = mapped_column(primary_key=True)
    drug_name: Mapped[str]
    batch_id: Mapped[str]
    reason: Mapped[str]
    defect_type: Mapped[str]
    # action/meaning are snapshotted so old records stay correct if the rules change.
    recall_class: Mapped[str] = mapped_column(index=True)
    action: Mapped[str]
    meaning: Mapped[str]
    units_affected: Mapped[int]
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc), index=True
    )
    # CDSCO timeline (all UTC). NULL for recalls saved before Phase 9: they have no timeline.
    information_received_at: Mapped[datetime | None] = mapped_column(nullable=True)
    decision_at: Mapped[datetime | None] = mapped_column(nullable=True)
    communication_done_at: Mapped[datetime | None] = mapped_column(nullable=True)
    stop_sale_done_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completion_done_at: Mapped[datetime | None] = mapped_column(nullable=True)
