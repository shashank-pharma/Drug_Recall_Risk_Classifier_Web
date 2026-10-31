from fastapi import APIRouter

from drug_recall_risk_classifier import (
    DEFECT_TO_CLASS,
    SOURCE_LEVELS,
    SOURCE_TIMELINES,
    RecallClass,
)

from .. import demo
from ..schemas import DefectTypeOut, RecallRuleOut

router = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/demo")
def demo_status() -> dict:
    """Lets the UI show the demo notice; enabled only with RECALL_DEMO_SEED=1."""
    return {"enabled": demo.enabled(), "max_recalls": demo.MAX_RECALLS}


@router.get("/defect-types", response_model=list[DefectTypeOut])
def defect_types() -> list[DefectTypeOut]:
    return [
        DefectTypeOut(
            defect_type=defect,
            recall_class=cls.label,
            action=cls.action,
            meaning=cls.meaning,
        )
        for defect, cls in sorted(DEFECT_TO_CLASS.items())
    ]


@router.get("/recall-rules", response_model=list[RecallRuleOut])
def recall_rules() -> list[RecallRuleOut]:
    """CDSCO deadlines and recall levels per class."""
    return [
        RecallRuleOut(
            recall_class=cls.label,
            stop_sale_hours=cls.stop_sale.total_seconds() / 3600 if cls.stop_sale else None,
            completion_hours=cls.completion.total_seconds() / 3600,
            recall_levels=list(cls.levels),
            public_announcement=cls.public_announcement,
            source_timelines=SOURCE_TIMELINES,
            source_levels=SOURCE_LEVELS,
        )
        for cls in RecallClass
    ]
