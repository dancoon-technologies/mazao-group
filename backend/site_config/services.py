"""
Read site config from DB (admin-editable). Use these helpers for values editable in admin.
When no SiteConfig row exists, in-code defaults are used.
"""

from .models import SiteConfig

# Defaults used when no SiteConfig row exists (e.g. before first seed/migration)
_DEFAULT_VISIT_MAX_DISTANCE_METERS = 100
_DEFAULT_VISIT_WARNING_DISTANCE_METERS = 80
_DEFAULT_VISIT_TRAVEL_VALIDATION_WINDOW_HOURS = 12.0
_DEFAULT_VISIT_MAX_TRAVEL_SPEED_KMH = 120.0
_DEFAULT_VISIT_PHOTO_MAX_SIZE_MB = 5


def _get_config():
    return SiteConfig.objects.first()


def get_visit_max_distance_meters():
    c = _get_config()
    if c is not None:
        return c.visit_max_distance_meters
    return _DEFAULT_VISIT_MAX_DISTANCE_METERS


def get_visit_warning_distance_meters():
    c = _get_config()
    if c is not None:
        return c.visit_warning_distance_meters
    return _DEFAULT_VISIT_WARNING_DISTANCE_METERS


def get_visit_travel_validation_window_hours():
    c = _get_config()
    if c is not None:
        return float(c.visit_travel_validation_window_hours)
    return _DEFAULT_VISIT_TRAVEL_VALIDATION_WINDOW_HOURS


def get_visit_max_travel_speed_kmh():
    c = _get_config()
    if c is not None:
        return float(c.visit_max_travel_speed_kmh)
    return _DEFAULT_VISIT_MAX_TRAVEL_SPEED_KMH


def get_visit_photo_max_size_mb():
    c = _get_config()
    if c is not None:
        return c.visit_photo_max_size_mb
    return _DEFAULT_VISIT_PHOTO_MAX_SIZE_MB


def get_partner_label():
    """Label for the person/entity (e.g. Farmer, Stockist). Used in UI and messages."""
    c = _get_config()
    if c is not None and (c.partner_label or "").strip():
        return (c.partner_label or "").strip()
    return "Farmer"


def get_location_label():
    """Label for the location/plot (e.g. Farm, Outlet). Used in UI and messages."""
    c = _get_config()
    if c is not None and (c.location_label or "").strip():
        return (c.location_label or "").strip()
    return "Farm"


def get_labels_for_user(user):
    """
    Return (partner_label, location_label) for the user's department.
    Uses DepartmentTerminology when the user has a department with a terminology row;
    otherwise falls back to SiteConfig (get_partner_label / get_location_label).
    """
    from .models import DepartmentTerminology

    if user and getattr(user, "department_id", None):
        try:
            term = DepartmentTerminology.objects.get(department_id=user.department_id)
            partner = (term.partner_label or "").strip() or "Farmer"
            location = (term.location_label or "").strip() or "Farm"
            return (partner, location)
        except DepartmentTerminology.DoesNotExist:
            pass
    return (get_partner_label(), get_location_label())
