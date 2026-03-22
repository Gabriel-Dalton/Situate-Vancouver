from django.urls import path

from . import views

urlpatterns = [
    path('', views.open511_discovery, name='open511-bc-discovery'),
    path('events/', views.open511_events, name='open511-bc-events'),
    path('events/cached/', views.open511_events_cached, name='open511-bc-events-cached'),
    path('areas/', views.open511_areas, name='open511-bc-areas'),
    path('jurisdiction/', views.open511_jurisdiction, name='open511-bc-jurisdiction'),
    path(
        'jurisdictiongeography/',
        views.open511_jurisdiction_geography,
        name='open511-bc-jurisdiction-geography',
    ),
]
