from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.vancouver_opendata import views as vancouver_opendata_views

from . import views
from .crud_views import IncidentViewSet, RouteAlertViewSet, SavedRouteViewSet, UserProfileViewSet

router = DefaultRouter()
router.register(r'incidents', IncidentViewSet, basename='incident')
router.register(r'profile', UserProfileViewSet, basename='profile')
router.register(r'routes', SavedRouteViewSet, basename='route')
router.register(r'alerts', RouteAlertViewSet, basename='alert')

urlpatterns = [
    # Explicit views must come before the router include so they aren't swallowed
    # by the SavedRouteViewSet detail pattern (routes/{pk}/).
    path('health/', views.health, name='health'),
    path('query/', views.ai_incidents_query, name='ai-incidents-query'),
    path('routes/find/', views.find_route, name='routes-find'),
    path('lens/<str:lens>/', views.lens_geojson, name='lens-geojson'),
    path('', include(router.urls)),
    path(
        'datasets/',
        vancouver_opendata_views.opendata_all_datasets,
        name='opendata-all-datasets',
    ),
]
