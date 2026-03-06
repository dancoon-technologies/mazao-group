# Generated manually for ActivityTypeConfig and Visit.activity_type (no choices)

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('visits', '0005_visit_schedule'),
    ]

    operations = [
        migrations.CreateModel(
            name='ActivityTypeConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('value', models.SlugField(max_length=50, unique=True)),
                ('label', models.CharField(max_length=255)),
                ('departments', models.JSONField(blank=True, default=list, help_text='List of department slugs (e.g. mazao_na_afya, agritech). Empty = all departments.')),
                ('order', models.PositiveIntegerField(default=0, help_text='Display order in mobile')),
            ],
            options={
                'ordering': ['order', 'label'],
            },
        ),
        migrations.AlterField(
            model_name='visit',
            name='activity_type',
            field=models.CharField(
                default='farm_to_farm_visits',
                help_text='Value from ActivityTypeConfig (filtered by officer department).',
                max_length=50,
            ),
        ),
    ]
