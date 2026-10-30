"""
Drug Recall Risk Classifier - FDA / CDSCO Class I, II, III system.

Design notes
- Classification rules live in ONE lookup table (DEFECT_TO_CLASS).
- Per-class CDSCO deadlines and recall levels live on RecallClass itself.
- The class is worked out once per recall and then reused (cached).
- Core logic (classify, action, recall_timeline) has no print/file side effects, so a
  web API can import this file safely. The demo runs only when the file is executed.

Timelines and recall levels come only from the CDSCO "Guidelines on Recall and Rapid
Alert System for Drugs (Including Biologicals & Vaccines)", Doc. No. CDSCO/RRAS Ver. 00,
effective 18/07/2024 (docs/regulatory/CDSCO_Recall_Rapid_Alert_Guidelines_2024.pdf).
"""

import logging
from collections import Counter
from dataclasses import dataclass, asdict
from datetime import date, datetime, timedelta
from enum import Enum
from functools import cached_property
from pathlib import Path

LOG_FILE = Path("recall_system_log.txt")
RECALL_FILE = Path("recall_log.txt")

logger = logging.getLogger("recall_system")


class UnknownDefectError(ValueError):
    """Raised when the defect type is not part of the classification rules."""


RULES_SOURCE = "CDSCO/RRAS Ver. 00 (2024)"


class RecallClass(Enum):
    """Per class: label, action, meaning, then the CDSCO rules.

    stop_sale  - stop sale/distribution deadline; None = not set separately (§8.0)
    completion - recall completion deadline, calendar time (§8.0)
    levels     - distribution levels the recall must reach (§7.0)
    public_announcement - Class I needs newspaper/TV/radio notice (§7.0)
    """

    CLASS_I = (
        "Class I",
        "Immediate withdrawal",
        "May cause serious adverse health consequences or death",
        timedelta(hours=24),
        timedelta(hours=72),
        ("wholesale", "retail", "consumer"),
        True,
    )
    CLASS_II = (
        "Class II",
        "Urgent recall",
        "May cause temporary or medically reversible adverse health consequences",
        None,
        timedelta(days=10),
        ("wholesale", "retail"),
        False,
    )
    CLASS_III = (
        "Class III",
        "Market withdrawal",
        "Not likely to cause adverse health consequences",
        None,
        timedelta(days=30),
        ("wholesale",),
        False,
    )

    def __init__(self, label, action, meaning, stop_sale, completion, levels, public_announcement):
        self.label = label
        self.action = action
        self.meaning = meaning
        self.stop_sale = stop_sale
        self.completion = completion
        self.levels = levels
        self.public_announcement = public_announcement


# §9.0: Class I recall decision within 24 h, at most 72 h, of receiving the information;
# for every class, the supply chain is told within 24 h of the decision.
DECISION_WINDOW = timedelta(hours=72)
COMMUNICATION_WINDOW = timedelta(hours=24)
DUE_SOON = timedelta(hours=24)

SOURCE_LEVELS = f"{RULES_SOURCE} §7.0"
SOURCE_TIMELINES = f"{RULES_SOURCE} §8.0"
SOURCE_DECISION = f"{RULES_SOURCE} §9.0"

# Milestones a person can mark done (the decision is recorded as decision_at instead).
MARKABLE_MILESTONES = ("communication", "stop_sale", "completion")


# Single source of truth: add a new defect type here and everything else works.
DEFECT_TO_CLASS = {
    "contamination": RecallClass.CLASS_I,
    "wrong_drug": RecallClass.CLASS_I,
    "mislabeling": RecallClass.CLASS_II,
    "subpotent": RecallClass.CLASS_II,
    "packaging_defect": RecallClass.CLASS_III,
}


@dataclass(frozen=True)
class Milestone:
    key: str
    label: str
    due_at: datetime | None
    done_at: datetime | None
    # done | done_late | overdue | due_soon | on_track | not_specified | waiting
    status: str
    source: str
    note: str = ""


def _status(due_at, done_at, now) -> str:
    if done_at is not None:
        return "done" if done_at <= due_at else "done_late"
    if now > due_at:
        return "overdue"
    if due_at - now <= DUE_SOON:
        return "due_soon"
    return "on_track"


def recall_timeline(
    recall_class: RecallClass,
    information_received_at: datetime,
    decision_at: datetime | None = None,
    done_at: dict[str, datetime | None] | None = None,
    now: datetime | None = None,
) -> list[Milestone]:
    """CDSCO milestones for one recall, with each due time and its status at `now`.

    The clock starts when the information is received (§8.0). Days are calendar days:
    the guideline does not say working days. Pass all datetimes in the same form
    (e.g. all naive UTC) so they compare correctly.
    """
    done_at = done_at or {}
    now = now or datetime.now()
    start = information_received_at
    milestones = []

    if recall_class is RecallClass.CLASS_I:
        due = start + DECISION_WINDOW
        milestones.append(Milestone(
            "decision", "Recall decision", due, decision_at,
            _status(due, decision_at, now), SOURCE_DECISION,
            "Within 24 hours, at most 72 hours, of receiving the information",
        ))

    if decision_at is None:
        milestones.append(Milestone(
            "communication", "Supply chain informed", None, None, "waiting", SOURCE_DECISION,
            "Due 24 hours after the recall decision; no decision recorded yet",
        ))
    else:
        due = decision_at + COMMUNICATION_WINDOW
        done = done_at.get("communication")
        milestones.append(Milestone(
            "communication", "Supply chain informed", due, done,
            _status(due, done, now), SOURCE_DECISION, "Within 24 hours of the recall decision",
        ))

    if recall_class.stop_sale is None:
        milestones.append(Milestone(
            "stop_sale", "Stop sale/distribution", None, None, "not_specified", SOURCE_TIMELINES,
            "Not specified separately for this class in §8.0",
        ))
    else:
        due = start + recall_class.stop_sale
        done = done_at.get("stop_sale")
        milestones.append(Milestone(
            "stop_sale", "Stop sale/distribution", due, done,
            _status(due, done, now), SOURCE_TIMELINES, "Within 24 hours",
        ))

    due = start + recall_class.completion
    done = done_at.get("completion")
    hours = recall_class.completion.total_seconds() / 3600
    window = f"{hours:.0f} hours" if hours < 72.5 else f"{recall_class.completion.days} calendar days"
    milestones.append(Milestone(
        "completion", "Recall completed", due, done,
        _status(due, done, now), SOURCE_TIMELINES, f"Within {window}",
    ))
    return milestones


