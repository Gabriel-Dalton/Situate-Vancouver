from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .health_checks import collect_health_checks


@api_view(['GET'])
@permission_classes([AllowAny])
def health(request):
    """
    Single aggregate health endpoint: Django, Vancouver Open Data (CKAN), AI service.
    """
    payload = collect_health_checks()
    http_status = (
        status.HTTP_503_SERVICE_UNAVAILABLE
        if payload['status'] == 'unhealthy'
        else status.HTTP_200_OK
    )
    return Response(payload, status=http_status)
