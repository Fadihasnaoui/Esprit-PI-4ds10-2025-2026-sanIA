"""
Sentinel-2 satellite intelligence — real NDVI per zone.

Pipeline:
  1. Element84 STAC API  → find latest cloud-free Sentinel-2 L2A scene (no API key)
  2. STAC item assets    → get B04 (Red) and B08 (NIR) COG URLs on AWS public S3
  3. HTTP range request  → download only the first 4 MB of each band (overview data)
  4. tifffile            → parse overview tiles from the partial download (no GDAL / no rasterio)
  5. pyproj              → convert zone WGS-84 polygons → band UTM pixel coords
  6. numpy               → NDVI = (NIR - Red) / (NIR + Red), mean per zone
  7. Fallback            → if any step fails, use the calibrated seasonal model
"""

import io
import json
import math
import struct
import requests
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Tuple

STAC_URL = "https://earth-search.aws.element84.com/v1"
COG_PREFETCH_MB = 4          # bytes to download from each band file
MIN_PIXELS_PER_ZONE = 2      # reject zone NDVI if fewer valid pixels


# ─────────────────────────────────────────────────────────────────────────────
#  Low-level COG / GeoTIFF helpers  (no rasterio, no GDAL)
# ─────────────────────────────────────────────────────────────────────────────

def _parse_geotiff_tags(page) -> Dict:
    """Extract relevant GeoTIFF tags from a tifffile page."""
    tags = {}
    for tag in page.tags.values():
        tags[tag.code] = tag.value
    return tags


def _epsg_from_geo_keys(tags: Dict) -> Optional[int]:
    """
    Parse the GeoKeyDirectory (tag 34735) to extract the projected CRS EPSG code.
    Key 3072 = ProjectedCRSGeoKey, key 2048 = GeographicTypeGeoKey.
    """
    geo_key_dir = tags.get(34735)
    if not geo_key_dir or len(geo_key_dir) < 4:
        return None
    num_keys = geo_key_dir[3]
    for i in range(num_keys):
        base = 4 + i * 4
        if base + 3 >= len(geo_key_dir):
            break
        key_id = geo_key_dir[base]
        value  = geo_key_dir[base + 3]
        if key_id == 3072 and value > 0:   # ProjectedCRS
            return int(value)
        if key_id == 2048 and value > 0:   # GeographicCRS (fallback)
            return int(value)
    return None


def _geotransform_from_tags(tags: Dict) -> Optional[Tuple]:
    """
    Build (origin_x, origin_y, pixel_sx, pixel_sy) from TIFF tags:
      33550 = ModelPixelScaleTag  (Sx, Sy, Sz)
      33922 = ModelTiepointTag    (I, J, K, X, Y, Z)
    Returns (origin_x, origin_y, sx, sy) in band CRS units.
    """
    scale = tags.get(33550)
    tie   = tags.get(33922)
    if not scale or not tie or len(scale) < 2 or len(tie) < 6:
        return None
    sx = scale[0]
    sy = scale[1]
    # tie_point maps pixel (I, J) → CRS (X, Y)
    origin_x = tie[3] - tie[0] * sx
    origin_y = tie[4] + tie[1] * sy   # Y decreases with row
    return origin_x, origin_y, sx, sy


def _download_cog_head(url: str, mb: int = COG_PREFETCH_MB) -> Optional[bytes]:
    """Download the first N MB of a remote COG using a single HTTP range request."""
    try:
        end = mb * 1024 * 1024 - 1
        resp = requests.get(url, headers={"Range": f"bytes=0-{end}"},
                            timeout=25, allow_redirects=True)
        if resp.status_code in (200, 206):
            return resp.content
    except Exception as exc:
        print(f"[SentinelCOG] Download error: {exc}")
    return None


