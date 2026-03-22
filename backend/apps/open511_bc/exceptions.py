"""Errors raised by the Open511 BC client."""


class Open511BCError(Exception):
    """Base error for Open511 BC integration."""


class Open511BCTransportError(Open511BCError):
    """Network, timeout, or non-JSON response."""


class Open511BCApiError(Open511BCError):
    """Upstream returned HTTP 4xx/5xx or an error payload."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code
