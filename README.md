# Drug_Recall_Risk_Classifier

## Overview

The Drug Recall Risk Classifier is a Python-based application designed to automate the classification of pharmaceutical product recalls according to the FDA and CDSCO recall classification framework. The system evaluates product defects, assigns an appropriate recall class, determines the corresponding regulatory action, and maintains records through logging and file storage.

This project demonstrates the application of object-oriented programming principles, exception handling, logging, and file management in a pharmaceutical quality and regulatory context.

---

## Objectives

* Automate drug recall risk classification.
* Assign recall actions based on defect severity.
* Maintain recall records for documentation and audit purposes.
* Handle unknown defect types through custom exception handling.
* Demonstrate the integration of pharmaceutical regulatory concepts with Python programming.

---

## Recall Classification Logic

### Class I

A situation in which exposure to a defective product may cause serious adverse health consequences or death.

**Defect Types**

* contamination
* wrong_drug

**Action**

* Immediate Withdrawal

---

### Class II

A situation in which exposure to a defective product may cause temporary or medically reversible adverse health consequences.

**Defect Types**

* mislabeling
* subpotent

**Action**

* Urgent Recall

---

### Class III

A situation in which exposure to a defective product is not likely to cause adverse health consequences but still requires corrective action.

**Defect Types**

* packaging_defect

**Action**

* Market Withdrawal

---

## Key Features

* Object-Oriented Design
* Automated Recall Classification
* Regulatory Action Recommendation
* Custom Exception Handling
* File-Based Recall Documentation
* Activity Logging
* Batch Recall Processing
* Audit-Friendly Record Keeping

---

## Technologies Used

* Python 3
* Object-Oriented Programming (OOP)
* Custom Exceptions
* Logging Module
* File Handling
* Date and Time Module

---

## Project Structure

### DrugRecall Class

#### Attributes

* drug_name
* batch_id
* reason
* defect_type
* units_affected

#### Methods

**classify()**

* Assigns Class I, II, or III based on defect type.

**recall_action()**

* Determines the required recall action according to the assigned class.

**save_recall()**

* Stores recall information in a text file.

**process()**

* Executes classification, action assignment, output generation, and record storage.

****str**()**

* Returns a readable representation of the recall object.

---

## Exception Handling

### UnknownDefectError

A custom exception raised when the provided defect type is not recognized by the classification system.

Example:

```python
DrugRecall(
    "Amoxicillin 250mg",
    "BT-005",
    "Unknown issue reported",
    "colour_change",
    5000
)
```

The system detects the unsupported defect type, raises an exception, and records the event in the log file.

---

## Logging

System activities are recorded in:

```text
recall_system_log.txt
```

The log file captures:

* Recall classification events
* Processing information
* Unknown defect warnings
* Audit trail records

---

## Recall Record Storage

Processed recalls are stored in:

```text
recall_log.txt
```

Each entry includes:

* Date
* Drug Name
* Batch ID
* Recall Reason
* Defect Type
* Recall Class
* Recall Action
* Units Affected

---

## Web Application

The same classification logic is also available as a web app. The backend imports `drug_recall_risk_classifier.py` directly, so `DEFECT_TO_CLASS` remains the single source of truth: add a defect type there and the API and the UI pick it up.

**Pages**

* **New recall**: entry form with a defect type dropdown, then a result card showing the colour-coded class badge (Class I red, II amber, III blue), the required action and its meaning.
* **History**: every saved recall in a table, with search, class and defect type filters, a date range, sortable columns and pagination. Filters are kept in the URL.
* **Dashboard**: totals, a class distribution chart and a recalls-by-defect-type chart.

An unknown defect type is shown as a friendly message with clickable suggestions instead of an error trace.

**Stack**

* Backend: FastAPI, SQLAlchemy, SQLite (`backend/recalls.db`)
* Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Recharts

**Storage.** The web app stores recalls in SQLite instead of `recall_log.txt`. Warnings for unknown defects still go to `recall_system_log.txt`. The command-line script keeps writing `recall_log.txt` as before.

### Run it

Requires Python 3 and Node.js. Run the backend commands from the repository root.

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/uvicorn backend.app.main:app --reload
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` to the backend on port 8000, and the interactive API docs are at http://127.0.0.1:8000/docs.

To bring the old records from `recall_log.txt` into the database (safe to run more than once; add `--dry-run` to preview):

```bash
.venv/bin/python -m backend.scripts.import_txt_log
```

### Tests and checks

```bash
.venv/bin/pytest
cd frontend && npm run build && npm run lint
```

### API

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/health` | Liveness check |
| GET | `/api/defect-types` | Known defect types with their class and action |
| POST | `/api/recalls/preview` | Classify without saving |
| POST | `/api/recalls` | Classify and save (201) |
| GET | `/api/recalls` | History: `recall_class`, `defect_type`, `q`, `date_from`, `date_to`, `sort`, `page`, `page_size` |
| GET | `/api/recalls/{id}` | One recall |
| GET | `/api/stats/summary` | Counts for the dashboard |

Errors always have the shape `{ "code": "...", "message": "..." }`. An unknown defect type returns `422` with `code: "unknown_defect"` and the list of `known_types`.

### Web app folders

```text
backend/   FastAPI app (app/), tests (tests/), one-off scripts (scripts/)
frontend/  React app (src/pages, src/components, src/lib)
```

---

## Test Scenarios

| Drug Product      | Defect Type      | Expected Classification |
| ----------------- | ---------------- | ----------------------- |
| Metformin 500mg   | contamination    | Class I                 |
| Aspirin 75mg      | mislabeling      | Class II                |
| Insulin 100IU     | wrong_drug       | Class I                 |
| Atorvastatin 10mg | packaging_defect | Class III               |
| Amoxicillin 250mg | colour_change    | UnknownDefectError      |

---

## Sample Output

```text
==================================================

Drug | Metformin 500mg
Batch | BT-001
Reason | Microbial contamination found
Defect | contamination
Class | Class I
Action | Immediate withdrawal
Units | 50,000

==================================================
```

---

## Pharmaceutical Significance

Drug recall management is an essential component of pharmaceutical quality systems and regulatory compliance. This project demonstrates how software solutions can assist in:

* Regulatory Affairs
* Quality Assurance
* Quality Risk Management
* Pharmacovigilance
* Good Manufacturing Practice (GMP) Compliance
* Product Recall Decision-Making

By automating classification and documentation processes, the system provides a simplified representation of how recall assessments can be supported through technology.

---

## Author

**Shashank Limje**

Bachelor of Pharmacy Graduate

Interests: Regulatory Affairs, Quality Systems, Pharmaceutical Compliance, Pharmacovigilance, and Python Programming.