@dataclass
class DrugRecall:
    drug_name: str
    batch_id: str
    reason: str
    defect_type: str
    units_affected: int

    def __post_init__(self):
        # "Contamination " / "wrong drug" should still match.
        self.defect_type = self.defect_type.strip().lower().replace(" ", "_")
        if not isinstance(self.units_affected, int) or self.units_affected < 0:
            raise ValueError("units_affected must be a non-negative whole number")

    @cached_property
    def recall_class(self) -> RecallClass:
        """Classify once; later calls reuse the stored result."""
        try:
            return DEFECT_TO_CLASS[self.defect_type]
        except KeyError:
            known = ", ".join(sorted(DEFECT_TO_CLASS))
            raise UnknownDefectError(
                f"Unknown defect type '{self.defect_type}'. Known types: {known}"
            ) from None

    def classify(self) -> str:
        return self.recall_class.label

    def recall_action(self) -> str:
        return self.recall_class.action

    def to_dict(self) -> dict:
        """JSON-friendly result (useful for the web API later)."""
        data = asdict(self)
        data.update(
            recall_class=self.recall_class.label,
            action=self.recall_class.action,
            meaning=self.recall_class.meaning,
            date=date.today().isoformat(),
        )
        return data

    def save_recall(self, path: Path = RECALL_FILE) -> None:
        record = self.to_dict()
        lines = [
            f"Date   : {record['date']}",
            f"Drug   : {self.drug_name}",
            f"Batch  : {self.batch_id}",
            f"Reason : {self.reason}",
            f"Defect : {self.defect_type}",
            f"Class  : {record['recall_class']}",
            f"Action : {record['action']}",
            f"Units  : {self.units_affected:,}",
            "-" * 45,
        ]
        with open(path, "a", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")
        logger.info("%s | %s | %s", self.drug_name, self.batch_id, record["recall_class"])

    def print_report(self) -> None:
        print(f"\n{'=' * 50}")
        print(f"{'Drug':<8}| {self.drug_name}")
        print(f"{'Batch':<8}| {self.batch_id}")
        print(f"{'Reason':<8}| {self.reason}")
        print(f"{'Defect':<8}| {self.defect_type}")
        print(f"{'Class':<8}| {self.recall_class.label}")
        print(f"{'Action':<8}| {self.recall_class.action}")
        print(f"{'Units':<8}| {self.units_affected:,}")

    def process(self) -> bool:
        """Classify, print, save. Returns True on success, False on failure."""
        try:
            self.print_report()
            self.save_recall()
            return True
        except UnknownDefectError as e:
            print(f"\n{'=' * 50}\nERROR: {e}")
            logger.warning("%s - %s UNKNOWN DEFECT - %s", self.drug_name, self.batch_id, e)
        except OSError as e:
            print(f"ERROR: could not write recall record ({e})")
            logger.error("%s - %s file write failed - %s", self.drug_name, self.batch_id, e)
        return False

    def __str__(self) -> str:
        return f"{self.drug_name} | {self.batch_id}"


def process_batch(recalls) -> Counter:
    """Process many recalls and return a count per class (plus 'Failed')."""
    summary = Counter()
    for recall in recalls:
        if recall.process():
            summary[recall.recall_class.label] += 1
        else:
            summary["Failed"] += 1
    return summary


def setup_logging() -> None:
    logging.basicConfig(
        filename=LOG_FILE,
        level=logging.INFO,
        format="%(asctime)s - %(levelname)s - %(message)s",
        encoding="utf-8",
    )


def main() -> None:
    setup_logging()
    recalls = [
        DrugRecall("Metformin 500mg", "BT-001", "Microbial contamination found", "contamination", 50000),
        DrugRecall("Aspirin 75mg", "BT-002", "Dosage label incorrect", "mislabeling", 25000),
        DrugRecall("Insulin 100IU", "BT-003", "Wrong drug in packaging", "wrong_drug", 10000),
        DrugRecall("Atorvastatin 10mg", "BT-004", "Blister pack seal broken", "packaging_defect", 15000),
        DrugRecall("Amoxicillin 250mg", "BT-005", "Unknown issue reported", "colour_change", 5000),
    ]
    summary = process_batch(recalls)
    print(f"\n{'=' * 50}\nSUMMARY: {dict(summary)}")


if __name__ == "__main__":
    main()
