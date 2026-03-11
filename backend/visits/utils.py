"""
GPS distance using Haversine formula. Returns distance in meters.
Travel validation: reject visits that would require impossible travel from the previous visit.
"""

import math
from datetime import timedelta

from django.utils import timezone


def haversine_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance between two (lat, lon) points in meters."""
    R = 6_371_000  # Earth radius in meters
    phi1 = math.radians(float(lat1))
    phi2 = math.radians(float(lat2))
    dphi = math.radians(float(lat2) - float(lat1))
    dlam = math.radians(float(lon2) - float(lon1))
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


# Max allowed distance (meters) for visit to be verified
MAX_VISIT_DISTANCE_METERS = 100


def check_travel_from_last_visit(
    officer_id,
    new_lat: float,
    new_lon: float,
    window_hours: float = 12.0,
    max_speed_kmh: float = 120.0,
):
    """
    If the officer has a visit within the last `window_hours`, ensure the new location
    is within a reasonable travel distance (max_speed_kmh). Returns (None, None) if allowed,
    else (error_message, extra_data dict for response).
    """
    from .models import Visit

    cutoff = timezone.now() - timedelta(hours=window_hours)
    last = (
        Visit.objects.filter(officer_id=officer_id)
        .order_by("-created_at")
        .values("latitude", "longitude", "created_at")
        .first()
    )
    if not last:
        return None, None
    created_at = last["created_at"]
    if timezone.is_naive(created_at):
        created_at = timezone.make_aware(created_at, timezone=timezone.get_current_timezone())
    if created_at < cutoff:
        return None, None

    prev_lat = float(last["latitude"])
    prev_lon = float(last["longitude"])
    elapsed = (timezone.now() - created_at).total_seconds()
    if elapsed <= 0:
        elapsed = 1  # avoid div by zero; treat as 1 second

    dist_m = haversine_meters(new_lat, new_lon, prev_lat, prev_lon)
    dist_km = dist_m / 1000.0
    time_hours = elapsed / 3600.0
    required_speed_kmh = dist_km / time_hours if time_hours > 0 else 0

    if required_speed_kmh <= max_speed_kmh:
        return None, None

    mins = int(elapsed / 60)
    return (
        (
            f"Visit rejected: this location is {dist_km:.1f} km from your last recorded visit "
            f"({mins} minutes ago). Travel at that time would not be possible. "
            f"Please record visits in the order and locations where you actually are."
        ),
        {
            "distance_km": round(dist_km, 2),
            "minutes_since_last_visit": mins,
            "last_visit_at": created_at.isoformat(),
        },
    )
