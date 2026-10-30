from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import services
from ..db import get_session
from ..schemas import (
    DecisionUpdate,
    MilestoneUpdate,
    RecallIn,
    RecallOut,
    RecallPage,
    RecallPreview,
    RecallQuery,
    utc_now,
)

router = APIRouter(prefix="/recalls", tags=["recalls"])


def _not_found(recall_id: int) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Recall {recall_id} was not found.")


@router.post("/preview", response_model=RecallPreview)
def preview_recall(data: RecallIn) -> dict:
    """Classify without saving (used for the live preview in the form)."""
    return services.preview(data)


@router.post("", response_model=RecallOut, status_code=status.HTTP_201_CREATED)
def create_recall(data: RecallIn, session: Session = Depends(get_session)) -> dict:
    return services.recall_out(services.create_recall(session, data))


@router.get("", response_model=RecallPage)
def list_recalls(
    params: Annotated[RecallQuery, Query()], session: Session = Depends(get_session)
) -> dict:
    items, total = services.list_recalls(session, params)
    now = utc_now()
    return {
        "items": [services.recall_out(row, now) for row in items],
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
    }


@router.get("/{recall_id}", response_model=RecallOut)
def get_recall(recall_id: int, session: Session = Depends(get_session)) -> dict:
    recall = services.get_recall(session, recall_id)
    if recall is None:
        raise _not_found(recall_id)
    return services.recall_out(recall)


@router.patch("/{recall_id}", response_model=RecallOut)
def update_decision(recall_id: int, data: DecisionUpdate, session: Session = Depends(get_session)) -> dict:
    """Record (or clear) when the recall decision was made (CDSCO §9.0)."""
    recall = services.set_decision(session, recall_id, data.decision_at)
    if recall is None:
        raise _not_found(recall_id)
    return services.recall_out(recall)


@router.patch("/{recall_id}/milestones/{key}", response_model=RecallOut)
def update_milestone(
    recall_id: int,
    key: Literal["communication", "stop_sale", "completion"],
    data: MilestoneUpdate,
    session: Session = Depends(get_session),
) -> dict:
    """Mark a milestone done (default: now) or not done."""
    recall = services.set_milestone(session, recall_id, key, data)
    if recall is None:
        raise _not_found(recall_id)
    return services.recall_out(recall)
