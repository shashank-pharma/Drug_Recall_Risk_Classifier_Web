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
- Other HTTP errors → `{code: "not_found" | "method_not_allowed" | "conflict" | "http_error", message}`.
- Sample data (`routers/sample.py`, `services.load_sample_data`): only with `RECALL_ENABLE_SAMPLE_DATA=1` (else 404)
  and only into an empty database (else 409). Never set the flag for the real `backend/recalls.db`.
  `.claude/launch.json` has `backend-sample` (empty scratch DB with the flag) for the preview.
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
- Explorer (`/explorer`): tree model, grid layout and keyboard rules live in `src/lib/explorerTree.ts`
  (unit-tested: `pathTo` for the breadcrumb and highlighted path, `revealIds`, `visibleDescendants`, empty/error
  nodes); DOM order is depth-first (`role="tree"`, roving tabindex), columns come from CSS grid from 900px
  (`min-[900px]:`; below that the stacked list, no connectors), and `components/explorer/Connectors.tsx` measures
  nodes (ResizeObserver) to draw SVG lines; the chosen path is redrawn in the indigo→violet gradient. Children fly out
  of their parent and back on collapse with the Web Animations API (`el.animate`, 250 ms, 50 ms stagger), only on the
  wide layout and never with reduced motion. Class colours only on class nodes; defect types use neutral tints.
  `?recall=ID` (Cmd+K goes here) opens the recall's class and defect type, selects it and opens the detail panel.
  Recalls load per open defect type (50 max, then a link to History).
- Explorer tree flow (Phases 13I/13J, `components/explorer/FlowView.tsx`, default view from 900px; List = the tree above):
  - Layout lives in `lib/flowLayout.ts` (pure, tested): fixed card size per column (`NODE_H`), leaf rows `ROW` (68 px)
    apart sorted class → defect type → newest, each parent centred on its children, root centred on the classes, no
    overlap within a column, max 8 per column + "+N more". Size by Recalls/Units changes numbers and the class share
    bar only, never card sizes.
  - Links: thin (1.5 px) curves in `--border-strong` (per palette, ≥ 3:1 on cards, tested), from a parent's right-edge
    centre to a child's left-edge centre. No ribbons, no coloured links. Class colours only in the class badge and
    its share bar; everything else neutral palette tokens. Column labels only (no root label, no card title).
  - Selected route: 2.5 px indigo→violet links with 2 dots per link (3 s loop, SMIL, paused when hidden/off screen);
    nodes and links off the route at 35%. Hover shows the same, lighter (55%). Reduced motion: no dots, no draw-in.
  - Load: links draw column by column (80 ms apart, ≤ 600 ms); nodes fade in with fill-mode backwards so the inline
    opacity can dim them later. Nodes are positioned with left/top (the fade-in owns transform).
  - Selecting a class or defect type narrows the recall column; `?recall=ID` (Cmd+K) selects that recall's route. The
    detail panel shows `ProcessFlow` (CDSCO steps from the existing timeline and its § references, no new rules).
  dates are UTC. Charts use Recharts via shadcn `chart`; class colours come from `classStyle().chart`
  (hex, not Tailwind variables).
- shadcn components: add with `npx shadcn@latest add <name>`; don't hand-edit `src/components/ui`.
  shadcn now uses the `cn` package (from shadcn-ui) instead of clsx + tailwind-merge.

## Design tokens
- Colours, radius, shadow and spacing live as CSS variables in `src/index.css` (`:root`); code that needs hex values
  (charts, SVG) imports `src/lib/tokens.ts`. `tokens.test.ts` checks the two match and that text pairs reach 4.5:1.
- Class colours (`--class-1/2/3`) are only for risk; neutral series use indigo/violet/teal tints. Class III badges
  use #0369A1 for text contrast. Muted text on the page background or muted chips uses `text-muted-strong`.
- Dark theme: the `.dark` block in `index.css` (deep navy, mirrored by `DARK` in `tokens.ts`, contrast-tested). Light is
  the default; `ThemeToggle` stores the choice (`lib/theme.ts`, key `recall-theme`) and an inline script in
  `index.html` applies it before the first paint. SVG/chart surfaces use CSS variables (`var(--card)`, `var(--border)`,
  `var(--chart-1)` for the indigo line), not `PALETTE` hex, so they follow the theme. Hard-coded Tailwind tints
  (red-50, indigo-50…) need a `dark:` partner. No glow or neon in dark mode.
- Calm palettes (Phase 13H): Lagoon (default), Lavender Dusk, Sage Calm in `PALETTES` (`tokens.ts`) and
  `--bg-*`/`--blob-*`/`--accent-ring` per `<html data-palette>` in `index.css` (registered with `@property`, so
  palette and theme changes cross-fade in 500 ms). `PaletteSwitcher` (header dots) stores the choice
  (`lib/palette.ts`, key `recall-palette`); the inline script in `index.html` applies it before first paint.
  Light text #1B2440, muted #3B4663; error text red-700 (#B91C1C).
