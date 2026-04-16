import hashlib
import json

from django.core.cache import cache
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Incident, RouteAlert, SavedRoute, UserProfile
from .serializers import (
    IncidentSerializer,
    RouteAlertSerializer,
    SavedRouteSerializer,
    UserProfileSerializer,
)

INCIDENTS_LIST_CACHE_TTL = 30  # seconds


def incidents_list_cache_key(query_params: dict) -> str:
    """Stable cache key from sorted query params + generation counter."""
    gen = cache.get('incidents_list_gen', 0)
    params_str = json.dumps(sorted(query_params.items()), separators=(',', ':'))
    digest = hashlib.md5(params_str.encode()).hexdigest()[:12]
    return f'incidents_list:{gen}:{digest}'


def invalidate_incidents_list_cache():
    """
    Called by _upsert_incident after any write so the next list request
    hits the DB instead of returning stale data.
    Uses a generation counter: bumping it makes all existing cached keys
    unreachable without needing pattern-delete support.
    """
    cache.add('incidents_list_gen', 0)   # no-op if key already exists
    cache.incr('incidents_list_gen', delta=1)


class IncidentViewSet(viewsets.ModelViewSet):
    """
    CRUD for city incidents.
    GET    /api/incidents/                  — list all
    GET    /api/incidents/?source=user      — filter by source
    GET    /api/incidents/?incident_type=traffic
    GET    /api/incidents/?severity=high
    GET    /api/incidents/?status=active
    GET    /api/incidents/{id}/             — retrieve one
    POST   /api/incidents/                  — create
    PATCH  /api/incidents/{id}/             — partial update
    DELETE /api/incidents/{id}/             — delete
    POST   /api/incidents/{id}/verify/      — mark user report as verified
    """

    queryset = Incident.objects.all()
    serializer_class = IncidentSerializer
    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'location', 'description']
    ordering_fields = ['created_at', 'severity', 'incident_type']
    ordering = ['-created_at']

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        if source := params.get('source'):
            qs = qs.filter(source=source)
        if incident_type := params.get('incident_type'):
            qs = qs.filter(incident_type=incident_type)
        if severity := params.get('severity'):
            qs = qs.filter(severity=severity)
        if status := params.get('status'):
            qs = qs.filter(status=status)
        if verified := params.get('verified'):
            qs = qs.filter(verified=verified.lower() == 'true')

        return qs

    def list(self, request, *args, **kwargs):
        cache_key = incidents_list_cache_key(dict(request.query_params))
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(json.loads(cached))

        response = super().list(request, *args, **kwargs)
        cache.set(cache_key, json.dumps(response.data), timeout=INCIDENTS_LIST_CACHE_TTL)
        return response

    def perform_create(self, serializer):
        """Link the incident to the authenticated user if logged in."""
        user = self.request.user if self.request.user.is_authenticated else None
        serializer.save(reported_by=user)

    @action(detail=True, methods=['post'])
    def verify(self, request, pk=None):
        """Mark a user-reported incident as verified."""
        from django.utils import timezone
        incident = self.get_object()
        incident.verified = True
        incident.verified_at = timezone.now()
        incident.status = Incident.Status.ACTIVE
        incident.save()
        return Response(IncidentSerializer(incident).data)


class UserProfileViewSet(viewsets.ModelViewSet):
    """
    GET   /api/profile/     — get current user's profile
    PATCH /api/profile/     — update notification prefs
    """

    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserProfile.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SavedRouteViewSet(viewsets.ModelViewSet):
    """
    GET    /api/routes/           — list current user's routes
    POST   /api/routes/           — create a route
    PATCH  /api/routes/{id}/      — update a route
    DELETE /api/routes/{id}/      — delete a route
    GET    /api/routes/{id}/alerts/ — get alerts for a route
    """

    serializer_class = SavedRouteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return SavedRoute.objects.filter(user__user=self.request.user)

    def perform_create(self, serializer):
        profile = UserProfile.objects.get(user=self.request.user)
        serializer.save(user=profile)

    @action(detail=True, methods=['get'])
    def alerts(self, request, pk=None):
        """Get all alerts sent for this route."""
        route = self.get_object()
        alerts = RouteAlert.objects.filter(route=route).select_related('incident')
        return Response(RouteAlertSerializer(alerts, many=True).data)


class RouteAlertViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/alerts/       — list all alerts for current user's routes
    GET /api/alerts/{id}/  — retrieve one alert
    """

    serializer_class = RouteAlertSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RouteAlert.objects.filter(
            route__user__user=self.request.user
        ).select_related('incident', 'route')
