"""
Data migration: create Celery Beat periodic tasks for all polling jobs.
Schedules:
  poll_drivebc            — every 5 minutes
  poll_vancouver_opendata — every 30 minutes
  poll_surrey             — every 30 minutes
  expire_incidents        — every 60 minutes
"""

from django.db import migrations


def create_periodic_tasks(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    every_5, _ = IntervalSchedule.objects.get_or_create(
        every=5, period="minutes"
    )
    every_30, _ = IntervalSchedule.objects.get_or_create(
        every=30, period="minutes"
    )
    every_60, _ = IntervalSchedule.objects.get_or_create(
        every=60, period="minutes"
    )

    tasks = [
        {
            "name": "Poll DriveBC — live incidents",
            "task": "apps.core.tasks.poll_drivebc",
            "interval": every_5,
        },
        {
            "name": "Poll Vancouver Open Data — closures & construction",
            "task": "apps.core.tasks.poll_vancouver_opendata",
            "interval": every_30,
        },
        {
            "name": "Poll Surrey — capital construction projects",
            "task": "apps.core.tasks.poll_surrey",
            "interval": every_30,
        },
        {
            "name": "Expire resolved incidents",
            "task": "apps.core.tasks.expire_incidents",
            "interval": every_60,
        },
    ]

    for t in tasks:
        PeriodicTask.objects.get_or_create(
            name=t["name"],
            defaults={
                "task": t["task"],
                "interval": t["interval"],
                "enabled": True,
            },
        )


def delete_periodic_tasks(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(
        task__in=[
            "apps.core.tasks.poll_drivebc",
            "apps.core.tasks.poll_vancouver_opendata",
            "apps.core.tasks.poll_surrey",
            "apps.core.tasks.expire_incidents",
        ]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_alter_incident_reported_by_userprofile_savedroute_and_more"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(create_periodic_tasks, delete_periodic_tasks),
    ]
