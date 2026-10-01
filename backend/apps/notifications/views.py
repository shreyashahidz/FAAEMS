from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer
from apps.notifications.services import remind_pending_verifications


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """Every user only ever sees their own notifications — scoped by
    recipient, not by role, so there's no separate permission class needed
    beyond authentication."""

    serializer_class = NotificationSerializer
    filterset_fields = ["is_read"]

    def get_queryset(self):
        # There's no task scheduler in this deployment (single-server, no
        # Celery beat/cron), so the daily "still awaiting your
        # verification" reminder is piggybacked on ordinary traffic here
        # instead: cheap no-op query unless 20h+ have actually passed (see
        # remind_pending_verifications), so it's safe to call on every
        # notifications fetch rather than needing its own schedule.
        remind_pending_verifications()
        return Notification.objects.filter(recipient=self.request.user)

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        return Response({"count": self.get_queryset().filter(is_read=False).count()})

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read"])
        return Response(NotificationSerializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response(status=204)
