import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.exceptions import HTTPException as StarletteHTTPException

from drug_recall_risk_classifier import DEFECT_TO_CLASS, UnknownDefectError, setup_logging

from .db import SessionLocal, init_db
from .demo import DemoFullError
from .routers import meta, recalls, sample, stats
from .services import TimelineError, seed_demo_data


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sends recall_system logger output (incl. unknown defect warnings) to recall_system_log.txt.
    setup_logging()
    init_db()
    with SessionLocal() as session:
        seed_demo_data(session)  # only with RECALL_DEMO_SEED=1 and an empty database
    yield


app = FastAPI(title="Drug Recall Risk Classifier API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router, prefix="/api")
app.include_router(recalls.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(sample.router, prefix="/api")

HTTP_ERROR_CODES = {404: "not_found", 405: "method_not_allowed", 409: "conflict"}


@app.exception_handler(UnknownDefectError)
async def unknown_defect_handler(request: Request, exc: UnknownDefectError) -> JSONResponse:
    defect_type = getattr(exc, "defect_type", None)
    message = (
        f"Defect type '{defect_type}' is not recognised." if defect_type else str(exc)
    )
    return JSONResponse(
        status_code=422,
        content={
            "code": "unknown_defect",
            "message": message,
            "defect_type": defect_type,
            "known_types": sorted(DEFECT_TO_CLASS),
        },
    )


@app.exception_handler(DemoFullError)
async def demo_full_handler(request: Request, exc: DemoFullError) -> JSONResponse:
    return JSONResponse(status_code=409, content={"code": "demo_full", "message": str(exc)})


@app.exception_handler(TimelineError)
async def timeline_error_handler(request: Request, exc: TimelineError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"code": "timeline_error", "message": str(exc)})


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {
            # loc looks like ("body", "units_affected"); drop the location part.
            "field": ".".join(
                str(part) for part in err["loc"] if part not in ("body", "query", "path")
            ),
            # Our own validators raise ValueError; pydantic prefixes those with "Value error, ".
            "message": err["msg"].removeprefix("Value error, "),
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={
            "code": "validation_error",
            "message": "Some fields are missing or invalid.",
            "errors": errors,
        },
    )


def static_dir() -> Path:
    """Built frontend; read per request so the API also runs without it (dev, tests)."""
    return Path(os.environ.get("RECALL_STATIC_DIR") or Path(__file__).resolve().parents[2] / "frontend" / "dist")


def serve_frontend(path: str) -> Response | None:
    """A built file, or index.html for client-side routes (/explorer, ...). None = not ours to answer."""
    root = static_dir().resolve()
    if not (root / "index.html").is_file():
        return None
    target = (root / path.lstrip("/")).resolve()
    if target.is_file() and target.is_relative_to(root):
        # Vite hashes the names under /assets, so those files never change.
        cache = {"Cache-Control": "public, max-age=31536000, immutable"} if path.startswith("/assets/") else {}
        return FileResponse(target, headers=cache)
    if "." in Path(path).name:  # a missing file (script, image), not a page
        return None
    return FileResponse(root / "index.html", headers={"Cache-Control": "no-cache"})


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException) -> Response:
    # Unknown non-API GET paths: the single-page app. /api/* keeps its JSON errors.
    path = request.url.path
    if exc.status_code == 404 and request.method in ("GET", "HEAD") and path != "/api" and not path.startswith("/api/"):
        page = serve_frontend(path)
        if page is not None:
            return page
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": HTTP_ERROR_CODES.get(exc.status_code, "http_error"), "message": exc.detail},
        headers=exc.headers,
    )
