"""
Data migration: slow DriveBC polling from every 5 minutes to every 10 minutes.
Their public API rate-limits aggressive polling (429s seen at 5-min cadence).
"""

from django.db import migrations


def slow_drivebc_poll(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    every_10, _ = IntervalSchedule.objects.get_or_create(every=10, period="minutes")

    PeriodicTask.objects.filter(
        task="apps.core.tasks.poll_drivebc"
    ).update(interval=every_10)


def revert_drivebc_poll(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    every_5, _ = IntervalSchedule.objects.get_or_create(every=5, period="minutes")

    PeriodicTask.objects.filter(
        task="apps.core.tasks.poll_drivebc"
    ).update(interval=every_5)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_outagegeocode_bchydro_task"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.RunPython(slow_drivebc_poll, revert_drivebc_poll),
    ]
