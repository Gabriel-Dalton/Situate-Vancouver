"""Stored snapshot of Open511 BC /events (refreshed by a scheduled management command)."""

from __future__ import annotations

from django.db import models


class Open511EventsSnapshot(models.Model):
    """
    Single-row table (always ``pk=1``): last successful /events JSON from Open511 BC.

    Refresh periodically with:
        python manage.py refresh_open511_events

    Recommended cron (every 5 minutes):
        */5 * * * * cd /path/to/backend && python manage.py refresh_open511_events
    """

    id = models.PositiveSmallIntegerField(primary_key=True, default=1)
    payload = models.JSONField(help_text='Full Open511 /events JSON object returned by DriveBC.')
    fetch_params = models.JSONField(
        default=dict,
        blank=True,
        help_text='Query parameters sent to the upstream /events request.',
    )
    fetched_at = models.DateTimeField(db_index=True)

    class Meta:
        verbose_name = 'Open511 events snapshot'
        verbose_name_plural = 'Open511 events snapshots'

    def save(self, *args, **kwargs) -> None:
        self.pk = 1
        super().save(*args, **kwargs)
