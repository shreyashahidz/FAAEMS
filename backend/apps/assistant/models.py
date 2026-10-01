from django.db import models


class AssistantQueryLog(models.Model):
    """Every question + how it was answered (Phase 11.6) — auditable, since
    the agent is a read-only lens over existing APIs, not a source of
    truth. `evidence_ids_cited` and `api_calls` make the answer traceable
    back to real records rather than a black box."""

    user = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, related_name="assistant_queries")
    question = models.CharField(max_length=500)
    matched_intent = models.CharField(max_length=60, blank=True, default="")
    answer = models.TextField()
    evidence_ids_cited = models.JSONField(default=list)
    api_calls = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user_id}: {self.question[:60]}"
