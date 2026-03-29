from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import auth, fields, sensors, scans, ndvi, alerts, animals, livestock_ws

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

@app.on_event("startup")
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
