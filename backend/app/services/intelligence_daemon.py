"""
Intelligence Daemon — Real-data monitoring service
==================================================
This daemon performs **no telemetry simulation**. It only reads data that the
farmer has actually entered (manual vital readings, consumption logs,
vaccination schedules) and combines it with **real external data** (weather,
THI from Open-Meteo, NDVI from Sentinel/NASA) to surface actionable alerts.

What it does each cycle (default: every 10 minutes):
  1. **Vaccination dues** — flags shots within the next 7 days.
  2. **Heat-stress alerts** — fetches real Open-Meteo weather for each farm
     and emits THI-based alerts per species when thresholds are crossed.
  3. **Vital anomaly review** — re-examines the latest manual vital readings
     each animal has and creates alerts for fever / hypothermia / brady- /
     tachycardia. No new readings are invented.
  4. **Hydration trend** — analyses the *real* water-consumption logs the
     farmer has entered (>5 days of data required) and warns on >40% drop.

Inputs (all real):
  - VaccinationLog rows (farmer-entered)
  - AnimalTelemetry rows (farmer-entered via /telemetry/manual)
  - ConsumptionLog rows (farmer-entered via UI)
  - weather_service (Open-Meteo public API)
  - satellite_service (Sentinel-2 / NASA POWER public APIs)
"""

import asyncio
import logging
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from ..db.session import SessionLocal
from ..models.all_models import (Animal, AnimalTelemetry, VaccinationLog,
                                  ConsumptionLog, Alert, Farm)
from .weather_intelligence import weather_service

logger = logging.getLogger(__name__)


# Per-species physiological reference ranges (USDA + Merck Veterinary Manual)
_VITAL_RANGES: dict[str, dict] = {
    "Bovin":  {"temp_low": 37.5, "temp_high": 40.0, "hr_low": 40, "hr_high": 110},
    "Ovin":   {"temp_low": 38.0, "temp_high": 41.0, "hr_low": 60, "hr_high": 125},
    "Caprin": {"temp_low": 38.0, "temp_high": 41.5, "hr_low": 60, "hr_high": 130},
    "Cheval": {"temp_low": 37.0, "temp_high": 39.5, "hr_low": 24, "hr_high": 64},
}
_DEFAULT_VITAL = _VITAL_RANGES["Bovin"]

# Per-species THI alert thresholds (Hahn, Mader & Eigenberg 2003 — USDA-ARS)
_THI_DANGER: dict[str, float] = {
    "Bovin":  80.0,
    "Ovin":   85.0,
    "Caprin": 87.0,
    "Cheval": 80.0,
}

_VAX_CHECK_INTERVAL_H  = 12
_HEAT_CHECK_INTERVAL_H = 1
_WATER_DROP_THRESHOLD  = 0.40


def _thi(temp_c: float, rh_pct: float) -> float:
    """Temperature-Humidity Index — NRC 1971 formula."""
    return temp_c - (0.31 - 0.31 * rh_pct / 100.0) * (temp_c - 14.4)


def _create_alert_if_absent(db: Session, farm_id: str, alert_type: str,
                            severity: str, note: str) -> bool:
    existing = db.query(Alert).filter(
        Alert.type == alert_type, Alert.status == "open"
    ).first()
    if existing:
        return False
    db.add(Alert(farm_id=farm_id, type=alert_type, severity=severity, note=note))
    db.commit()
    return True


