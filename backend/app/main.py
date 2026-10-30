from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from drug_recall_risk_classifier import DEFECT_TO_CLASS, UnknownDefectError, setup_logging

from .db import init_db
from .routers import meta, recalls, stats
from .services import TimelineError


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Sends recall_system logger output (incl. unknown defect warnings) to recall_system_log.txt.
    setup_logging()
    init_db()
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

HTTP_ERROR_CODES = {404: "not_found", 405: "method_not_allowed"}


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


@app.exception_handler(StarletteHTTPException)
async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": HTTP_ERROR_CODES.get(exc.status_code, "http_error"), "message": exc.detail},
        headers=exc.headers,
    )
