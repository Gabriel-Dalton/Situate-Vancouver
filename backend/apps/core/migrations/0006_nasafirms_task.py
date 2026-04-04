"""
Data migration: register the poll_nasafirms Celery Beat periodic task (every 3 hours).
FIRMS satellite data refreshes per orbit pass (~every 3 hours for VIIRS SNPP).
"""

from django.db import migrations


def add_nasafirms_task(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    every_3h, _ = IntervalSchedule.objects.get_or_create(every=180, period="minutes")

    PeriodicTask.objects.get_or_create(
        name="Poll NASA FIRMS — wildfire detections",
        defaults={
            "task": "apps.core.tasks.poll_nasafirms",
            "interval": every_3h,
            "enabled": True,
        },
    )


def remove_nasafirms_task(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(task="apps.core.tasks.poll_nasafirms").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0005_drivebc_poll_interval_10min"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(add_nasafirms_task, remove_nasafirms_task),
    ]
