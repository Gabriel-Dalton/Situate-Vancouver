"""
Schema migration: add OutageGeocode table.
Data migration: register the poll_bchydro Celery Beat periodic task (every 15 min).
"""

from django.db import migrations, models


def add_bchydro_task(apps, schema_editor):
    IntervalSchedule = apps.get_model("django_celery_beat", "IntervalSchedule")
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")

    every_15, _ = IntervalSchedule.objects.get_or_create(every=15, period="minutes")

    PeriodicTask.objects.get_or_create(
        name="Poll BC Hydro — power outages",
        defaults={
            "task": "apps.core.tasks.poll_bchydro",
            "interval": every_15,
            "enabled": True,
        },
    )


def remove_bchydro_task(apps, schema_editor):
    PeriodicTask = apps.get_model("django_celery_beat", "PeriodicTask")
    PeriodicTask.objects.filter(task="apps.core.tasks.poll_bchydro").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_create_periodic_tasks"),
        ("django_celery_beat", "0019_alter_periodictasks_options"),
    ]

    operations = [
        migrations.CreateModel(
            name="OutageGeocode",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("location_key", models.CharField(db_index=True, max_length=500, unique=True)),
                ("lat", models.FloatField(blank=True, null=True)),
                ("lng", models.FloatField(blank=True, null=True)),
                ("failed", models.BooleanField(db_index=True, default=False)),
                ("geocoded_at", models.DateTimeField(auto_now_add=True)),
                ("retried_at", models.DateTimeField(blank=True, null=True)),
            ],
            options={
                "verbose_name": "Outage Geocode Cache",
                "verbose_name_plural": "Outage Geocode Cache",
            },
        ),
        migrations.AddIndex(
            model_name="outagegeocode",
            index=models.Index(fields=["failed", "geocoded_at"], name="outagegeocode_failed_geocoded_idx"),
        ),
        migrations.RunPython(add_bchydro_task, remove_bchydro_task),
    ]
