"""
Market Price Service — Dynamic livestock valuation (Tunisia context)
====================================================================
No paid API, no subscription. Produces a *dynamic* price in TND by blending:

  1. Species base price (TND, anchored on Tunisian souk reference 2026)
  2. Live USD→TND exchange rate (ECB via frankfurter.app — free, no key)
     → captures import/feed cost pressure translated to livestock value
  3. Seasonal multiplier (lunar calendar driven):
     - Aïd al-Adha window  → +25 to +35% for Ovin / Caprin
     - Ramadan window      → +5 to +10% for Bovin
     - Winter feed scarcity→ -5% all species
  4. Per-animal modulators: age, weight, health status (from Health Scan)

Output is recomputed live every request (exchange rate cached 1h).
"""

from datetime import date, datetime, timedelta
import logging
import time
from typing import Optional

import requests as _http

logger = logging.getLogger(__name__)

# ── Base prices (TND) — Tunisian souk reference, species-level ───────────
_BASE_TND = {
    "Bovin":    4800,
    "Cheval":   8500,
    "Ovin":     1450,
    "Caprin":    980,
    "Volaille":   35,
}

# Cache
_CACHE_TTL = 3600
_BASELINE_TTL = 86400 * 7  # rolling baseline refreshed weekly
_fx_cache: dict = {}
_baseline_cache: dict = {}

# Hijri → Gregorian projection. Computed dynamically via Aladhan API
# (free, no key, official source: islamicfinder/diyanet-aligned).
_HIJRI_API = "https://api.aladhan.com/v1/hToGCalendar"
_hijri_cache: dict = {}


def _fetch_hijri_event(hijri_month: int, hijri_day: int, gregorian_year: int) -> Optional[date]:
    """Convert a Hijri date (month, day, current Gregorian year for window) to Gregorian.
    Uses the Aladhan public API. Cached per (month, day, year)."""
    key = f"{hijri_month}_{hijri_day}_{gregorian_year}"
    if key in _hijri_cache:
        return _hijri_cache[key]
    try:
        # The API returns the Gregorian dates corresponding to a Hijri month.
        # We probe the current Hijri year by trying each candidate.
        for h_year in (gregorian_year - 622, gregorian_year - 621, gregorian_year - 620):
            r = _http.get(f"{_HIJRI_API}/{hijri_month}/{h_year}", timeout=6)
            if r.status_code != 200:
                continue
            data = r.json().get("data", [])
            for entry in data:
                hijri = entry.get("hijri", {})
                gregorian = entry.get("gregorian", {})
                if int(hijri.get("day", 0)) == hijri_day:
                    g_str = gregorian.get("date")  # "DD-MM-YYYY"
                    if g_str:
                        d, m, y = g_str.split("-")
                        result = date(int(y), int(m), int(d))
                        if result.year == gregorian_year:
                            _hijri_cache[key] = result
                            return result
    except Exception as exc:
        logger.debug(f"Hijri API failed: {exc}")
    _hijri_cache[key] = None
    return None


def _compute_seasonal_windows(year: int) -> list[dict]:
    """Build current-year seasonal multiplier windows from real Hijri calendar."""
    windows = []
    # Aïd al-Adha = 10 Dhu al-Hijjah (Hijri month 12). Demand peaks ~3 weeks prior.
    aid_date = _fetch_hijri_event(12, 10, year)
    if aid_date:
        windows.append({
            "from": (aid_date - timedelta(days=21)).isoformat(),
            "to":   (aid_date + timedelta(days=2)).isoformat(),
            "mult": {"Ovin": 1.35, "Caprin": 1.28},
            "label": "Aïd al-Adha",
        })
    # Ramadan = entire Hijri month 9. Higher Bovin demand throughout.
    ram_start = _fetch_hijri_event(9, 1, year)
    ram_end   = _fetch_hijri_event(9, 29, year)
    if ram_start and ram_end:
        windows.append({
            "from": ram_start.isoformat(),
            "to":   ram_end.isoformat(),
            "mult": {"Bovin": 1.08},
            "label": "Ramadan",
        })
    return windows


