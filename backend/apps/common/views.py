from django.db import connection
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """Deliberately minimal (Phase 12.5: no verbose health-check output
    reachable from outside) — just confirms the app can talk to Postgres.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception:
            return Response({"status": "unhealthy"}, status=503)
        return Response({"status": "ok"})
