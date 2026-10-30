from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import AfterValidator
from sqlalchemy.orm import Session

from .. import services
from ..db import get_session
from ..schemas import StatsSummary, TrendOut

router = APIRouter(prefix="/stats", tags=["stats"])

TREND_WINDOWS = (7, 30, 90)


def _trend_window(days: int) -> int:
    # Query strings arrive as text, so Literal[7, 30, 90] would reject "7"; check the int instead.
    if days not in TREND_WINDOWS:
        raise ValueError("Use 7, 30 or 90.")
    return days


@router.get("/summary", response_model=StatsSummary)
def summary(session: Session = Depends(get_session)) -> dict:
    return services.stats_summary(session)


@router.get("/trend", response_model=TrendOut)
def trend(
    days: Annotated[int, Query(description="Window length in days: 7, 30 or 90"), AfterValidator(_trend_window)] = 30,
    session: Session = Depends(get_session),
) -> dict:
    return services.stats_trend(session, days)
