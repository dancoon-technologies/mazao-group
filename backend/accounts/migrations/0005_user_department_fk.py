# Switch User.department from CharField to ForeignKey(Department)

from django.db import migrations, models


def migrate_department_slug_to_fk(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    Department = apps.get_model("accounts", "Department")
    for user in User.objects.all():
        slug = getattr(user, "department", None) or ""
        if not slug:
            continue
        try:
            dept = Department.objects.get(slug=slug)
            user.department_new_id = dept.pk
            user.save(update_fields=["department_new_id"])
        except Department.DoesNotExist:
            pass


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0004_department"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="department_new",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="users",
                to="accounts.department",
            ),
        ),
        migrations.RunPython(migrate_department_slug_to_fk, noop_reverse),
        migrations.RemoveField(
            model_name="user",
            name="department",
        ),
        migrations.RenameField(
            model_name="user",
            old_name="department_new",
            new_name="department",
        ),
    ]
