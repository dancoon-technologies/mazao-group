from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_user_current_refresh_jti"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="current_access_jti",
            field=models.CharField(max_length=255, blank=True, editable=False),
        ),
    ]

