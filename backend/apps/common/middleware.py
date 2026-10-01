import uuid

_local_storage = {}


class CorrelationIdMiddleware:
    """Attaches a correlation id to every request so a generic error shown to
    a user (Phase 12.3) can be traced back to the matching backend log lines
    (Phase 12.6) without exposing internals to the client.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        correlation_id = request.headers.get("X-Correlation-Id") or str(uuid.uuid4())
        request.correlation_id = correlation_id
        import threading

        _local_storage[threading.get_ident()] = correlation_id
        try:
            response = self.get_response(request)
        finally:
            _local_storage.pop(threading.get_ident(), None)
        response["X-Correlation-Id"] = correlation_id
        return response


def get_current_correlation_id():
    import threading

    return _local_storage.get(threading.get_ident(), "-")


class SecurityHeadersMiddleware:
    """Headers not already covered by Django's SecurityMiddleware settings."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("X-Frame-Options", "DENY")
        response.setdefault("Referrer-Policy", "same-origin")
        response.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; frame-ancestors 'none'; base-uri 'self'",
        )
        return response
