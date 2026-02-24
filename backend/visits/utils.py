"""
GPS distance using Haversine formula. Returns distance in meters.
"""

import math


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
