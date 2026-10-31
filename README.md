# Drug_Recall_Risk_Classifier

> **Disclaimer: educational project, not a regulatory tool.**
> This project was built for learning and demonstration. Do not use it to classify real recalls or to make regulatory, quality or patient-safety decisions.
>
> * Real FDA and CDSCO recall classification comes from a **health hazard evaluation** of the specific product and situation (see FDA 21 CFR 7.41; the CDSCO guideline asks for classification "based on the risk assessment", §9.0). That evaluation is done by qualified people and the regulator. This project instead maps a defect type to a class through a fixed lookup table.
> * The defect-type-to-class mapping in `DEFECT_TO_CLASS` is a simplified example. It is not taken from any FDA or CDSCO document.
> * The CDSCO deadlines and recall levels come from the 2024 guideline in `docs/regulatory/`. They may be revised, so always check the current official text.
> * All recall records in this repository (`recall_log.txt`, the demo script) are made-up sample data.

## Overview

Drug Recall Risk Classifier is a web app (FastAPI backend, React frontend) that works out a drug recall's class (I, II or III) from its defect type. For each recall it also shows the deadlines and recall levels set by the CDSCO 2024 recall guideline. All the rules live in one Python script, `drug_recall_risk_classifier.py`, which still runs on its own as a command-line demo of object-oriented design, custom exceptions, logging and file handling.

**Features**

