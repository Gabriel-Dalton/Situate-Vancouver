"""
Data migration: register the poll_usgs_earthquakes Celery Beat periodic task (every 30 min).
USGS updates every minute but M2.5+ events near Vancouver are infrequent.
"""

from django.db import migrations


def add_usgs_task(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    every_30, _ = IntervalSchedule.objects.get_or_create(every=30, period="minutes")

    PeriodicTask.objects.get_or_create(
        name="Poll USGS — earthquakes near Vancouver",
        defaults={
            "task": "apps.core.tasks.poll_usgs_earthquakes",
            "interval": every_30,
            "enabled": True,
        },
    )


def remove_usgs_task(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(task="apps.core.tasks.poll_usgs_earthquakes").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_nasafirms_task"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(add_usgs_task, remove_usgs_task),
    ]