def _get_seasonal_windows() -> list[dict]:
    """Cache seasonal windows for 24h. Covers current and next Gregorian year
    to handle late-Dec lookups."""
    now = time.time()
    cached = _baseline_cache.get("seasonal")
    if cached and cached["_ts"] > now - 86400:
        return cached["windows"]
    year = date.today().year
    windows = _compute_seasonal_windows(year) + _compute_seasonal_windows(year + 1)
    _baseline_cache["seasonal"] = {"windows": windows, "_ts": now}
    return windows


_FX_SOURCES = [
    # (url, extractor) — tried in order; first success wins.
    # open.er-api.com covers TND and is free/no-key.
    ("https://open.er-api.com/v6/latest/USD",
     lambda j: float(j["rates"]["TND"])),
    # exchangerate.host — free, no key, broad currency coverage (backup).
    ("https://api.exchangerate.host/latest?base=USD&symbols=TND",
     lambda j: float(j["rates"]["TND"])),
    # FloatRates — last-resort free JSON feed.
    ("https://www.floatrates.com/daily/usd.json",
     lambda j: float(j["tnd"]["rate"])),
]


def _fetch_usd_tnd() -> Optional[float]:
    """Live USD→TND from free, key-less FX providers (cascade with fallback)."""
    now = time.time()
    cached = _fx_cache.get("usd_tnd")
    if cached and cached["_ts"] > now - _CACHE_TTL:
        return cached["rate"]

    for url, extract in _FX_SOURCES:
        try:
            r = _http.get(url, timeout=6)
            r.raise_for_status()
            rate = extract(r.json())
            if rate and rate > 0:
                _fx_cache["usd_tnd"] = {"rate": rate, "_ts": now}
                return rate
        except Exception as exc:
            logger.debug(f"FX source {url} failed: {exc}")
            continue

    # All providers down — log once, fall back to last cached rate if any.
    if cached:
        logger.info("ℹ️  FX sources unreachable, using last cached rate.")
        return cached["rate"]
    logger.info("ℹ️  FX unavailable — pricing continues without FX adjustment.")
    return None


def _seasonal_multiplier(species: str, today: Optional[date] = None) -> tuple[float, str | None]:
    """Return (multiplier, window_label) for the given species & date.
    Uses real-time Hijri calendar via Aladhan API."""
    today = today or date.today()
    for w in _get_seasonal_windows():
        try:
            start = date.fromisoformat(w["from"])
            end   = date.fromisoformat(w["to"])
        except Exception:
            continue
        if start <= today <= end:
            mult = w["mult"].get(species, 1.0)
            if mult != 1.0:
                return mult, w.get("label", "Période spéciale")
    # Winter feed scarcity (Dec–Feb) baseline dip — meteorologically grounded
    if today.month in (12, 1, 2):
        return 0.95, "Saison hivernale (fourrage)"
    return 1.0, None


def _rolling_baseline_usd_tnd() -> float:
    """
    Compute a real 90-day moving average of USD/TND from frankfurter.app
    (free ECB-backed time-series API, no key). Cached weekly.

    This replaces the previously hardcoded 3.10 baseline with a live,
    self-updating reference value.
    """
    now = time.time()
    cached = _baseline_cache.get("usd_tnd_baseline")
    if cached and cached["_ts"] > now - _BASELINE_TTL:
        return cached["rate"]

    end = date.today()
    start = end - timedelta(days=90)
    try:
        r = _http.get(
            f"https://api.frankfurter.app/{start.isoformat()}..{end.isoformat()}",
            params={"from": "USD", "to": "TND"},
            timeout=8,
        )
        r.raise_for_status()
        rates = r.json().get("rates", {})
        values = [float(v["TND"]) for v in rates.values() if "TND" in v]
        if values:
            avg = sum(values) / len(values)
            _baseline_cache["usd_tnd_baseline"] = {"rate": avg, "_ts": now}
            return avg
    except Exception as exc:
        logger.debug(f"Baseline FX history fetch failed: {exc}")

    # Last-resort: use the current rate as baseline (no FX adjustment then)
    current = _fx_cache.get("usd_tnd", {}).get("rate")
    return float(current) if current else 3.10


