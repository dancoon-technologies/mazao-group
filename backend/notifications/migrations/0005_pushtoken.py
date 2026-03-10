# PushToken model for Expo push notifications

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0004_reduce_charfield_lengths"),
    ]

    operations = [
        migrations.CreateModel(
            name="PushToken",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("token", models.CharField(max_length=256, unique=True)),
                ("device_id", models.CharField(blank=True, max_length=128)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="push_tokens",
                        to="accounts.User",
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
        migrations.AddIndex(
            model_name="pushtoken",
            index=models.Index(fields=["user"], name="pushtoken_user_idx"),
        ),
    ]
