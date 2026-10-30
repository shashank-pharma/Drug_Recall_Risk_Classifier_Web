from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import services
from ..db import get_session
from ..schemas import StatsSummary

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/summary", response_model=StatsSummary)
def summary(session: Session = Depends(get_session)) -> dict:
    return services.stats_summary(session)
