from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Incident, RouteAlert, SavedRoute, UserProfile


class IncidentSerializer(serializers.ModelSerializer):
    is_user_reported = serializers.BooleanField(read_only=True)

    class Meta:
        model = Incident
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at', 'verified_at']


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class UserProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = UserProfile
        fields = ['id', 'user', 'phone', 'notify_via', 'alert_lead_minutes', 'created_at']
        read_only_fields = ['id', 'created_at']


class SavedRouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedRoute
        fields = '__all__'
        read_only_fields = ['id', 'user', 'created_at', 'updated_at']


class RouteAlertSerializer(serializers.ModelSerializer):
    incident = IncidentSerializer(read_only=True)

    class Meta:
        model = RouteAlert
        fields = '__all__'
        read_only_fields = ['id', 'sent_at']
