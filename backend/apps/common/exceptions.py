import logging

from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

from apps.common.middleware import get_current_correlation_id

logger = logging.getLogger("faems")


def correlated_exception_handler(exc, context):
    """Client-facing errors stay generic on 5xx; full detail always goes to
    the server log keyed by correlation id (Phase 12.3 + 12.6). 4xx validation
    errors are legitimate user feedback, so their detail is preserved.
    """
    response = drf_exception_handler(exc, context)
    correlation_id = get_current_correlation_id()

    if response is None:
        request = context.get("request")
        logger.error(
            "Unhandled exception on %s",
            getattr(request, "path", "?"),
            exc_info=exc,
            extra={"correlation_id": correlation_id},
        )
        return Response(
            {
                "detail": "Something went wrong on our end. Please try again, and share this "
                "reference code with IQAC/support if it keeps happening.",
                "correlation_id": correlation_id,
            },
            status=500,
        )

    if response.status_code >= 500:
        logger.error(
            "Server error on %s: %s",
            context.get("request").path if context.get("request") else "?",
            exc,
            extra={"correlation_id": correlation_id},
        )
        response.data = {
            "detail": "Something went wrong on our end. Please try again, and share this "
            "reference code with IQAC/support if it keeps happening.",
            "correlation_id": correlation_id,
        }
    else:
        if isinstance(response.data, dict):
            response.data["correlation_id"] = correlation_id

    return response
