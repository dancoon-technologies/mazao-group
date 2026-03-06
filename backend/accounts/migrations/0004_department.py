# Department model and seed from User.Department.choices

from django.db import migrations, models


def seed_departments(apps, schema_editor):
    Department = apps.get_model("accounts", "Department")
    # Same as User.Department.choices
    for slug, name in [
        ("mazao_na_afya", "Mazao na afya"),
        ("agritech", "Agritech"),
        ("agripriize", "AgriPriize"),
    ]:
        Department.objects.get_or_create(slug=slug, defaults={"name": name})


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0003_remove_user_region"),
    ]

    operations = [
        migrations.CreateModel(
            name="Department",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=30, unique=True)),
                ("name", models.CharField(max_length=80)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.RunPython(seed_departments, migrations.RunPython.noop),
    ]