* Recall entry form with a defect type dropdown and clear error messages; the result card shows a colour-coded class badge, the required action and the CDSCO timeline
* CDSCO timeline for each recall: due dates for stop sale, recall completion, the recall decision and supply-chain communication, with countdown rings and an overdue status
* Recall Explorer as a tree flow: All recalls → class → defect type → recalls, with fixed-size cards and thin connecting lines. Select a node to highlight its route; select a recall to open a detail panel with the CDSCO steps as a process flow. Size by recalls or units; a List view for small screens and screen readers
* Dashboard with linked charts: class donut, defect-type columns, a recalls-over-time chart (7, 30 or 90 days) and a recent-recalls table. Clicking a class or a defect type filters the whole page; clicking it again clears it. Changes against the previous 30 days are shown only when there is earlier data
* KPI strip under the header with total, overdue and Class I recalls on every page
* History table with search, filters, a date-range slider, sorting and pagination; click a row to open its details in a side panel
* Search from anywhere with ⌘K / Ctrl+K: find a recall by drug name or batch ID (it opens in the Explorer), or jump to a page
* "What if" slider (History and the recall panel): shows CDSCO statuses as they would be up to 72 hours from now. It only changes what is shown; nothing is saved, and saving or marking milestones is paused while it is on
* Calm palettes (Lagoon, Lavender Dusk, Sage Calm) from the dots in the header, frosted cards and panels, and a light theme by default with a deep-navy dark theme; the choices are remembered in the browser
* Motion setting in the header: Auto (follows your system's reduce-motion setting), Full or Reduced
* "Load sample data" button on an empty database, for trying the app out (only when the server is started with the sample-data switch; see [Run it](#run-it))
* 265 automated tests: 142 backend tests (pytest) for the rules, timelines, API and database upgrade, and 123 frontend tests (`npm test`) for layout, contrast, preferences and other logic

**Where the rules come from:** the defect-type-to-class table is a simplified example, not taken from any FDA or CDSCO document. The deadlines and recall levels are taken from the CDSCO 2024 guideline PDF in `docs/regulatory/` (§7.0, §8.0 and §9.0).

To set it up, see [Run it](#run-it).

---

## Live demo

**Link:** `https://<your-service>.onrender.com` _(placeholder: replace after the first deploy)_

- Hosted on Render's free plan. After 15 minutes without visitors the service sleeps, so **the first load can take about a minute**.
- It is a demo: it starts with 5 example recalls (dates relative to the server start), holds at most 50 recalls, and **the data can reset** whenever the server restarts or redeploys.
- One service serves both the API (`/api`) and the built frontend, so there is no CORS setup. The `render.yaml` Blueprint has the build and start commands.
- Demo mode is switched on by `RECALL_DEMO_SEED=1` (no secrets are needed). Without it, nothing changes locally: no seed, no cap, no notice.

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

* **New recall**: entry form with a defect type dropdown and the time the recall information was received, then a result card showing the colour-coded class badge (Class I red, II amber, III blue), the required action, its meaning and the CDSCO timeline.
* **Recall detail** (`/recalls/:id`): the same card for any saved recall, where timeline milestones can be marked done.
* **History**: every saved recall in a table, with search, class and defect type filters, a date range (date fields or a slider), an "Overdue only" filter, sortable columns and pagination. Clicking a row opens the recall in a side panel. Filters and the open panel are kept in the URL.
* **Explorer** (`/explorer`): all recalls → class → defect type → recalls as a tree flow. Select a node to highlight its route and narrow the recall column; select a recall to open it in a side panel with the CDSCO process flow. Size by recalls or units, switch between Flow and List, and use the keyboard (Tab, arrow keys, Enter, Esc). Below 900 px wide it shows the List view.
* **Dashboard**: totals with changes over the last 30 days, overdue recalls, a class donut, a defect-type chart, recalls over time and the latest recalls. The charts filter each other.

An unknown defect type is shown as a friendly message with clickable suggestions instead of an error trace.

**CDSCO timelines and recall levels**

Deadlines and recall levels come only from the CDSCO *Guidelines on Recall and Rapid Alert System for Drugs (Including Biologicals & Vaccines)*, Doc. No. CDSCO/RRAS Ver. 00, effective 18/07/2024 (`docs/regulatory/CDSCO_Recall_Rapid_Alert_Guidelines_2024.pdf`). They live on `RecallClass` in `drug_recall_risk_classifier.py`.

| Class | Stop sale/distribution | Recall completed | Recall up to | Source |
| ----- | ---------------------- | ---------------- | ------------ | ------ |
| I | 24 hours | 72 hours | Wholesale, retail, consumer + public announcement | §8.0, §7.0 |
| II | Not specified separately | 10 days | Wholesale, retail | §8.0, §7.0 |
| III | Not specified separately | 30 days | Wholesale | §8.0, §7.0 |

* The clock starts when the recall information is received (§8.0).
* Class I: the recall decision is due within 72 hours of receiving the information; for every class, the supply chain is informed within 24 hours of the decision (§9.0).
* Days are counted as calendar days; the guideline does not say whether it means working days.
* A milestone is **overdue** when its deadline has passed and it has not been marked done. Statuses are worked out from the current time on every request.
* Recalls saved before these timelines were added have no information-received time, so they show recall levels but no timeline.

**Stack**

* Backend: FastAPI, SQLAlchemy, SQLite (`backend/recalls.db`)
* Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Recharts

**Storage.** The web app stores recalls in SQLite instead of `recall_log.txt`. Warnings for unknown defects still go to `recall_system_log.txt`. The command-line script keeps writing `recall_log.txt` as before.

### Run it

Requires Python 3.11+ and Node.js 22.18+ (the app itself runs on Node 20.19+, but `npm test` runs the TypeScript tests directly in Node, which needs 22.18+). Run the backend commands from the repository root. The commands are for macOS and Linux; on Windows, use `.venv\Scripts\` instead of `.venv/bin/`. On first start the backend creates an empty `backend/recalls.db`.

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

To try the app with example data, start the backend on an empty database with the sample-data switch on. The Dashboard and History then offer "Load sample data", which adds 12 example recalls (batches `SAMPLE-001` to `SAMPLE-012`). Use a separate database file so examples never mix with real recalls:

```bash
RECALL_ENABLE_SAMPLE_DATA=1 RECALL_DB_URL=sqlite:///demo.db .venv/bin/uvicorn backend.app.main:app --reload
```

### Tests and checks

From the repository root:

```bash
.venv/bin/pytest
```

From `frontend/`:

```bash
npm test
```

```bash
npm run build
```

```bash
npm run lint
```

### API

| Method | Path | Purpose |
| ------ | ---- | ------- |
| GET | `/api/health` | Liveness check |
| GET | `/api/defect-types` | Known defect types with their class and action |
| POST | `/api/recalls/preview` | Classify without saving |
| POST | `/api/recalls` | Classify and save (201) |
| GET | `/api/recalls` | History: `recall_class`, `defect_type`, `q`, `date_from`, `date_to`, `status=overdue`, `sort`, `page`, `page_size`, `at` |
| GET | `/api/recalls/{id}` | One recall, with its recall levels and CDSCO timeline (`at` optional) |
| PATCH | `/api/recalls/{id}` | Record or clear the recall decision time: `{ "decision_at": "..." }` |
| PATCH | `/api/recalls/{id}/milestones/{communication\|stop_sale\|completion}` | Mark a milestone done or not done: `{ "done": true, "done_at": "..." }` (`done_at` defaults to now) |
| GET | `/api/recall-rules` | CDSCO deadlines and recall levels per class |
| GET | `/api/stats/summary` | Counts for the dashboard, including `overdue`, and the first and last `created_at`. Optional `recall_class`, `defect_type`, `at` |
| GET | `/api/sample-data` | `{enabled, available}`: whether "Load sample data" can be offered |
| POST | `/api/sample-data` | Add the example recalls (201). 404 unless `RECALL_ENABLE_SAMPLE_DATA=1`; 409 `conflict` if the database already has recalls |
| GET | `/api/stats/trend?days=7\|30\|90` | Recalls per UTC day for the window (zero-filled, by class), plus totals for this window and the one before. Optional `recall_class`, `defect_type` |

`POST /api/recalls` needs `information_received_at` (ISO date-time, not in the future); `decision_at` is optional.

`at` (ISO date-time, between now and 72 hours from now) works out timeline statuses and the overdue filter or count at that time instead of now. Read-only: nothing is stored. Outside that window → 422.

Dashboard filters on `/api/stats/summary` work like linked charts: the totals use both filters, `by_class` ignores the class filter and `by_defect` ignores the defect filter, so each chart still shows the choices it filters by.

Errors always have the shape `{ "code": "...", "message": "..." }`. An unknown defect type returns `422` with `code: "unknown_defect"` and the list of `known_types`. A timeline change that breaks the rules (for example marking a Class II stop sale as done) returns `422` with `code: "timeline_error"`.

**Database upgrade.** On startup the backend adds any missing columns to an existing `backend/recalls.db`; existing records are kept.

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

---

## License

[MIT](LICENSE) © 2026 Shashank Limje
