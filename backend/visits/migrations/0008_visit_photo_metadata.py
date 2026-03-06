# Photo metadata: when/where/device the photo was taken

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('visits', '0007_seed_activity_type_config'),
    ]

    operations = [
        migrations.AddField(
            model_name='visit',
            name='photo_taken_at',
            field=models.DateTimeField(blank=True, help_text='Device timestamp when the photo was captured (ISO from mobile).', null=True),
        ),
        migrations.AddField(
            model_name='visit',
            name='photo_device_info',
            field=models.CharField(blank=True, help_text='Device model and OS (e.g. iPhone 14, iOS 17).', max_length=255),
        ),
        migrations.AddField(
            model_name='visit',
            name='photo_place_name',
            field=models.CharField(blank=True, help_text="Place label (e.g. farm village or 'Farmer location').", max_length=255),
        ),
    ]
