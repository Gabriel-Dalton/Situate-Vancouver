from django.contrib import admin

from .models import Open511EventsSnapshot


@admin.register(Open511EventsSnapshot)
class Open511EventsSnapshotAdmin(admin.ModelAdmin):
    list_display = ('id', 'fetched_at')
    readonly_fields = ('id', 'payload', 'fetch_params', 'fetched_at')
