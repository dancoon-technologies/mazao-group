# PushDeliveryAttempt model for tracking push success/failure (admin)

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
        ("notifications", "0005_pushtoken"),
    ]

    operations = [
        migrations.CreateModel(
            name="PushDeliveryAttempt",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("token_prefix", models.CharField(help_text="First part of Expo token for debugging", max_length=50)),
                ("sent_at", models.DateTimeField(auto_now_add=True)),
                ("status", models.CharField(choices=[("success", "Success"), ("error", "Error")], max_length=20)),
                ("error_message", models.CharField(blank=True, max_length=255)),
                ("expo_ticket_id", models.CharField(blank=True, max_length=100)),
                (
                    "notification",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="push_attempts",
                        to="notifications.notification",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="push_delivery_attempts",
                        to="accounts.User",
                    ),
                ),
            ],
            options={
                "ordering": ["-sent_at"],
            },
        ),
        migrations.AddIndex(
            model_name="pushdeliveryattempt",
            index=models.Index(fields=["status"], name="pushattempt_status_idx"),
        ),
        migrations.AddIndex(
            model_name="pushdeliveryattempt",
            index=models.Index(fields=["user", "sent_at"], name="pushattempt_user_sent_idx"),
        ),
    ]
