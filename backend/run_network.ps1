# API joignable depuis le téléphone (même Wi‑Fi). NE PAS utiliser 127.0.0.1.
Set-Location $PSScriptRoot
$env:PYTHONPATH = "."
& .\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000
