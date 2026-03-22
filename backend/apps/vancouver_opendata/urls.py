from django.urls import path, re_path

from . import views

urlpatterns = [
    path('datasets/', views.datasets_list, name='vancouver-opendata-datasets'),
    re_path(
        r'^datasets/(?P<dataset_id>[a-zA-Z0-9_.@-]+)/records/$',
        views.dataset_records,
        name='vancouver-opendata-dataset-records',
    ),
    re_path(
        r'^datasets/(?P<dataset_id>[a-zA-Z0-9_.@-]+)/$',
        views.dataset_detail,
        name='vancouver-opendata-dataset-detail',
    ),
]
