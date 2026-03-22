"""Management command: fetch Open511 BC /events and persist as a DB snapshot."""

from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.open511_bc.client import Open511BCClient
from apps.open511_bc.exceptions import Open511BCError
from apps.open511_bc.models import Open511EventsSnapshot


class Command(BaseCommand):
    help = (
        'Fetch all active events from api.open511.gov.bc.ca and store as a local snapshot. '
        'Run on a cron matching OPEN511_EVENTS_CACHE_STALE_AFTER_SECONDS (default every 5 min).'
    )

    def add_arguments(self, parser) -> None:
        parser.add_argument(
            '--limit',
            type=int,
            default=500,
            metavar='N',
            help='Max events per upstream request (1–500, default: 500).',
        )
        parser.add_argument(
            '--event-type',
            dest='event_type',
            default='',
            metavar='TYPE',
            help='Optional: filter by event_type (e.g. INCIDENT, CONSTRUCTION).',
        )
        parser.add_argument(
            '--bbox',
            default='',
            metavar='BBOX',
            help='Optional: bounding box filter "xmin,ymin,xmax,ymax" (e.g. Metro Vancouver).',
        )

    def handle(self, *args, **options) -> None:
        limit = max(1, min(options['limit'], 500))

        params: dict[str, str] = {'limit': str(limit)}
        if options['event_type']:
            params['event_type'] = options['event_type']
        if options['bbox']:
            params['bbox'] = options['bbox']

        self.stdout.write(f'Fetching Open511 BC /events (params={params}) …')

        client = Open511BCClient(
            settings.OPEN511_BC_BASE_URL,
            timeout_seconds=float(settings.OPEN511_BC_TIMEOUT_SECONDS),
            enforce_host_allowlist=settings.OPEN511_BC_ENFORCE_HOST_ALLOWLIST,
        )

        try:
            raw = client.fetch_resource('events', params)
        except Open511BCError as exc:
            raise CommandError(f'Could not fetch Open511 events: {exc}') from exc

        event_count = len(raw.get('events') or [])
        now = timezone.now()

        Open511EventsSnapshot.objects.update_or_create(
            pk=1,
            defaults={
                'payload': raw,
                'fetch_params': params,
                'fetched_at': now,
            },
        )

        self.stdout.write(
            self.style.SUCCESS(
                f'Snapshot saved: {event_count} events, fetched_at={now.isoformat()}',
            ),
        )
