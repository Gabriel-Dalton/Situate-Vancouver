from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.vancouver_opendata import views as vancouver_opendata_views

from . import views
from .auth_views import (
    login,
    logout,
    me,
    password_forgot,
    password_reset,
    refresh,
    register,
    verify_email_confirm,
    verify_email_request,
)
from .crud_views import IncidentViewSet, RouteAlertViewSet, SavedRouteViewSet, UserProfileViewSet

router = DefaultRouter()
router.register(r'incidents', IncidentViewSet, basename='incident')
router.register(r'profile', UserProfileViewSet, basename='profile')
router.register(r'routes', SavedRouteViewSet, basename='route')
router.register(r'alerts', RouteAlertViewSet, basename='alert')

auth_urlpatterns = [
    path('register/', register, name='auth-register'),
    path('login/', login, name='auth-login'),
    path('refresh/', refresh, name='auth-refresh'),
    path('logout/', logout, name='auth-logout'),
    path('me/', me, name='auth-me'),
    path('password/forgot/', password_forgot, name='auth-password-forgot'),
    path('password/reset/', password_reset, name='auth-password-reset'),
    path('verify-email/request/', verify_email_request, name='auth-verify-email-request'),
    path('verify-email/confirm/', verify_email_confirm, name='auth-verify-email-confirm'),
]

urlpatterns = [
    # Auth endpoints
    path('auth/', include(auth_urlpatterns)),
    # Explicit views must come before the router include so they aren't swallowed
    # by the SavedRouteViewSet detail pattern (routes/{pk}/).
    path('health/', views.health, name='health'),
    path('query/', views.ai_incidents_query, name='ai-incidents-query'),
    path('routes/find/', views.find_route, name='routes-find'),
    path('lens/<str:lens>/', views.lens_geojson, name='lens-geojson'),
    path('outages/', views.outages_geojson, name='outages-geojson'),
    path('cameras/', views.cameras_geojson, name='cameras-geojson'),
    path('events/', views.events_geojson, name='events-geojson'),
    path('', include(router.urls)),
    path(
        'datasets/',
        vancouver_opendata_views.opendata_all_datasets,
        name='opendata-all-datasets',
    ),
]
