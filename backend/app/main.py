import os
os.environ["USE_TF"] = "0"
os.environ["USE_TORCH"] = "1"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.routers import auth, fields, sensors, scans, ndvi, alerts, animals, livestock_ws, livestock_scans
from app.services.intelligence_daemon import intelligence_daemon
from contextlib import asynccontextmanager
from app.core.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Démarrage du moteur d'intelligence en temps réel
    print(f"Starting Intelligence Daemon with DB: {settings.DATABASE_URL}")
    intelligence_daemon.start()
    yield
    # Arrêt propre
    intelligence_daemon.stop()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

@app.on_event("startup") # Fallback for DB Init
def startup_event():
    from app.db.session import engine
    from app.models.all_models import Base
    Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

# Mount Data directory for SVI Assets
data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "Data")
if os.path.exists(data_dir):
    app.mount("/Data", StaticFiles(directory=data_dir), name="data")
