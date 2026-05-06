import os
os.environ["USE_TF"] = "0"
os.environ["USE_TORCH"] = "1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.routers import auth, fields, sensors, scans, ndvi, alerts, animals, livestock_ws, livestock_scans, health_scan, satellite, insights
from app.services.intelligence_daemon import intelligence_daemon
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.db.session import engine
    from app.models.all_models import Base
    from app.db.migrations import run as run_migrations

    # 1. Create new tables, then apply column migrations — must finish BEFORE daemon starts
    Base.metadata.create_all(bind=engine)
    run_migrations(engine)

    # 2. Start background intelligence engine
    print(f"Starting Intelligence Daemon with DB: {settings.DATABASE_URL}")
    intelligence_daemon.start()
    yield
    intelligence_daemon.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

_ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
).split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Welcome to Sania AgriSmart API"}

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(animals.router, prefix=f"{settings.API_V1_STR}/animals", tags=["livestock"])
app.include_router(livestock_ws.router, prefix=f"{settings.API_V1_STR}/livestock_telemetry", tags=["livestock"])
app.include_router(scans.router, prefix=f"{settings.API_V1_STR}/scans", tags=["disease"])
app.include_router(fields.router, prefix=f"{settings.API_V1_STR}/fields", tags=["fields"])
app.include_router(ndvi.router, prefix=f"{settings.API_V1_STR}/ndvi", tags=["satellite"])
app.include_router(sensors.router, prefix=f"{settings.API_V1_STR}/sensors", tags=["sensors"])
app.include_router(alerts.router, prefix=f"{settings.API_V1_STR}/alerts", tags=["alerts"])
app.include_router(livestock_scans.router, prefix=f"{settings.API_V1_STR}/livestock_scans", tags=["satellite"])
app.include_router(health_scan.router, prefix=f"{settings.API_V1_STR}/health-scan", tags=["health-diagnostic"])
app.include_router(satellite.router, prefix=f"{settings.API_V1_STR}/satellite", tags=["satellite"])
app.include_router(insights.router, prefix=f"{settings.API_V1_STR}/insights", tags=["insights"])

# Mount Data directory for SVI Assets
data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "Data")
if os.path.exists(data_dir):
    app.mount("/Data", StaticFiles(directory=data_dir), name="data")

# Force UI reload to ingest new API Key
