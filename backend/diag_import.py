import sys
import time

def trace_import(module_name):
    print(f"DEBUG: Importing {module_name}...", flush=True)
    start = time.time()
    try:
        __import__(module_name)
        print(f"DEBUG: Done {module_name} ({time.time() - start:.2f}s)", flush=True)
    except Exception as e:
        print(f"DEBUG: Error {module_name}: {e}", flush=True)

modules = [
    "app.core.config",
    "app.db.session",
    "app.models.all_models",
    "app.routers.auth",
    "app.routers.fields",
    "app.routers.sensors",
    "app.routers.scans",
    "app.routers.ndvi",
    "app.routers.alerts",
    "app.routers.animals",
    "app.routers.livestock_ws",
]

for m in modules:
    trace_import(m)

print("DEBUG: All imports completed successfully", flush=True)
