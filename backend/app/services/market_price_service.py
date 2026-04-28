"""
Market Price Service — Dynamic livestock valuation (Tunisia context)
====================================================================
No paid API, no subscription. Produces a *dynamic* price in TND by blending:

  1. Species base price (TND, anchored on Tunisian souk reference 2025)
  2. Live USD→TND exchange rate (ECB via frankfurter.app — free, no key)
     → captures import/feed cost pressure translated to livestock value
  3. Seasonal multiplier (lunar calendar driven):
     - Aïd al-Adha window  → +25 to +35% for Ovin / Caprin
     - Ramadan window      → +5 to +10% for Bovin
     - Winter feed scarcity→ -5% all species
  4. Per-animal modulators: age, weight, health status (from Health Scan)

Output is recomputed live every request (exchange rate cached 1h).
"""

from datetime import date, datetime
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

# Baseline exchange rate (USD → TND around mid-2025). Current rate is
# compared against this to derive an "economic pressure" factor.
_USD_TND_BASELINE = 3.10

# Cache
_CACHE_TTL = 3600
_fx_cache: dict = {}

# ── Islamic / seasonal windows (approximate — update yearly if needed) ──
# Keys are (year, month, day_from, day_to) — gregorian projection of hijri
# calendar. Values are multipliers per species.
_SEASONAL_WINDOWS = [
    # Aïd al-Adha ~ 10 Dhu al-Hijjah. Projected Gregorian dates:
    # 2025: 2025-06-06 → 2025-06-10 (peak demand ~ 2 weeks before)
    # 2026: 2026-05-27 → 2026-05-31
    # 2027: 2027-05-16 → 2027-05-20
    {"from": "2025-05-20", "to": "2025-06-12", "mult": {"Ovin": 1.35, "Caprin": 1.28}},
    {"from": "2026-05-10", "to": "2026-06-02", "mult": {"Ovin": 1.35, "Caprin": 1.28}},
    {"from": "2027-04-30", "to": "2027-05-22", "mult": {"Ovin": 1.35, "Caprin": 1.28}},

    # Ramadan — higher Bovin demand for couscous feasts
    {"from": "2025-02-28", "to": "2025-03-30", "mult": {"Bovin": 1.08}},
    {"from": "2026-02-17", "to": "2026-03-19", "mult": {"Bovin": 1.08}},
    {"from": "2027-02-06", "to": "2027-03-08", "mult": {"Bovin": 1.08}},
]


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
    """Return (multiplier, window_label) for the given species & date."""
    today = today or date.today()
    for w in _SEASONAL_WINDOWS:
        start = date.fromisoformat(w["from"])
        end   = date.fromisoformat(w["to"])
        if start <= today <= end:
            mult = w["mult"].get(species, 1.0)
            if mult != 1.0:
                label = _window_label(w)
                return mult, label
    # Winter feed scarcity (Dec–Feb) baseline dip
    if today.month in (12, 1, 2):
        return 0.95, "Saison hivernale (fourrage)"
    return 1.0, None


def _window_label(window: dict) -> str:
    m = window.get("mult", {})
    if "Ovin" in m or "Caprin" in m:
        return "Aïd al-Adha"
    if "Bovin" in m:
        return "Ramadan"
    return "Période spéciale"


def get_price_context() -> dict:
    """
    Return the live market context used for all per-animal calculations.
    Call this once per dashboard load; the result is dynamic (updates daily).
    """
    rate = _fetch_usd_tnd()
    fx_factor = 1.0
    if rate is not None:
        # 1% move in USD/TND = ~0.5% livestock price move (dampened)
        fx_factor = 1.0 + 0.5 * ((rate / _USD_TND_BASELINE) - 1.0)
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
            "baseline": _USD_TND_BASELINE,
            "factor":   round(fx_factor, 4),
            "source":   "ECB / frankfurter.app",
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
