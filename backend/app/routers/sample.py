import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import services
from ..db import get_session
from ..schemas import SampleDataOut, SampleDataStatus

router = APIRouter(prefix="/sample-data", tags=["sample data"])

# Off unless the server is started with RECALL_ENABLE_SAMPLE_DATA=1, so real data never gets examples by accident.
FLAG = "RECALL_ENABLE_SAMPLE_DATA"


def enabled() -> bool:
    return os.environ.get(FLAG) == "1"


@router.get("", response_model=SampleDataStatus)
def sample_status(session: Session = Depends(get_session)) -> dict:
    """Whether the "Load sample data" button should be offered (flag on and no recalls yet)."""
    on = enabled()
    return {"enabled": on, "available": on and services.recall_count(session) == 0}


@router.post("", response_model=SampleDataOut, status_code=status.HTTP_201_CREATED)
def load_sample_data(session: Session = Depends(get_session)) -> dict:
    if not enabled():
        raise HTTPException(status_code=404, detail="Not found.")
    if services.recall_count(session) > 0:
        raise HTTPException(
            status_code=409, detail="Sample data can only be loaded into an empty database."
        )
    return {"created": services.load_sample_data(session)}
