"""
GPS validation for extension officers: ensure device is at/near the farm
and (optionally) in the correct admin area via reverse geocoding.
"""
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Max allowed distance (meters) between device position and farm position.
MAX_DISTANCE_METERS = 500

# Nominatim: 1 request per second when no User-Agent; we use a simple one.
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "MazaoGroup/1.0 (farm location validation)"


def _haversine_meters(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    """Return distance in meters between two WGS84 points."""
    import math
    R = 6_371_000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def _normalize_name(name: Optional[str]) -> str:
    if name is None:
        return ""
    return name.strip().lower()


def validate_device_near_farm(
    device_lat: float,
    device_lon: float,
    farm_lat: float,
    farm_lon: float,
    max_meters: float = MAX_DISTANCE_METERS,
) -> Tuple[bool, str]:
    """
    Check that device is within max_meters of the farm.
    Returns (True, "") if valid, (False, error_message) otherwise.
    """
    distance = _haversine_meters(
        float(device_lat), float(device_lon),
        float(farm_lat), float(farm_lon),
    )
    if distance <= max_meters:
        return True, ""
    return (
        False,
        f"Your device must be within {int(max_meters)} m of the farm. "
        f"Current distance: about {int(distance)} m.",
    )


def reverse_geocode_region_county(lat: float, lon: float) -> Tuple[Optional[str], Optional[str]]:
    """
    Call Nominatim reverse geocode; return (region_name, county_name) for Kenya.
    OSM address may have 'state' (often region) and 'county'. Returns (None, None) on failure.
    """
    params = urllib.parse.urlencode({
        "format": "json",
        "lat": lat,
        "lon": lon,
        "addressdetails": 1,
        "zoom": 10,
    })
    url = f"{NOMINATIM_URL}?{params}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as e:
        logger.warning("Reverse geocode failed for (%s, %s): %s", lat, lon, e)
        return None, None
    addr = data.get("address") or {}
    # Kenya: often state = region, county = county; sometimes only state/county present.
    state = addr.get("state")
    county = addr.get("county")
    # If we only have one, use it for both; backend will match flexibly.
    region_name = state or county
    county_name = county or state
    return region_name, county_name


def validate_device_in_admin_area(
    device_lat: float,
    device_lon: float,
    expected_region_name: str,
    expected_county_name: str,
) -> Tuple[bool, str]:
    """
    Reverse geocode device position and check it matches expected region/county (by name).
    If reverse geocode fails, we allow (don't block on third-party API). Sub-county not checked.
    Returns (True, "") if valid or geocode failed; (False, error_message) if mismatch.
    """
    region_name, county_name = reverse_geocode_region_county(device_lat, device_lon)
    if region_name is None and county_name is None:
        return True, ""  # Don't block on API failure
    exp_region = _normalize_name(expected_region_name)
    exp_county = _normalize_name(expected_county_name)
    got_region = _normalize_name(region_name)
    got_county = _normalize_name(county_name)
    # Match if expected county matches resolved county (or state), and expected region matches resolved region (or county).
    county_ok = exp_county in (got_county, got_region) or got_county in (exp_county, exp_region)
    region_ok = exp_region in (got_region, got_county) or got_region in (exp_region, exp_county)
    if county_ok and region_ok:
        return True, ""
    return (
        False,
        "Your current location does not match the selected region/county. "
        "Please ensure you are in the correct area or adjust the farm location.",
    )
