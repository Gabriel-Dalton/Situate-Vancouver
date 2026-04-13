"""
Authentication endpoints for Situate Vancouver.

POST /api/auth/register/   — create account, returns token pair
POST /api/auth/login/      — obtain token pair  (handled by simplejwt TokenObtainPairView)
POST /api/auth/refresh/    — refresh access token (handled by simplejwt TokenRefreshView)
POST /api/auth/logout/     — blacklist refresh token
GET  /api/auth/me/         — return current user + profile
"""

import logging

from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserProfile

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------

class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=150, required=False, default='')
    last_name = serializers.CharField(max_length=150, required=False, default='')

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value

    def validate_password(self, value):
        # Run Django's built-in validators (length, common passwords, etc.)
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'date_joined')
        read_only_fields = fields


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ('notify_via', 'alert_lead_minutes', 'phone')


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Create a new user account and return a token pair.

    Request:  { "email": "...", "password": "...", "first_name": "...", "last_name": "..." }
    Response: { "access": "...", "refresh": "...", "user": { ... } }
    """
    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    email = data['email']

    user = User.objects.create_user(
        username=email,         # use email as username — unique by design
        email=email,
        password=data['password'],
        first_name=data.get('first_name', ''),
        last_name=data.get('last_name', ''),
    )

    # UserProfile is created automatically via post_save signal (or created here)
    UserProfile.objects.get_or_create(user=user)

    refresh = RefreshToken.for_user(user)
    logger.info('register: new user %s (id=%s)', email, user.pk)

    return Response(
        {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """
    Blacklist the supplied refresh token, invalidating the session.

    Request:  { "refresh": "<refresh_token>" }
    Response: 204 No Content
    """
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response(
            {'detail': 'Field "refresh" is required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        token = RefreshToken(refresh_token)
        token.blacklist()
    except TokenError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def me(request):
    """
    GET  — return current user + profile.
    PATCH — update first_name, last_name, or profile fields (notify_via, alert_lead_minutes, phone).

    Response: { "user": { ... }, "profile": { ... } }
    """
    user = request.user
    profile, _ = UserProfile.objects.get_or_create(user=user)

    if request.method == 'GET':
        return Response({
            'user': UserSerializer(user).data,
            'profile': ProfileSerializer(profile).data,
        })

    # PATCH — update allowed fields only
    errors = {}

    user_fields = {}
    for field in ('first_name', 'last_name'):
        if field in request.data:
            val = str(request.data[field]).strip()
            if len(val) > 150:
                errors[field] = ['Ensure this field has no more than 150 characters.']
            else:
                user_fields[field] = val

    profile_serializer = ProfileSerializer(profile, data=request.data, partial=True)
    if not profile_serializer.is_valid():
        errors.update(profile_serializer.errors)

    if errors:
        return Response(errors, status=status.HTTP_400_BAD_REQUEST)

    for attr, val in user_fields.items():
        setattr(user, attr, val)
    if user_fields:
        user.save(update_fields=list(user_fields.keys()))

    profile_serializer.save()

    return Response({
        'user': UserSerializer(user).data,
        'profile': ProfileSerializer(profile).data,
    })