def _read_overview_array(cog_bytes: bytes) -> Optional[Tuple]:
    """
    Parse COG bytes with tifffile and return the smallest readable overview.
    Returns (array_int16, epsg, origin_x, origin_y, sx, sy) or None.
    """
    try:
        import tifffile

        with tifffile.TiffFile(io.BytesIO(cog_bytes)) as tif:
            # Collect all pages — COG stores overviews as additional IFDs
            all_pages = list(tif.pages)

            # Sort pages by total pixels; pick smallest page that's still useful
            candidates = []
            for page in all_pages:
                try:
                    h, w = page.shape[0], page.shape[1]
                    if 32 <= h and 32 <= w:
                        candidates.append((h * w, page))
                except Exception:
                    continue

            if not candidates:
                return None

            candidates.sort(key=lambda x: x[0])
            # Prefer overview with 64–512 pixels per side (good enough for farm zones)
            chosen_page = None
            for npix, page in candidates:
                h, w = page.shape[0], page.shape[1]
                if 32 <= h <= 1024 and 32 <= w <= 1024:
                    chosen_page = page
                    break
            if chosen_page is None:
                chosen_page = candidates[0][1]  # smallest available

            arr = chosen_page.asarray()
            tags = _parse_geotiff_tags(chosen_page)

            epsg = _epsg_from_geo_keys(tags)
            transform = _geotransform_from_tags(tags)

            if epsg is None or transform is None:
                return None

            return arr, epsg, *transform

    except Exception as exc:
        print(f"[SentinelCOG] Parse error: {exc}")
    return None


def _zone_mean_ndvi(
    b04_arr: np.ndarray, b08_arr: np.ndarray,
    epsg: int,
    origin_x: float, origin_y: float,
    sx: float, sy: float,
    polygon_geojson: str,
) -> Optional[float]:
    """
    Converts zone polygon (WGS-84) to pixel coordinates in the band CRS,
    slices the NDVI grid, and returns the mean NDVI for the zone.
    """
    try:
        from pyproj import Transformer

        geo = json.loads(polygon_geojson)
        coords = geo["coordinates"][0]   # [[lon, lat], ...]

        # WGS-84 (lon, lat) → band projected CRS (x, y)
        tr = Transformer.from_crs("EPSG:4326", f"EPSG:{epsg}", always_xy=True)

        rows, cols = [], []
        for lon, lat in coords:
            crs_x, crs_y = tr.transform(lon, lat)
            col = (crs_x - origin_x) / sx
            row = (origin_y - crs_y) / sy   # Y decreases with row
            rows.append(int(row))
            cols.append(int(col))

        if not rows:
            return None

        h, w = b04_arr.shape[:2]
        r0 = max(0, min(rows));  r1 = min(h, max(rows) + 1)
        c0 = max(0, min(cols));  c1 = min(w, max(cols) + 1)

        if r1 <= r0 or c1 <= c0:
            return None

        # Sentinel-2 L2A DN → reflectance (scale factor 10 000)
        b04 = b04_arr[r0:r1, c0:c1].astype(np.float32) / 10_000.0
        b08 = b08_arr[r0:r1, c0:c1].astype(np.float32) / 10_000.0

        denom = b08 + b04
        denom[denom == 0] = np.nan
        ndvi = np.where(denom > 0, (b08 - b04) / denom, np.nan)

        valid = (ndvi > -1.0) & (ndvi < 1.0) & ~np.isnan(ndvi)
        if valid.sum() < MIN_PIXELS_PER_ZONE:
            return None

        return round(float(np.nanmean(ndvi[valid])), 4)

    except Exception as exc:
        print(f"[SentinelCOG] Zone NDVI error: {exc}")
    return None


# ─────────────────────────────────────────────────────────────────────────────
#  NDVI status helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ndvi_to_status(ndvi: float) -> Dict:
    if ndvi >= 0.60:
        return {"status": "Excellent", "color": "#22c55e", "recommendation": None}
    if ndvi >= 0.45:
        return {"status": "Bon",       "color": "#84cc16", "recommendation": None}
    if ndvi >= 0.30:
        return {"status": "Stressé",   "color": "#f59e0b",
                "recommendation": "Rotation recommandée dans 7-10 jours"}
    return {"status": "Épuisé",        "color": "#ef4444",
            "recommendation": "Rotation immédiate — risque de surpâturage"}


# ─────────────────────────────────────────────────────────────────────────────
#  Main service
# ─────────────────────────────────────────────────────────────────────────────

