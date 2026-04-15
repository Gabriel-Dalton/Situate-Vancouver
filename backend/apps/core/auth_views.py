"""
Authentication endpoints for Situate Vancouver.

POST /api/auth/register/   — create account, sets httpOnly refresh cookie, returns access token
POST /api/auth/login/      — sign in, sets httpOnly refresh cookie, returns access token
POST /api/auth/refresh/    — reads refresh cookie, returns new access token + rotates cookie
POST /api/auth/logout/     — blacklists refresh token, clears cookie
GET  /api/auth/me/         — return current user + profile
PATCH /api/auth/me/        — update profile fields
POST /api/auth/password/forgot/           — issue password reset token in debug
POST /api/auth/password/reset/            — set a new password from reset token
POST /api/auth/verify-email/request/      — issue email verification token in debug
POST /api/auth/verify-email/confirm/      — verify email using token

Refresh token security model:
  - Stored as httpOnly, Secure, SameSite=Lax cookie — JS cannot read it
  - Access token returned in response body only (short-lived, 60 min)
  - Frontend stores access token in memory, never in localStorage
"""

import logging

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserProfile

logger = logging.getLogger(__name__)

REFRESH_COOKIE_NAME = 'situate_refresh'
REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Attach the refresh token as an httpOnly cookie."""
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        str(refresh_token),
        max_age=REFRESH_COOKIE_MAX_AGE,
        httponly=True,
        secure=not settings.DEBUG,   # Secure flag in production (HTTPS only)
        samesite='Lax',
        path='/api/auth/',           # Scoped — cookie only sent to auth endpoints
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE_NAME, path='/api/auth/')


def _client_ip(request):
    """Best-effort client IP extraction, preferring X-Forwarded-For when present."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


def _rate_limit_exceeded(request, action: str, max_attempts: int) -> bool:
    """
    Cache-backed fixed window limiter scoped to action+IP.
    We deliberately keep this simple and deterministic for auth endpoint hardening.
    """
    window = settings.AUTH_RATE_LIMIT_WINDOW_SECONDS
    key = f'auth_rl:{action}:{_client_ip(request)}'
    current = cache.get(key, 0)
    if current >= max_attempts:
        return True
    cache.set(key, current + 1, timeout=window)
    return False


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
        fields = (
            'notify_via',
            'alert_lead_minutes',
            'phone',
            'email_verified',
            'email_verified_at',
        )
        read_only_fields = ('email_verified', 'email_verified_at')