def get_price_context() -> dict:
    """
    Return the live market context used for all per-animal calculations.
    Call this once per dashboard load; the result is dynamic (updates daily).
    """
    rate = _fetch_usd_tnd()
    baseline = _rolling_baseline_usd_tnd()
    fx_factor = 1.0
    if rate is not None and baseline > 0:
        # 1% move in USD/TND = ~0.5% livestock price move (dampened)
        fx_factor = 1.0 + 0.5 * ((rate / baseline) - 1.0)
        fx_factor = max(0.85, min(1.25, fx_factor))  # clamp ±25%

    today = date.today()
    seasonal = {}
    for sp in _BASE_TND.keys():
        mult, label = _seasonal_multiplier(sp, today)
        seasonal[sp] = {"multiplier": round(mult, 3), "event": label}

    return {
        "currency": "TND",
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "exchange_rate": {
            "usd_tnd":  round(rate, 4) if rate else None,
            "baseline": round(baseline, 4),
            "factor":   round(fx_factor, 4),
            "source":   "open.er-api.com / frankfurter.app (ECB)",
        },
        "base_prices_tnd": _BASE_TND,
        "seasonal":        seasonal,
    }


def compute_animal_price(
    species:     str,
    birth_date:  Optional[datetime] = None,
    weight_kg:   Optional[float]     = None,
    health_status: Optional[str]     = None,
) -> dict:
    """
    Dynamic per-animal TND price.
      price = base * fx_factor * seasonal_mult * age_mod * weight_mod * health_mod
    """
    ctx = get_price_context()
    base = _BASE_TND.get(species, 1000)
    fx_factor = ctx["exchange_rate"]["factor"]
    seasonal  = ctx["seasonal"].get(species, {"multiplier": 1.0, "event": None})

    # Age modifier
    age_mod = 1.0
    if birth_date:
        age_years = (datetime.utcnow() - birth_date).days / 365.25
        if age_years < 0.5:    age_mod = 0.65   # weanling
        elif age_years < 1.5:  age_mod = 0.90   # yearling
        elif age_years > 8:    age_mod = 0.70   # old
        else:                  age_mod = 1.0    # prime

    # Weight modifier (species-specific minima)
    weight_mod = 1.0
    if weight_kg:
        sp = species.lower()
        if sp == "bovin"  and weight_kg < 350: weight_mod = 0.85
        elif sp == "ovin"   and weight_kg < 45:  weight_mod = 0.82
        elif sp == "caprin" and weight_kg < 30:  weight_mod = 0.80
        elif sp == "cheval" and weight_kg < 300: weight_mod = 0.85

    # Health modifier
    health_mod = 1.0
    if health_status == "Critique" or health_status == "Malade" or health_status == "URGENCE":
        health_mod = 0.40
    elif health_status in ("Déshydraté", "Sous-alimenté", "Stressé"):
        health_mod = 0.75

    raw = base * fx_factor * seasonal["multiplier"] * age_mod * weight_mod * health_mod
    # Tunisian souk rounding habit
    if   raw > 1000: price = round(raw / 50) * 50
    elif raw > 100:  price = round(raw / 10) * 10
    else:            price = round(raw / 5)  * 5

    return {
        "price_tnd":    price,
        "currency":     "TND",
        "breakdown": {
            "base":       base,
            "fx_factor":  round(fx_factor, 4),
            "seasonal":   seasonal,
            "age_mod":    round(age_mod, 2),
            "weight_mod": round(weight_mod, 2),
            "health_mod": round(health_mod, 2),
        },
        "updated_at":   ctx["updated_at"],
    }