class SentinelService:

    def __init__(self):
        self._scene_cache: Dict[str, Dict] = {}

    # ── MODIS tile helpers ────────────────────────────────────────────────────

    def get_modis_ndvi_tile_date(self) -> str:
        target = datetime.utcnow() - timedelta(days=20)
        soy = datetime(target.year, 1, 1)
        doy = (target - soy).days + 1
        period_start = ((doy - 1) // 8) * 8 + 1
        return (soy + timedelta(days=period_start - 1)).strftime("%Y-%m-%d")

    def get_ndvi_tile_url(self) -> str:
        date = self.get_modis_ndvi_tile_date()
        return (
            f"https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/"
            f"MODIS_Terra_NDVI_8Day/default/{date}/250m/{{z}}/{{y}}/{{x}}.png"
        )

    # ── Sentinel-2 STAC search ────────────────────────────────────────────────

    def search_latest_scene(self, lat: float, lon: float,
                             buffer: float = 0.12) -> Optional[Dict]:
        """Query Element84 Earth Search for the latest S2-L2A scene (no API key)."""
        cache_key = f"{round(lat, 2)}_{round(lon, 2)}"
        cached = self._scene_cache.get(cache_key)
        if cached and (datetime.now() - cached["fetched_at"]).total_seconds() < 5 * 86400:
            return cached["data"]

        bbox = [lon - buffer, lat - buffer, lon + buffer, lat + buffer]
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=90)

        try:
            resp = requests.post(
                f"{STAC_URL}/search",
                json={
                    "collections": ["sentinel-2-l2a"],
                    "bbox": bbox,
                    "datetime": (
                        f"{start_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}/"
                        f"{end_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}"
                    ),
                    "query": {"eo:cloud_cover": {"lt": 45}},
                    "sortby": [{"field": "datetime", "direction": "desc"}],
                    "limit": 1,
                },
                headers={"Content-Type": "application/json"},
                timeout=12,
            )
            if resp.status_code == 200:
                features = resp.json().get("features", [])
                if features:
                    f = features[0]
                    props = f.get("properties", {})
                    scene = {
                        "scene_id":          f["id"],
                        "acquisition_date":  props.get("datetime", ""),
                        "cloud_cover_pct":   round(props.get("eo:cloud_cover", 0), 1),
                        "platform":          props.get("platform", "sentinel-2"),
                        "processing_level":  "L2A",
                        "bbox":              f.get("bbox", []),
                        "data_source":       "Element84 Earth Search (STAC)",
                        "collection":        "sentinel-2-l2a",
                        "_assets":           f.get("assets", {}),   # keep for band URLs
                    }
                    self._scene_cache[cache_key] = {
                        "data": scene, "fetched_at": datetime.now()
                    }
                    return scene
        except requests.exceptions.Timeout:
            print("[SentinelSTAC] Timeout")
        except Exception as exc:
            print(f"[SentinelSTAC] Error: {exc}")
        return None

    # ── Band URL extraction ───────────────────────────────────────────────────

    def _band_urls(self, scene: Dict) -> Dict[str, str]:
        """Extract B04 and B08 COG href from the STAC item assets."""
        assets = scene.get("_assets", {})
        b04 = (assets.get("red") or assets.get("B04") or assets.get("b04") or {}).get("href")
        b08 = (assets.get("nir") or assets.get("B08") or assets.get("b08") or {}).get("href")
        return {"b04": b04, "b08": b08}

    # ── Real COG NDVI per zone ────────────────────────────────────────────────

    def _compute_real_ndvi(self, scene: Dict, zones: list) -> Dict[str, float]:
        """
        Downloads the first 4 MB of the B04 and B08 COG bands (HTTP range request),
        reads the overview tiles with tifffile (no GDAL), and computes mean NDVI
        for each zone polygon.  Returns {zone_id: ndvi_float}.
        """
        results: Dict[str, float] = {}
        if not zones:
            return results

        urls = self._band_urls(scene)
        if not urls.get("b04") or not urls.get("b08"):
            print("[SentinelCOG] Band URLs not found in STAC assets")
            return results

        print(f"[SentinelCOG] Downloading B04 overview from {urls['b04'][:60]}…")
        b04_bytes = _download_cog_head(urls["b04"])
        print(f"[SentinelCOG] Downloading B08 overview from {urls['b08'][:60]}…")
        b08_bytes = _download_cog_head(urls["b08"])

        if not b04_bytes or not b08_bytes:
            return results

        b04_info = _read_overview_array(b04_bytes)
        b08_info = _read_overview_array(b08_bytes)

        if not b04_info or not b08_info:
            print("[SentinelCOG] Could not parse overview — overview may be outside prefetch window")
            return results

        b04_arr, epsg, ox, oy, sx, sy = b04_info
        b08_arr = b08_info[0]

        # Align arrays if overview levels differ in size
        if b04_arr.shape != b08_arr.shape:
            from PIL import Image
            b08_pil = Image.fromarray(b08_arr).resize(
                (b04_arr.shape[1], b04_arr.shape[0]), Image.BILINEAR
            )
            b08_arr = np.array(b08_pil)

        for zone in zones:
            ndvi = _zone_mean_ndvi(b04_arr, b08_arr, epsg, ox, oy, sx, sy,
                                   zone.polygon_geojson)
            if ndvi is not None:
                results[zone.id] = ndvi

        print(f"[SentinelCOG] Real NDVI computed for {len(results)}/{len(zones)} zones")
        return results

    # ── Calibrated fallback (when COG read fails) ─────────────────────────────

    def _modeled_ndvi(self, polygon_geojson: str, scene: Optional[Dict]) -> float:
        try:
            geo = json.loads(polygon_geojson)
            coords = geo["coordinates"][0]
            center_lat = sum(c[1] for c in coords) / len(coords)
            center_lon = sum(c[0] for c in coords) / len(coords)
        except Exception:
            return 0.40

        if scene and scene.get("acquisition_date"):
            try:
                doy = datetime.strptime(
                    scene["acquisition_date"][:10], "%Y-%m-%d"
                ).timetuple().tm_yday
                cloud_pen = min(0.08, scene.get("cloud_cover_pct", 0) * 0.002)
            except Exception:
                doy = datetime.now().timetuple().tm_yday
                cloud_pen = 0.0
        else:
            doy = datetime.now().timetuple().tm_yday
            cloud_pen = 0.0

        lat_abs = abs(center_lat)
        peak = 172 if center_lat > 0 else 355
        if lat_abs < 10:
            base, amp = 0.75, 0.10
        elif lat_abs < 30:
            base, amp = 0.38, 0.24
        else:
            base, amp = 0.50, 0.38

        seasonal = amp * math.cos(2 * math.pi * (doy - peak) / 365)
        local    = (math.sin(center_lat * 1000) + math.cos(center_lon * 1000)) * 0.05
        return round(max(0.05, min(0.95, base + seasonal + local - cloud_pen)), 4)

    # ── Public entry point ────────────────────────────────────────────────────

    def analyze_zones(self, zones: list, lat: float, lon: float) -> Dict:
        """
        Full pipeline:
          - STAC scene search
          - Real COG NDVI read (tifffile + pyproj + numpy)
          - Per-zone fallback to calibrated model if COG read fails
        """
        scene = self.search_latest_scene(lat, lon)
        real_ndvi_map: Dict[str, float] = {}

        if scene:
            real_ndvi_map = self._compute_real_ndvi(scene, zones)

        zones_health = []
        for zone in zones:
            if zone.id in real_ndvi_map:
                ndvi      = real_ndvi_map[zone.id]
                is_real   = True
                anchored  = True
            else:
                ndvi      = self._modeled_ndvi(zone.polygon_geojson, scene)
                is_real   = False
                anchored  = scene is not None

            status_info = _ndvi_to_status(ndvi)
            zones_health.append({
                "zone_id":          zone.id,
                "zone_name":        zone.name,
                "ndvi":             ndvi,
                "is_real":          is_real,
                "anchored_to_scene": anchored,
                **status_info,
            })

        # Strip internal _assets key before sending to client
        clean_scene = {k: v for k, v in scene.items() if k != "_assets"} if scene else None

        return {
            "zones":          zones_health,
            "scene_info":     clean_scene,
            "ndvi_tile_url":  self.get_ndvi_tile_url(),
            "ndvi_tile_date": self.get_modis_ndvi_tile_date(),
            "data_providers": {
                "scene_metadata": "Sentinel-2 L2A — Element84 Earth Search (STAC)",
                "ndvi_values":    "Sentinel-2 L2A COG B04/B08 (tifffile + pyproj)"
                                  if real_ndvi_map
                                  else "Modèle calibré (fallback — COG hors fenêtre)",
                "ndvi_tiles":     "MODIS Terra NDVI 8-Day — NASA GIBS (WMTS)",
            },
        }


sentinel_service = SentinelService()
