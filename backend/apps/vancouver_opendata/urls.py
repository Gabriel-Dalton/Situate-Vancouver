from django.urls import path

from . import views

urlpatterns = [
    path('datasets/', views.datasets_list, name='vancouver-opendata-datasets'),
]
