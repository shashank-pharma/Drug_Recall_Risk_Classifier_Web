from datetime import datetime

from sqlalchemy import select

from backend.app.models import Recall
from backend.scripts.import_txt_log import DEFAULT_LOG, import_records, main, parse_log

SEP = "-" * 45


def record(**overrides) -> str:
    values = {
        "Date": "2026-06-08",
        "Drug": "Metformin 500mg",
        "Batch": "BT-001",
        "Reason": "Microbial contamination found",
        "Defect": "contamination",
        "Class": "Class I",
        "Action": "Immediate withdrawal",
        "Units": "50,000",
        **overrides,
    }
    lines = [f"{label:<7}: {value}" for label, value in values.items() if value is not None]
    return "\n".join(lines) + f"\n{SEP}\n"


def all_rows(db) -> list[Recall]:
    return list(db.scalars(select(Recall).order_by(Recall.id)))


# --- the real legacy file ---------------------------------------------------

def test_imports_real_recall_log(client, db):
    report = import_records(db, DEFAULT_LOG.read_text(encoding="utf-8"))

    assert len(report.imported) == 4
    assert report.skipped == [] and report.duplicates == []

    rows = all_rows(db)
    assert [r.batch_id for r in rows] == ["BT-001", "BT-002", "BT-003", "BT-004"]
    aspirin = rows[1]
    assert aspirin.drug_name == "Aspirin 75mg"
    assert aspirin.recall_class == "Class II"
    assert aspirin.action == "Urgent recall"  # the file has a stray leading space here
    assert aspirin.meaning.startswith("May cause temporary")
    assert aspirin.units_affected == 25000
    assert aspirin.created_at == datetime(2026, 6, 8)


def test_imported_records_show_in_history_and_stats(client, db):
    import_records(db, DEFAULT_LOG.read_text(encoding="utf-8"))

    assert client.get("/api/recalls").json()["total"] == 4
    by_class = client.get("/api/stats/summary").json()["by_class"]
    assert [c["count"] for c in by_class] == [2, 1, 1]


def test_rerun_does_not_duplicate(client, db):
    text = DEFAULT_LOG.read_text(encoding="utf-8")
    import_records(db, text)
    report = import_records(db, text)

    assert report.imported == []
    assert len(report.duplicates) == 4
    assert len(all_rows(db)) == 4


def test_dry_run_writes_nothing(client, db):
    report = import_records(db, DEFAULT_LOG.read_text(encoding="utf-8"), dry_run=True)

    assert len(report.imported) == 4
    assert all_rows(db) == []


# --- parsing ----------------------------------------------------------------

def test_last_record_without_separator_and_colon_in_reason():
    text = record() + record(Batch="BT-009", Reason="Seal: broken").removesuffix(f"{SEP}\n")
    records = parse_log(text)

    assert [line for line, _ in records] == [1, 10]
    assert records[1][1]["Batch"] == "BT-009"
    assert records[1][1]["Reason"] == "Seal: broken"


def test_duplicate_inside_one_file_is_added_once(client, db):
    report = import_records(db, record() + record())
    assert len(report.imported) == 1
    assert report.duplicates == ["line 10 (Metformin 500mg | BT-001)"]


def test_same_batch_on_another_date_is_not_a_duplicate(client, db):
    report = import_records(db, record() + record(Date="2026-06-09"))
    assert len(report.imported) == 2


# --- skipped records --------------------------------------------------------

def test_bad_records_are_skipped_good_ones_imported(client, db):
    text = (
        record(Batch="OK-1")
        + record(Batch="BAD-1", Defect="colour_change", Class="Class II")
        + record(Batch="BAD-2", Defect="packaging_defect", Class="Class I")
        + record(Batch="BAD-3", Units="lots")
        + record(Batch="BAD-4", Date="08/06/2026")
        + record(Batch="BAD-5", Reason=None)
    )
    report = import_records(db, text)

    assert [r.batch_id for r in all_rows(db)] == ["OK-1"]
    assert len(report.imported) == 1
    assert report.skipped == [
        "line 10 (Metformin 500mg | BAD-1): unknown defect type 'colour_change'",
        "line 19 (Metformin 500mg | BAD-2): logged as Class I but current rules say Class III",
        "line 28 (Metformin 500mg | BAD-3): units_affected: "
        "Input should be a valid integer, unable to parse string as an integer",
        "line 37 (Metformin 500mg | BAD-4): invalid date '08/06/2026'",
        "line 46 (Metformin 500mg | BAD-5): missing Reason",
    ]


# --- command line -----------------------------------------------------------

def test_cli_imports_file(client, db, tmp_path, capsys):
    log = tmp_path / "log.txt"
    log.write_text(record() + record(Batch="BAD", Defect="rust"), encoding="utf-8")

    assert main([str(log)]) == 0

    out = capsys.readouterr().out
    assert "Imported 1 record(s)" in out
    assert "+ line 1 (Metformin 500mg | BT-001)" in out
    assert "Skipped: 1" in out
    assert len(all_rows(db)) == 1


def test_cli_dry_run(client, db, tmp_path, capsys):
    log = tmp_path / "log.txt"
    log.write_text(record(), encoding="utf-8")

    assert main([str(log), "--dry-run"]) == 0
    assert "Would import 1 record(s)" in capsys.readouterr().out
    assert all_rows(db) == []


def test_cli_missing_file(tmp_path, capsys):
    assert main([str(tmp_path / "nope.txt")]) == 1
    assert "File not found" in capsys.readouterr().err
