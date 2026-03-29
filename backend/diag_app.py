import sys
import time

def trace_step(step_name):
    print(f"DEBUG: Starting {step_name}...", flush=True)
    start = time.time()
    try:
        return start
    except Exception as e:
        print(f"DEBUG: Error {step_name}: {e}", flush=True)

def end_step(step_name, start):
    print(f"DEBUG: Finished {step_name} ({time.time() - start:.2f}s)", flush=True)

s = trace_step("FastAPI import")
from fastapi import FastAPI
end_step("FastAPI import", s)

s = trace_step("CORSMiddleware import")
from fastapi.middleware.cors import CORSMiddleware
end_step("CORSMiddleware import", s)

s = trace_step("settings import")
from app.core.config import settings
end_step("settings import", s)

s = trace_step("routers import")
from app.routers import auth, fields, sensors, scans, ndvi, alerts, animals, livestock_ws
end_step("routers import", s)

s = trace_step("engine and Base import")
from app.db.session import engine
from app.models.all_models import Base
end_step("engine and Base import", s)

s = trace_step("Base.metadata.create_all")
Base.metadata.create_all(bind=engine)
end_step("Base.metadata.create_all", s)

s = trace_step("FastAPI app instance creation")
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)
end_step("FastAPI app instance creation", s)

print("DEBUG: All main.py logic completed successfully", flush=True)
