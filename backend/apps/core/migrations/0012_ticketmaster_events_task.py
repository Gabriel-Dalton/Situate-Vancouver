"""
Data migration: schedule the Ticketmaster events cache refresh task once a day.
"""

from django.db import migrations


def add_events_task(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    every_day, _ = IntervalSchedule.objects.get_or_create(every=1440, period="minutes")

    PeriodicTask.objects.get_or_create(
        name="Refresh Ticketmaster events cache — daily",
        defaults={
            "task": "apps.core.tasks.refresh_events_cache",
            "interval": every_day,
            "enabled": True,
        },
    )


def remove_events_task(apps, schema_editor):
    apps.get_model("django_celery_beat", "PeriodicTask").objects.filter(
        name="Refresh Ticketmaster events cache — daily"
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0011_rename_outagegeocode_failed_geocoded_idx_core_outage_failed_17e7b1_idx_and_more"),
        ("django_celery_beat", "0006_periodictask_expire_seconds"),
    ]

    operations = [
        migrations.RunPython(add_events_task, reverse_code=remove_events_task),
    ]
