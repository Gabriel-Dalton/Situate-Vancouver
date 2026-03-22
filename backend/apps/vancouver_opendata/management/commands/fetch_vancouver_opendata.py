"""
Download Vancouver Open Data catalog, per-dataset metadata, and records into a data directory.

Explore API caps record pagination: offset + limit must stay below 10_000, so at most ~9_900
rows are fetched per dataset via this command unless extended later (exports, filters).
"""

from __future__ import annotations

import json
from argparse import ArgumentParser
from pathlib import Path
from typing import Any

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.vancouver_opendata.ckan_probe import build_ckan_client
from apps.vancouver_opendata.exceptions import VancouverOpenDataConfigurationError, VancouverOpenDataError

_CATALOG_TIMEOUT_SECONDS = 120.0
_RECORDS_PAGE_SIZE = 100
# Same window as Explore catalog/records (offset + limit < this bound).
_RECORDS_OFFSET_LIMIT_SUM_MAX = 10000


def _dataset_id_from_catalog_row(row: Any) -> str | None:
    if not isinstance(row, dict):
        return None
    did = row.get('dataset_id')
    if isinstance(did, str) and did.strip():
        return did.strip()
    alt = row.get('id')
    if isinstance(alt, str) and alt.strip():
        return alt.strip()
    return None


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=False) + '\n',
        encoding='utf-8',
    )


class Command(BaseCommand):
    help = (
        'Fetch Vancouver Open Data catalog, dataset metadata, and records into a folder '
        f'(default: {settings.REPO_ROOT / "data" / "vancouver_opendata"}). '
        'Requires VANCOUVER_OPENDATA_API_KEY.'
    )

    def add_arguments(self, parser: ArgumentParser) -> None:
        default_out = settings.REPO_ROOT / 'data' / 'vancouver_opendata'
        parser.add_argument(
            '--output',
            '-o',
            type=Path,
            default=default_out,
            help=f'Output directory (default: {default_out})',
        )
        parser.add_argument(
            '--metadata-only',
            action='store_true',
            help='Skip downloading records (catalog + metadata only).',
        )
        parser.add_argument(
            '--max-datasets',
            type=int,
            default=None,
            metavar='N',
            help='Process at most N datasets after catalog fetch (for testing).',
        )
        parser.add_argument(
            '--timeout',
            type=float,
            default=_CATALOG_TIMEOUT_SECONDS,
            help=f'HTTP timeout in seconds for the API client (default: {_CATALOG_TIMEOUT_SECONDS}).',
        )

    def handle(self, *args: Any, **options: Any) -> None:
        output_dir = Path(options['output']).expanduser().resolve()
        metadata_only: bool = options['metadata_only']
        max_datasets: int | None = options['max_datasets']
        timeout: float = float(options['timeout'])

        try:
            client = build_ckan_client(timeout_seconds=timeout)
        except VancouverOpenDataConfigurationError as exc:
            raise CommandError(str(exc)) from exc

        output_dir.mkdir(parents=True, exist_ok=True)

        self.stdout.write(f'Fetching catalog into {output_dir} ...')
        try:
            catalog = client.catalog_list_all_datasets()
        except VancouverOpenDataError as exc:
            raise CommandError(str(exc)) from exc

        _write_json(output_dir / 'catalog.json', catalog)

        if catalog.get('truncated'):
            self.stdout.write(
                self.style.WARNING(
                    'Catalog list may be truncated by the portal offset/limit window; '
                    'see catalog.json "truncated".',
                ),
            )

        rows = catalog.get('results')
        if not isinstance(rows, list):
            raise CommandError('Catalog response missing a list "results".')

        dataset_ids: list[str] = []
        for row in rows:
            did = _dataset_id_from_catalog_row(row)
            if did:
                dataset_ids.append(did)

        if max_datasets is not None:
            dataset_ids = dataset_ids[: max(0, max_datasets)]

        self.stdout.write(f'Processing {len(dataset_ids)} dataset(s) ...')

        for i, dataset_id in enumerate(dataset_ids, start=1):
            ds_dir = output_dir / dataset_id
            ds_dir.mkdir(parents=True, exist_ok=True)

            try:
                meta = client.catalog_get_dataset(dataset_id)
            except VancouverOpenDataError as exc:
                self.stderr.write(self.style.ERROR(f'[{i}/{len(dataset_ids)}] {dataset_id}: metadata: {exc}'))
                continue

            _write_json(ds_dir / 'metadata.json', meta)

            if metadata_only:
                self.stdout.write(f'[{i}/{len(dataset_ids)}] {dataset_id}: metadata only')
                continue

            records_path = ds_dir / 'records.jsonl'
            meta_path = ds_dir / 'records_meta.json'
            total_portal: int | None = None
            fetched = 0
            offset = 0
            hit_window_limit = False

            try:
                with records_path.open('w', encoding='utf-8') as f:
                    while offset + _RECORDS_PAGE_SIZE < _RECORDS_OFFSET_LIMIT_SUM_MAX:
                        batch = client.dataset_query_records(
                            dataset_id,
                            limit=_RECORDS_PAGE_SIZE,
                            offset=offset,
                        )
                        if total_portal is None:
                            tc = batch.get('total_count')
                            if isinstance(tc, int):
                                total_portal = tc

                        results = batch.get('results')
                        if not isinstance(results, list):
                            break

                        for rec in results:
                            f.write(json.dumps(rec, ensure_ascii=False) + '\n')
                            fetched += 1

                        if len(results) < _RECORDS_PAGE_SIZE:
                            break
                        if total_portal is not None and fetched >= total_portal:
                            break

                        offset += _RECORDS_PAGE_SIZE
                    else:
                        hit_window_limit = True

                fetch_truncated = hit_window_limit or (
                    total_portal is not None and fetched < total_portal
                )

                _write_json(
                    meta_path,
                    {
                        'dataset_id': dataset_id,
                        'portal_total_count': total_portal,
                        'fetched_count': fetched,
                        'fetch_truncated': fetch_truncated,
                        'note': (
                            'Records are paginated via Explore API; '
                            'offset+limit must stay below 10000, so large datasets may be incomplete.'
                        ),
                    },
                )

            except VancouverOpenDataError as exc:
                self.stderr.write(self.style.ERROR(f'[{i}/{len(dataset_ids)}] {dataset_id}: records: {exc}'))
                if records_path.exists():
                    records_path.unlink(missing_ok=True)
                if meta_path.exists():
                    meta_path.unlink(missing_ok=True)
                continue

            self.stdout.write(
                f'[{i}/{len(dataset_ids)}] {dataset_id}: metadata + {fetched} record row(s)'
                + (' (truncated)' if fetch_truncated else ''),
            )

        self.stdout.write(self.style.SUCCESS('Done.'))
