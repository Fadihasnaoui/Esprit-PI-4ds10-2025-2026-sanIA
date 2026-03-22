from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import auth, fields, sensors, scans, ndvi, alerts, animals, rag

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "Welcome to Sania AgriSmart API"}

app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(animals.router, prefix=f"{settings.API_V1_STR}/animals", tags=["livestock"])
app.include_router(scans.router, prefix=f"{settings.API_V1_STR}/scans", tags=["disease"])
app.include_router(fields.router, prefix=f"{settings.API_V1_STR}/fields", tags=["fields"])
app.include_router(ndvi.router, prefix=f"{settings.API_V1_STR}/ndvi", tags=["satellite"])
app.include_router(sensors.router, prefix=f"{settings.API_V1_STR}/sensors", tags=["sensors"])
app.include_router(alerts.router, prefix=f"{settings.API_V1_STR}/alerts", tags=["alerts"])
app.include_router(rag.router, prefix=f"{settings.API_V1_STR}/rag", tags=["rag"])
