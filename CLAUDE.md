# Drug Recall Risk Classifier – Web App

## Source of truth
- Classification rules: `drug_recall_risk_classifier.py` → `DEFECT_TO_CLASS`.
  Add a new defect type only there; the API and the UI pick it up automatically.
- CDSCO deadlines and recall levels: fields on `RecallClass` (+ `DECISION_WINDOW`, `COMMUNICATION_WINDOW`)
  and `recall_timeline()` in the same file. Every number must come from
  `docs/regulatory/CDSCO_Recall_Rapid_Alert_Guidelines_2024.pdf` with its section (§7.0 levels, §8.0
  timelines, §9.0 decision/communication). Don't add rules that aren't in that PDF; ask first.
- Keep that file free of print/file side effects in its core logic — the API imports it.
- The web app stores recalls in SQLite, not `recall_log.txt` (`save_recall()` is unused by the API).

## Stack
- Backend: FastAPI + SQLAlchemy 2 + SQLite (`backend/recalls.db`, gitignored;
  override with the `RECALL_DB_URL` env var)
- Frontend (`frontend/`): React 19 + Vite + TypeScript + Tailwind v4 + shadcn/ui (radix-nova)
  + React Router + TanStack Query (+ Recharts later)

## Commands (run from the repo root)
- Setup: `python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt`
- Backend dev: `.venv/bin/uvicorn backend.app.main:app --reload`
  Run it from the repo root: the classifier is imported from there and
  `recall_system_log.txt` is written relative to the working directory.
- Backend tests: `.venv/bin/pytest`
- Import legacy `recall_log.txt` into SQLite (safe to re-run; `--dry-run` to preview):
  `.venv/bin/python -m backend.scripts.import_txt_log`
- Node is not on the system PATH; it lives in `~/.local/node`. Prefix frontend commands with
  `export PATH="$HOME/.local/node/bin:$PATH";`
- Frontend dev: `cd frontend && npm run dev` (http://localhost:5173; `/api` is proxied to :8000)
- Frontend build + typecheck: `cd frontend && npm run build`; lint: `npm run lint`
- Frontend unit tests: `cd frontend && npm test` (`node --test`, no test library; needs Node 22.18+ for
  TypeScript). Keep tested logic in plain modules under `src/lib/` that import each other with `./x.ts`.
- `.claude/launch.json` has `backend` and `frontend` configs for the in-app preview.
  The `backend` config uses the REAL `backend/recalls.db` and `recall_system_log.txt`. When testing
  the form in the preview, use `backend-scratch` instead (copy of the DB + its own log folder;
  copy `backend/recalls.db` to its `preview.db` first) so test recalls don't land in real data.

## Conventions
- All user-facing text (UI + API) is English.
- All endpoints live under `/api`; error bodies are `{code, message, ...}`.
- `UnknownDefectError` → 422 `code: "unknown_defect"` with `defect_type` and `known_types`.
- `TimelineError` (services) → 422 `code: "timeline_error"`.
- Timeline datetimes are stored and returned as naive UTC (like `created_at`); `schemas.utc_naive()` converts input.
  Milestone statuses are computed per request (`services.recall_out`), never stored. Days are calendar days.
- New nullable columns on an existing DB are added at startup by `db.add_missing_columns()`; a new
  required column needs a real migration.
- Request validation errors → 422 `code: "validation_error"` with per-field `errors`.
- Other HTTP errors → `{code: "not_found" | "method_not_allowed" | "http_error", message}`.
- `created_at` is stored as UTC without a timezone suffix; history `date_from`/`date_to`
  are inclusive UTC dates. `/api/stats/summary` zero-fills every class and known defect type.
- Unknown defects on `POST /api/recalls` are logged as WARNING to `recall_system_log.txt`
  (`setup_logging()` runs at startup); `/preview` does not log.
- No DELETE endpoint for recalls (deliberately left out for now).
- Recall class colours: I = red, II = amber, III = sky (frontend `src/lib/recallClass.ts`).
- Frontend: all API calls go through `src/lib/api.ts` (throws `ApiError` with the backend's
  `{code, message}` body); types in `src/lib/types.ts` mirror `backend/app/schemas.py`.
  Parse `created_at` with `parseUtc()` from `src/lib/format.ts`.
- History filters, sort and page live in the URL query string (`?class=&defect=&q=&from=&to=&sort=&page=&status=`);
  `?recall=ID` opens the detail panel (`RecallDetailSheet`), so Back closes it. Cmd/Ctrl+K is `CommandMenu`
  (server search via `listRecalls`, no AI).
  dates are UTC. Charts use Recharts via shadcn `chart`; class colours come from `classStyle().chart`
  (hex, not Tailwind variables).
- shadcn components: add with `npx shadcn@latest add <name>`; don't hand-edit `src/components/ui`.
  shadcn now uses the `cn` package (from shadcn-ui) instead of clsx + tailwind-merge.

## Motion
- Light, formal UI. Animate only to show a change the user caused, plus one load sequence (Dashboard).
- Durations (tokens in `src/index.css`): 150 ms hover/press, 200 ms fade, 250–300 ms panel/expand;
  charts and count-up ≤ 500 ms (hard max 600 ms). Ease-out (`--ease-out`).
- Animate `transform`/`opacity` only (progress bars use `scaleX`, not width).
- No bounce, spin, glow, particles, parallax or looping animation (so no `animate-pulse` skeletons; use
  `components/Skeleton.tsx`). No animation library: tw-animate-css, Radix `data-state`, CSS transitions,
  SVG `stroke-dashoffset`.
- `prefers-reduced-motion` is honoured globally in `index.css`; JS motion checks `usePrefersReducedMotion()`
  (`src/lib/motion.ts`) and Recharts gets `isAnimationActive={!reducedMotion}`.
- Stagger with the `enter-fade` utility and `--stagger` 0–5 (40 ms apart), first load only.
- Colour never carries meaning alone: status pills and progress bars always have text. Visible focus everywhere.