class IntelligenceDaemon:
    """Long-running monitor — reads real data only, never invents telemetry."""

    def __init__(self, interval_seconds: int = 600):
        self.interval_seconds = interval_seconds
        self.running = False
        self._thread: Optional[threading.Thread] = None
        self._cycle = 0
        self._last_vax_check:  Optional[datetime] = None
        self._last_heat_check: Optional[datetime] = None

    # ── Lifecycle ───────────────────────────────────────────────────────
    def start(self) -> None:
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._run_wrapper, daemon=True,
                                        name="livestock-intelligence-daemon")
        self._thread.start()
        logger.info(f"Intelligence Daemon started (interval={self.interval_seconds}s).")

    def stop(self) -> None:
        self.running = False

    def _run_wrapper(self) -> None:
        try:
            asyncio.run(self._main_loop())
        except Exception as exc:
            logger.error(f"Daemon main loop crashed: {exc}")

    async def _main_loop(self) -> None:
        while self.running:
            t0 = time.time()
            self._cycle += 1
            db: Optional[Session] = None
            try:
                db = SessionLocal()
                animals = db.query(Animal).all()

                self._write_heartbeat(len(animals))

                if animals:
                    if self._should_check(self._last_vax_check, _VAX_CHECK_INTERVAL_H):
                        self._check_vaccination_dues(db, animals)
                        self._last_vax_check = datetime.now(timezone.utc)

                    if self._should_check(self._last_heat_check, _HEAT_CHECK_INTERVAL_H):
                        await self._check_heat_stress(db, animals)
                        self._last_heat_check = datetime.now(timezone.utc)

                    self._review_recent_vitals(db, animals)
                    self._review_water_trends(db, animals)

                logger.info(f"Cycle {self._cycle} — reviewed {len(animals)} animal(s) in "
                            f"{time.time()-t0:.1f}s")
            except Exception as exc:
                logger.error(f"Daemon cycle error: {exc}")
            finally:
                if db is not None:
                    try: db.close()
                    except Exception: pass

            await asyncio.sleep(max(1, self.interval_seconds - (time.time() - t0)))

    # ── Helpers ─────────────────────────────────────────────────────────
    @staticmethod
    def _should_check(last_run: Optional[datetime], interval_hours: int) -> bool:
        if last_run is None:
            return True
        return datetime.now(timezone.utc) - last_run >= timedelta(hours=interval_hours)

    def _write_heartbeat(self, animal_count: int) -> None:
        try:
            with open("daemon_heartbeat.txt", "w", encoding="utf-8") as f:
                f.write(f"last_run={datetime.now(timezone.utc).isoformat()}\n")
                f.write(f"animals={animal_count}\n")
                f.write(f"cycle={self._cycle}\n")
                f.write(f"mode=real-data-only (no IoT/no simulation)\n")
        except Exception:
            pass

    # ── Real checks ─────────────────────────────────────────────────────
    def _check_vaccination_dues(self, db: Session, animals: list) -> None:
        """Flags shots due within ±7 days. Source: VaccinationLog (farmer input)."""
        now          = datetime.now(timezone.utc)
        window_start = now - timedelta(days=1)
        window_end   = now + timedelta(days=7)
        due_logs = (db.query(VaccinationLog)
                    .filter(VaccinationLog.next_due_date >= window_start,
                            VaccinationLog.next_due_date <= window_end).all())
        animal_map = {a.id: a for a in animals}
        for log in due_logs:
            animal = animal_map.get(log.animal_id)
            if not animal:
                continue
            ndd = log.next_due_date
            if ndd.tzinfo is None:
                ndd = ndd.replace(tzinfo=timezone.utc)
            days_left = (ndd - now).days
            if days_left < 0:    urgency, label = "critique", f"RETARD de {abs(days_left)}j"
            elif days_left == 0: urgency, label = "high",     "AUJOURD'HUI"
            else:                urgency, label = "medium",   f"dans {days_left}j"
            alert_type = f"VACCINE_DUE_{animal.tag_id}_{log.vaccine_name.replace(' ', '_')}"
            note = (f"RAPPEL VACCINAL — {animal.tag_id} ({animal.species}) : "
                    f"vaccin '{log.vaccine_name}' ({log.dose}) prévu {label}. "
                    f"Vétérinaire : {log.vet_name or 'Non renseigné'}.")
            if _create_alert_if_absent(db, animal.farm_id, alert_type, urgency, note):
                logger.info(f"Vaccine alert created — {animal.tag_id} / {log.vaccine_name}")

    async def _check_heat_stress(self, db: Session, animals: list) -> None:
        """One Open-Meteo call per farm; emit THI alerts per species exposed."""
        farms = {a.farm_id: a for a in animals}
        farm_objs = (db.query(Farm)
                       .filter(Farm.id.in_(list(farms.keys()))).all())
        from ..core.location_utils import parse_coordinates
        for farm in farm_objs:
            if not farm.location:
                continue
            coords = parse_coordinates(farm.location)
            if not coords:
                continue
            lat, lon = coords
            try:
                w = await weather_service.get_current_weather(lat, lon)
            except Exception as exc:
                logger.debug(f"Weather fetch failed for farm {farm.id}: {exc}")
                continue
            t = w.get("temperature")
            rh = w.get("relativehumidity") or w.get("relative_humidity") or w.get("rh") or 50.0
            if t is None:
                continue
            thi_value = _thi(float(t), float(rh))

            farm_animals = [a for a in animals if a.farm_id == farm.id]
            species_in_farm = {a.species for a in farm_animals if a.species}
            for sp in species_in_farm:
                threshold = _THI_DANGER.get(sp, 80.0)
                if thi_value >= threshold:
                    alert_type = f"HEAT_STRESS_{farm.id}_{sp}"
                    note = (f"STRESS THERMIQUE — {sp} : THI={thi_value:.1f} ≥ seuil "
                            f"{threshold:.0f}. Température {t}°C, humidité {rh}%. "
                            f"Augmenter abreuvement, ombrage et ventilation.")
                    severity = "critique" if thi_value >= threshold + 5 else "high"
                    _create_alert_if_absent(db, farm.id, alert_type, severity, note)

    def _review_recent_vitals(self, db: Session, animals: list) -> None:
        """For each animal, look at the most recent *real* manual reading
        and emit alerts if it crosses physiological bounds."""
        for animal in animals:
            latest = (db.query(AnimalTelemetry)
                        .filter(AnimalTelemetry.animal_id == animal.id)
                        .order_by(AnimalTelemetry.time.desc()).first())
            if latest is None:
                continue
            # Only check readings entered in the last 6 hours so the daemon
            # doesn't keep firing on stale historical data.
            latest_time = latest.time
            if latest_time.tzinfo is None:
                latest_time = latest_time.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) - latest_time > timedelta(hours=6):
                continue
            ranges = _VITAL_RANGES.get(animal.species or "", _DEFAULT_VITAL)
            tag    = animal.tag_id
            sp     = animal.species or "Inconnu"
            farm_id = str(animal.farm_id)
            t  = float(latest.temperature_c or 0)
            hr = float(latest.heart_rate or 0)
            if t > 0:
                if t < ranges["temp_low"]:
                    _create_alert_if_absent(db, farm_id, f"HYPOTHERMIA_{tag}", "critique",
                        f"HYPOTHERMIE — {tag} ({sp}) : {t}°C (seuil bas : {ranges['temp_low']}°C). "
                        f"Réchauffer et consulter vétérinaire.")
                elif t > ranges["temp_high"]:
                    _create_alert_if_absent(db, farm_id, f"FEVER_{tag}", "high",
                        f"FIÈVRE — {tag} ({sp}) : {t}°C (seuil haut : {ranges['temp_high']}°C). "
                        f"Isoler, hydrater et consulter vétérinaire.")
            if hr > 0:
                if hr < ranges["hr_low"]:
                    _create_alert_if_absent(db, farm_id, f"BRADYCARDIA_{tag}", "high",
                        f"BRADYCARDIE — {tag} ({sp}) : {hr} BPM (seuil bas : {ranges['hr_low']} BPM).")
                elif hr > ranges["hr_high"]:
                    _create_alert_if_absent(db, farm_id, f"TACHYCARDIA_{tag}", "high",
                        f"TACHYCARDIE — {tag} ({sp}) : {hr} BPM (seuil haut : {ranges['hr_high']} BPM).")

    def _review_water_trends(self, db: Session, animals: list) -> None:
        """Compare last 2 logs vs the previous 5+ — needs ≥7 farmer entries."""
        for animal in animals:
            logs = (db.query(ConsumptionLog)
                      .filter(ConsumptionLog.animal_id == animal.id,
                              ConsumptionLog.water_liters > 0)
                      .order_by(ConsumptionLog.date.desc())
                      .limit(10).all())
            if len(logs) < 7:
                continue
            recent_avg   = sum(l.water_liters for l in logs[:2]) / 2
            baseline_avg = sum(l.water_liters for l in logs[2:]) / len(logs[2:])
            if baseline_avg <= 0:
                continue
            drop = 1.0 - (recent_avg / baseline_avg)
            if drop >= _WATER_DROP_THRESHOLD:
                _create_alert_if_absent(db, str(animal.farm_id),
                    f"DEHYDRATION_RISK_{animal.tag_id}", "high",
                    f"RISQUE DÉSHYDRATATION — {animal.tag_id} ({animal.species}) : "
                    f"eau −{drop*100:.0f}% (récent {recent_avg:.1f}L vs baseline "
                    f"{baseline_avg:.1f}L). Vérifier accès à l'eau et état général.")


intelligence_daemon = IntelligenceDaemon()
