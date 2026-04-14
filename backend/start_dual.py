"""
Dev helper: run the same FastAPI app on :8000 and :8001 at once.
Use the same port as the website and mobile (8000) — 8001 stays available for legacy tools.

From the backend folder:
  python start_dual.py

Ctrl+C stops both workers (may take a moment with --reload).
"""
from __future__ import annotations

import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


def main() -> None:
    exe = sys.executable
    ports = (8000, 8001)

    def cmd(port: int) -> list[str]:
        return [
            exe,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            str(port),
            "--reload",
        ]

    print("Sania backend — uvicorn on ports", ", ".join(f":{p}" for p in ports))
    procs = [subprocess.Popen(cmd(p)) for p in ports]
    try:
        while any(p.poll() is None for p in procs):
            time.sleep(0.25)
    except KeyboardInterrupt:
        print("\nStopping…")
    finally:
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass
        for p in procs:
            try:
                p.wait(timeout=15)
            except Exception:
                pass


if __name__ == "__main__":
    main()