- Aurora background (`components/AmbientBackground.tsx`, "Aurora background" in `index.css`): the palette gradient
  behind the app, a tint per page area that cross-fades in 350 ms (`--zone-*`, from `lib/zone.ts`; New
  recall lavender, History sky, Explorer mint, Dashboard peach-lavender) and a background-only tint while exactly one
  class is chosen (`--tint-class-*`). Values mirror `MESH`, `ZONES`, `CLASS_TINTS` in `tokens.ts`; `background.test.ts`
  checks contrast on every tint. Class colours are never reused as pastels.
- Frosted surfaces: white 55% (`--frost`, navy in dark) + 14–16 px backdrop blur + 1 px light border, only on large
  surfaces: header (`.frost-bar`), cards, the detail panel and dialogs. KPI cards mix 35% of
  `tint-lavender|sky|rose|mint` in. Class badges have a 2 px white ring. `SurfaceEffects` adds the card spotlight
  and scroll reveal. Card top line is indigo→violet; `line-risk` makes it red (Class I
  card only; amber stays for Class II). Small class/status dots carry a darker `MARK_EDGE` outline (amber alone is ~2:1).
- Primary buttons get the brand gradient and the lift/press via `[data-slot=button][data-variant]` rules in
  `index.css`; white surfaces use `bg-card` (`bg-background` is the grey page canvas).

## Charts
- Dashboard charts live in `src/components/charts/`: `ClassDonut` (own SVG, class colours), `DefectBars`
  (Recharts, neutral indigo/violet gradient, class shown as a dot), `TrendChart` (Recharts area + class lines
  with dash patterns, 7d/30d/90d `PillTabs`). Tooltips use `ChartTooltipBubble`.
- Each chart has an sr-only data table; bars are keyboard-navigable (←/→/Home/End) with a live summary.
- Linked filters: Dashboard clicks set `?class=`/`?defect=` (`lib/linkedFilter.ts`); same item again clears it.
  `/api/stats/summary` cross-filters (totals use both; `by_class` ignores the class filter, `by_defect` the defect filter).
- Delta badges (`lib/delta.ts`): colour by good/bad, not by arrow; more recalls/units/Class I is bad. No badge
  when the previous window has no data. Overdue never gets a delta (no history).

## Simulation ("what if" time)
- `SimulationProvider` keeps hours ahead of now (0–72, memory only; a reload goes back to now). Read requests send
  `?at=` (`useSimulation().at()`, worked out per request); query keys include `sim.hours`. The server rejects times
  outside now..now+72 h (`schemas.SimulationTime`) and never writes during a read.
- While active: `SimulationBanner` under the header, and Classify / Mark done / Record decision are disabled.
- Status lights: `StatusLed` + `lib/statusLed.ts` (green done, amber open, red overdue, grey no deadline), always with
  text. Milestones show a `CountdownRing` (`lib/ring.ts`) instead of a progress bar.
- Class filters use `TactileKeys` (`aria-pressed`, All clears). `ClassBadge explain` adds a Radix tooltip (hover and
  keyboard focus) with the class meaning, action and CDSCO deadlines; the result card says the same in full.

## Motion
- Light, formal UI. Animate only to show a change the user caused, plus one load sequence (Dashboard).
- Durations (tokens in `src/index.css`): 150 ms hover/press, 200 ms fade, 250–300 ms panel/expand;
  charts and count-up ≤ 500 ms (hard max 600 ms). Ease-out (`--ease-out`).
- Animate `transform`/`opacity` only (progress bars use `scaleX`, not width; rings use `stroke-dashoffset`).
- Backdrop blur only on the large frosted surfaces above, never on small items. Sheet and Dialog overlays are only
  dimmed (override in `index.css` via `data-slot`, not in `components/ui`).
- Three exceptions to "no loops": a spinner inside a button while its own request is running (e.g. "Classifying…";
  reduced motion makes it static), the aurora blobs (25–35 s drift + mouse parallax ≤ 20 px, background only,
  paused while the tab is hidden, off with reduced motion), and the overdue status light (2 s breathing). Never
  loop anything else on content.
- No bounce, spin, glow, particles, parallax or looping animation (so no `animate-pulse` skeletons; use
  `components/Skeleton.tsx`). No animation library: tw-animate-css, Radix `data-state`, CSS transitions,
  SVG `stroke-dashoffset`.
- Motion setting (header menu, `lib/motionPref.ts`, key `recall-motion`): Auto follows the OS reduce-motion setting,
  Full and Reduced override it. The result is `<html data-motion="full|reduced">`; `index.css` switches motion off
  with `html[data-motion="reduced"]` (never the bare OS media query) and JS reads `usePrefersReducedMotion()`
  (`src/lib/motion.ts`), e.g. Recharts `isAnimationActive={!reducedMotion}`.
- Page change: View Transitions (`NavLink viewTransition`, `main { view-transition-name: page }`), 250 ms fade +
  8 px rise. The nav pill slides between tabs.
- Stagger with the `enter-fade` utility and `--stagger` 0–5 (40 ms apart), first load only.
- Colour never carries meaning alone: status pills and progress bars always have text. Visible focus everywhere.
