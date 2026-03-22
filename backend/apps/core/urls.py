from django.urls import path

from apps.vancouver_opendata import views as vancouver_opendata_views

from . import views

urlpatterns = [
    path('health/', views.health, name='health'),
    path('query/', views.ai_incidents_query, name='ai-incidents-query'),
    path(
        'datasets/',
        vancouver_opendata_views.opendata_all_datasets,
        name='opendata-all-datasets',
    ),
]
