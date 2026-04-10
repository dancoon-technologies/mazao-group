"""Persist mobile Expo app version / EAS Update metadata from auth request bodies."""

from __future__ import annotations

from typing import Any, Mapping

from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()

_META_KEYS: tuple[tuple[str, str, int], ...] = (
    ("app_version", "app_client_version", 32),
    ("app_native_build", "app_native_build", 32),
    ("app_update_id", "app_update_id", 80),
    ("app_update_channel", "app_update_channel", 64),
)


def save_app_client_meta_from_request_data(user: User | None, data: Mapping[str, Any] | None) -> None:
    """
    Update user app-client fields when the client includes known keys (login or refresh).
    Only keys present in ``data`` are written (partial updates).
    Sets ``app_client_reported_at`` when at least one known key is present.
    """
    if user is None or not getattr(user, "pk", None) or not data:
        return
    updates: dict[str, Any] = {}
    any_key = False
    for json_key, model_field, max_len in _META_KEYS:
        if json_key not in data:
            continue
        any_key = True
        raw = data.get(json_key)
        val = (raw if isinstance(raw, str) else ("" if raw is None else str(raw))).strip()[:max_len]
        updates[model_field] = val
    if not any_key:
        return
    updates["app_client_reported_at"] = timezone.now()
    User.objects.filter(pk=user.pk).update(**updates)