# ---------------------------------------------------------------------------
# Views
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Create a new user account.

    Request:  { "email": "...", "password": "...", "first_name": "...", "last_name": "..." }
    Response: { "access": "...", "user": { ... } }  +  httpOnly refresh cookie
    """
    if _rate_limit_exceeded(request, 'register', settings.AUTH_RATE_LIMIT_REGISTER_MAX_ATTEMPTS):
        return Response(
            {'detail': 'Too many sign-up attempts. Please wait and try again.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    serializer = RegisterSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data
    email = data['email']

    user = User.objects.create_user(
        username=email,
        email=email,
        password=data['password'],
        first_name=data.get('first_name', ''),
        last_name=data.get('last_name', ''),
    )
    UserProfile.objects.get_or_create(user=user)

    refresh = RefreshToken.for_user(user)
    logger.info('register: new user %s (id=%s)', email, user.pk)

    response = Response(
        {'access': str(refresh.access_token), 'user': UserSerializer(user).data},
        status=status.HTTP_201_CREATED,
    )
    _set_refresh_cookie(response, refresh)
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    Sign in with email + password.

    Request:  { "email": "...", "password": "..." }
    Response: { "access": "...", "user": { ... } }  +  httpOnly refresh cookie
    """
    if _rate_limit_exceeded(request, 'login', settings.AUTH_RATE_LIMIT_LOGIN_MAX_ATTEMPTS):
        return Response(
            {'detail': 'Too many sign-in attempts. Please wait and try again.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    email = (request.data.get('email') or '').strip().lower()
    password = request.data.get('password') or ''

    if not email or not password:
        return Response(
            {'detail': 'Email and password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Django's username field is used for auth — we store email as username
    user = authenticate(request, username=email, password=password)
    if user is None:
        return Response(
            {'detail': 'No account found with these credentials.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    refresh = RefreshToken.for_user(user)
    response = Response({'access': str(refresh.access_token), 'user': UserSerializer(user).data})
    _set_refresh_cookie(response, refresh)
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def refresh(request):
    """
    Exchange the httpOnly refresh cookie for a new access token.
    Also rotates the refresh cookie.

    No request body needed — reads from cookie automatically.
    Response: { "access": "..." }  +  new httpOnly refresh cookie
    """
    refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        return Response({'detail': 'No refresh token.'}, status=status.HTTP_401_UNAUTHORIZED)

    try:
        token = RefreshToken(refresh_token)
        token.blacklist()                        # invalidate old token
        new_refresh = token.rotate()             # issue new refresh token
    except TokenError as exc:
        return Response({'detail': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

    response = Response({'access': str(new_refresh.access_token)})
    _set_refresh_cookie(response, new_refresh)
    return response


@api_view(['POST'])
@permission_classes([AllowAny])
def logout(request):
    """
    Blacklist the refresh token and clear the cookie.

    Response: 204 No Content
    """
    refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
    if refresh_token:
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            pass  # Already invalid — still clear the cookie

    response = Response(status=status.HTTP_204_NO_CONTENT)
    _clear_refresh_cookie(response)
    return response


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


@api_view(['POST'])
@permission_classes([AllowAny])
def password_forgot(request):
    """
    Issue a password reset token for the given email.
    In DEBUG only, include uid/token in response for local development flows.
    """
    if _rate_limit_exceeded(
        request,
        'password_forgot',
        settings.AUTH_RATE_LIMIT_PASSWORD_RESET_MAX_ATTEMPTS,
    ):
        return Response(
            {'detail': 'Too many password reset attempts. Please wait and try again.'},
            status=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    email = (request.data.get('email') or '').strip().lower()
    if not email:
        return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(email__iexact=email).first()
    response_payload = {'detail': 'If this account exists, reset instructions were prepared.'}
    if user and settings.DEBUG:
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        response_payload['dev_reset'] = {'uid': uid, 'token': token}
    return Response(response_payload, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def password_reset(request):
    """Reset password from uid/token pair."""
    uid = request.data.get('uid') or ''
    token = request.data.get('token') or ''
    new_password = request.data.get('new_password') or ''
    if not uid or not token or not new_password:
        return Response(
            {'detail': 'uid, token, and new_password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return Response({'detail': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({'detail': 'Reset token is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, user=user)
    except DjangoValidationError as exc:
        return Response({'new_password': list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.save(update_fields=['password'])
    return Response({'detail': 'Password reset successful.'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_email_request(request):
    """
    Generate an email verification token for the current user.
    In DEBUG, return uid/token to allow manual testing without SMTP.
    """
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if profile.email_verified:
        return Response({'detail': 'Email is already verified.'}, status=status.HTTP_200_OK)

    payload = {'detail': 'Verification instructions prepared.'}
    if settings.DEBUG:
        payload['dev_verification'] = {
            'uid': urlsafe_base64_encode(force_bytes(request.user.pk)),
            'token': default_token_generator.make_token(request.user),
        }
    return Response(payload, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_email_confirm(request):
    """Confirm and persist email verification state using uid/token."""
    uid = request.data.get('uid') or ''
    token = request.data.get('token') or ''
    if not uid or not token:
        return Response({'detail': 'uid and token are required.'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user_id = force_str(urlsafe_base64_decode(uid))
        user = User.objects.get(pk=user_id)
    except Exception:
        return Response({'detail': 'Invalid verification link.'}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({'detail': 'Verification token is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)

    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.mark_email_verified()
    return Response({'detail': 'Email verified successfully.'}, status=status.HTTP_200_OK)
