import os
import uuid
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, status
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine, get_db
from app.limiter import limiter
from app.routers import admin, alerts, auth, events, portfolio, stocks, target_prices, watchlists
from app.scheduler import start_scheduler, stop_scheduler

API_V1_PREFIX = "/api/v1"


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.environment != "test" and settings.stock_daily_sync_enabled:
        start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(
    title=settings.app_name,
    description="Taiwan Stock Market Data Platform with JWT Authentication",
    version="2.0.0",
    debug=settings.debug,
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Request ID middleware
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# CORS
origins = [origin.strip() for origin in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(stocks.router, prefix=API_V1_PREFIX)
app.include_router(stocks.sync_jobs_router, prefix=API_V1_PREFIX)
app.include_router(watchlists.router, prefix=API_V1_PREFIX)
app.include_router(target_prices.router, prefix=API_V1_PREFIX)
app.include_router(alerts.router, prefix=API_V1_PREFIX)
app.include_router(events.router, prefix=API_V1_PREFIX)
app.include_router(portfolio.router, prefix=API_V1_PREFIX)
app.include_router(admin.router, prefix=API_V1_PREFIX)


@app.get("/health", tags=["Health"])
async def health_check(db = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"status": "unhealthy", "database": str(exc)},
        )


@app.api_route("/api", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
@app.api_route("/api/{full_path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False)
async def api_not_found(full_path: str = ""):
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="API endpoint not found",
    )


# Serve built frontend (SPA fallback)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_FRONTEND_DIST = os.path.join(_BASE_DIR, "frontend", "dist")
_FRONTEND_DEV_ORIGIN = "http://127.0.0.1:5173"


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    file_path = os.path.join(_FRONTEND_DIST, full_path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return FileResponse(file_path)

    index_path = os.path.join(_FRONTEND_DIST, "index.html")
    if os.path.exists(index_path) and os.path.isfile(index_path):
        return FileResponse(index_path)

    if settings.environment == "development":
        redirect_path = f"/{full_path}" if full_path else "/"
        return RedirectResponse(f"{_FRONTEND_DEV_ORIGIN}{redirect_path}")

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Frontend build not found. Run the frontend dev server or create frontend/dist first.",
    )
