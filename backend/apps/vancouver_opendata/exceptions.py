"""Errors raised when calling the Vancouver Open Data (Opendatasoft Explore) API."""


class VancouverOpenDataError(Exception):
    """Base class for integration failures (transport, HTTP, or portal API logic)."""

    def __init__(
        self,
        message: str,
        *,
        api_error_code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.api_error_code = api_error_code


class VancouverOpenDataConfigurationError(VancouverOpenDataError):
    """Raised when required settings (e.g. API key) are missing."""


class VancouverOpenDataTransportError(VancouverOpenDataError):
    """Raised for timeouts, connection errors, or invalid JSON responses."""


class VancouverOpenDataApiError(VancouverOpenDataError):
    """Raised when the portal returns an HTTP error or API error envelope."""


# Backward-compatible alias (portal is not CKAN; old name kept for imports/tests).
VancouverOpenDataCkanError = VancouverOpenDataApiError
