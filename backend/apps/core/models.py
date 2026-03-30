import uuid
from django.contrib.auth.models import User
from django.db import models


class Incident(models.Model):

    class IncidentType(models.TextChoices):
        TRAFFIC = 'traffic', 'Traffic'
        CONSTRUCTION = 'construction', 'Construction'
        OBSTRUCTION = 'obstruction', 'Obstruction'
        WEATHER = 'weather', 'Weather'
        ACCIDENT = 'accident', 'Accident'
        EMERGENCY = 'emergency', 'Emergency'
        NATURAL_DISASTER = 'natural_disaster', 'Natural Disaster'
        POWER_OUTAGE = 'power_outage', 'Power Outage'
        GENERAL = 'general', 'General'

    class Severity(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        RESOLVED = 'resolved', 'Resolved'
        UNVERIFIED = 'unverified', 'Unverified'

    class Source(models.TextChoices):
        API = 'api', 'API'
        USER = 'user', 'User'

    class SourceAPI(models.TextChoices):
        DRIVEBC = 'drivebc', 'DriveBC'
        VANCOUVER_OPENDATA = 'vancouver_opendata', 'Vancouver Open Data'
        SERVICE_311 = '311', '311 Service Requests'
        TRANSLINK = 'translink', 'TransLink'
        WEATHERCAN = 'weathercan', 'WeatherCAN'
        BCHYDRO = 'bchydro', 'BC Hydro'

    # Primary key
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Core
    incident_type = models.CharField(
        max_length=32, choices=IncidentType.choices, db_index=True
    )
    severity = models.CharField(
        max_length=16, choices=Severity.choices, db_index=True
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.ACTIVE, db_index=True
    )
    title = models.CharField(max_length=255)
    description = models.TextField()

    # Location
    location = models.CharField(max_length=255, db_index=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    # Detail
    cause = models.TextField(blank=True)
    impact = models.TextField(blank=True)
    estimated_duration = models.CharField(max_length=255, blank=True)
    recommended_actions = models.JSONField(default=list)
    related_alerts = models.JSONField(default=list)
    confidence = models.FloatField(default=0.0)

    # Source tracking
    source = models.CharField(
        max_length=8, choices=Source.choices, db_index=True
    )
    source_api = models.CharField(
        max_length=32,
        choices=SourceAPI.choices,
        blank=True,
        help_text='Which upstream API this came from. Blank for user reports.',
    )
    external_id = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
        help_text='ID from the upstream API, used for deduplication.',
    )

    # User report fields
    reported_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='reported_incidents',
        help_text='Set for citizen reports. Null for API-sourced incidents.',
    )
    verified = models.BooleanField(
        default=False,
        db_index=True,
        help_text='True for API-sourced incidents. False by default for user reports.',
    )
    verified_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField(
        null=True, blank=True, help_text='Auto-expire time. Null means no expiry.'
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Incident'
        verbose_name_plural = 'Incidents'
        indexes = [
            models.Index(fields=['incident_type', 'status']),
            models.Index(fields=['source', 'verified']),
            models.Index(fields=['lat', 'lng']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['source_api', 'external_id'],
                condition=models.Q(external_id__gt=''),
                name='unique_external_incident',
            )
        ]

    def __str__(self):
        return f'[{self.severity.upper()}] {self.incident_type} — {self.location}'

    @property
    def is_user_reported(self):
        return self.source == self.Source.USER

    @property
    def is_api_sourced(self):
        return self.source == self.Source.API


class UserProfile(models.Model):

    class NotifyVia(models.TextChoices):
        EMAIL = 'email', 'Email'
        PUSH = 'push', 'Push Notification'
        SMS = 'sms', 'SMS'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    phone = models.CharField(max_length=20, blank=True)
    notify_via = models.CharField(
        max_length=8, choices=NotifyVia.choices, default=NotifyVia.PUSH
    )
    alert_lead_minutes = models.PositiveSmallIntegerField(
        default=30,
        help_text='How many minutes before departure to send route alerts.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Profile({self.user.username})'


class SavedRoute(models.Model):

    class Day(models.TextChoices):
        MON = 'mon', 'Monday'
        TUE = 'tue', 'Tuesday'
        WED = 'wed', 'Wednesday'
        THU = 'thu', 'Thursday'
        FRI = 'fri', 'Friday'
        SAT = 'sat', 'Saturday'
        SUN = 'sun', 'Sunday'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        UserProfile, on_delete=models.CASCADE, related_name='saved_routes'
    )
    name = models.CharField(max_length=100, help_text='e.g. "Morning Commute"')

    # Origin
    origin_label = models.CharField(max_length=255, help_text='e.g. "Home"')
    origin_lat = models.FloatField()
    origin_lng = models.FloatField()

    # Destination
    destination_label = models.CharField(max_length=255, help_text='e.g. "Office"')
    destination_lat = models.FloatField()
    destination_lng = models.FloatField()

    # Schedule
    departure_time = models.TimeField(help_text='Daily departure time, e.g. 08:30')
    active_days = models.JSONField(
        default=list,
        help_text='List of active days e.g. ["mon","tue","wed","thu","fri"]',
    )

    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['departure_time']
        verbose_name = 'Saved Route'
        verbose_name_plural = 'Saved Routes'

    def __str__(self):
        return f'{self.user.user.username} — {self.name} ({self.departure_time})'


class RouteAlert(models.Model):

    class AlertType(models.TextChoices):
        WARNING = 'warning', 'Warning'
        UPDATE = 'update', 'Update'
        CLEAR = 'clear', 'Clear'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    route = models.ForeignKey(
        SavedRoute, on_delete=models.CASCADE, related_name='alerts'
    )
    incident = models.ForeignKey(
        Incident, on_delete=models.CASCADE, related_name='route_alerts'
    )
    alert_type = models.CharField(
        max_length=8, choices=AlertType.choices, default=AlertType.WARNING
    )
    sent_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-sent_at']
        verbose_name = 'Route Alert'
        verbose_name_plural = 'Route Alerts'
        # Prevent sending the same alert for the same incident + route twice
        constraints = [
            models.UniqueConstraint(
                fields=['route', 'incident', 'alert_type'],
                name='unique_route_incident_alert',
            )
        ]

    def __str__(self):
        return f'{self.alert_type.upper()} → {self.route.name} re: {self.incident}'


class OutageGeocode(models.Model):
    """
    Permanent geocode cache for BC Hydro outage location strings.

    Each unique location string from the BC Hydro RSS feed is geocoded once
    via Nominatim and stored here forever. We never pay the geocoding cost
    twice for the same location.
    """

    # Normalised location string as it appears in the RSS (e.g. "Kitsilano, Vancouver")
    location_key = models.CharField(max_length=500, unique=True, db_index=True)

    # Resolved coordinates — null if geocoding returned no results
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)

    # If True, Nominatim returned no results; retry after GEOCODE_RETRY_DAYS
    failed = models.BooleanField(default=False, db_index=True)
    geocoded_at = models.DateTimeField(auto_now_add=True)
    retried_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Outage Geocode Cache'
        verbose_name_plural = 'Outage Geocode Cache'
        indexes = [
            models.Index(fields=['failed', 'geocoded_at']),
        ]

    def __str__(self):
        if self.lat and self.lng:
            return f'{self.location_key} → ({self.lat:.4f}, {self.lng:.4f})'
        return f'{self.location_key} → [no result]'
