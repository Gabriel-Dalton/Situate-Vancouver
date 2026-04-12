"""
Data migration: register the poll_border_wait Celery Beat periodic task (every 15 min).
CBP Border Wait Times API updates every ~15 minutes.
"""

from django.db import migrations


def add_border_task(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    every_15, _ = IntervalSchedule.objects.get_or_create(every=15, period="minutes")

    PeriodicTask.objects.get_or_create(
        name="Poll CBP — US/Canada border wait times",
        defaults={
            "task": "apps.core.tasks.poll_border_wait",
            "interval": every_15,
            "enabled": True,
        },
    )


def remove_border_task(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(task="apps.core.tasks.poll_border_wait").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_usgs_earthquakes_task"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(add_border_task, remove_border_task),
    ]
