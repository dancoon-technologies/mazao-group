from django.apps import AppConfig


class SiteConfigAppConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "site_config"
    verbose_name = "Site / environment config"
