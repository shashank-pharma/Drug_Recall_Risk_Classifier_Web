"""One-off import of the legacy recall_log.txt into SQLite.

Usage (from the repo root):
    .venv/bin/python -m backend.scripts.import_txt_log              # imports recall_log.txt
    .venv/bin/python -m backend.scripts.import_txt_log --dry-run    # only reports
    .venv/bin/python -m backend.scripts.import_txt_log path/to/log.txt

Each record is re-classified with the current rules (the old file has no "meaning").
Records are skipped, never changed, when they are malformed, use an unknown defect
type, or their logged class no longer matches the rules. Re-running is safe:
records already in the database are recognised and not added twice.
"""

import argparse
import sys
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from drug_recall_risk_classifier import UnknownDefectError

from ..app.db import SessionLocal, init_db
from ..app.models import Recall
from ..app.schemas import RecallFields
from ..app.services import classify

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_LOG = REPO_ROOT / "recall_log.txt"

# Labels written by DrugRecall.save_recall() → RecallFields field names.
FIELD_NAMES = {
    "Drug": "drug_name",
    "Batch": "batch_id",
    "Reason": "reason",
    "Defect": "defect_type",
    "Units": "units_affected",
}
REQUIRED_LABELS = {"Date", "Class", *FIELD_NAMES}


@dataclass
class ImportReport:
    imported: list[str] = field(default_factory=list)
    duplicates: list[str] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)


def parse_log(text: str) -> list[tuple[int, dict[str, str]]]:
    """Split the log into records: (line number where the record starts, {label: value})."""
    records = []
    current: dict[str, str] = {}
    start = 1
    for line_no, line in enumerate(text.splitlines(), start=1):
        stripped = line.strip()
        if stripped and set(stripped) == {"-"}:  # record separator
            if current:
                records.append((start, current))
            current = {}
            continue
        if not stripped:
            continue
        if not current:
            start = line_no
        label, sep, value = line.partition(":")
        if sep:
            current[label.strip()] = value.strip()
    if current:  # last record without a trailing separator
        records.append((start, current))
    return records


def _describe(raw: dict[str, str]) -> str:
    return f"{raw.get('Drug', '?')} | {raw.get('Batch', '?')}"


def _existing_keys(session: Session) -> set[tuple]:
    rows = session.execute(
        select(Recall.drug_name, Recall.batch_id, Recall.defect_type, Recall.created_at)
    )
    return {(d, b, t, created.date()) for d, b, t, created in rows}


def import_records(session: Session, text: str, dry_run: bool = False) -> ImportReport:
    report = ImportReport()
    seen = _existing_keys(session)

    for line_no, raw in parse_log(text):
        where = f"line {line_no} ({_describe(raw)})"

        missing = sorted(REQUIRED_LABELS - raw.keys())
        if missing:
            report.skipped.append(f"{where}: missing {', '.join(missing)}")
            continue

        try:
            logged_on = date.fromisoformat(raw["Date"])
        except ValueError:
            report.skipped.append(f"{where}: invalid date '{raw['Date']}'")
            continue

        values = {name: raw[label] for label, name in FIELD_NAMES.items()}
        values["units_affected"] = values["units_affected"].replace(",", "")
        try:
            fields = classify(RecallFields(**values))
        except ValidationError as exc:
            problems = "; ".join(f"{e['loc'][0]}: {e['msg']}" for e in exc.errors())
            report.skipped.append(f"{where}: {problems}")
            continue
        except UnknownDefectError:
            report.skipped.append(f"{where}: unknown defect type '{raw['Defect']}'")
            continue

        if fields["recall_class"] != raw["Class"]:
            report.skipped.append(
                f"{where}: logged as {raw['Class']} but current rules say "
                f"{fields['recall_class']}"
            )
            continue

        key = (fields["drug_name"], fields["batch_id"], fields["defect_type"], logged_on)
        if key in seen:
            report.duplicates.append(where)
            continue
        seen.add(key)

        # The old log only has a date; store it as midnight UTC.
        session.add(Recall(**fields, created_at=datetime.combine(logged_on, datetime.min.time())))
        report.imported.append(where)

    if dry_run:
        session.rollback()
    else:
        session.commit()
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import the legacy recall_log.txt into SQLite.")
    parser.add_argument("path", nargs="?", type=Path, default=DEFAULT_LOG)
    parser.add_argument("--dry-run", action="store_true", help="report only, write nothing")
    args = parser.parse_args(argv)

    if not args.path.is_file():
        print(f"File not found: {args.path}", file=sys.stderr)
        return 1

    init_db()
    with SessionLocal() as session:
        report = import_records(session, args.path.read_text(encoding="utf-8"), args.dry_run)

    verb = "Would import" if args.dry_run else "Imported"
    print(f"{verb} {len(report.imported)} record(s) from {args.path}")
    for item in report.imported:
        print(f"  + {item}")
    if report.duplicates:
        print(f"Already in the database, not added again: {len(report.duplicates)}")
        for item in report.duplicates:
            print(f"  = {item}")
    if report.skipped:
        print(f"Skipped: {len(report.skipped)}")
        for item in report.skipped:
            print(f"  ! {item}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
