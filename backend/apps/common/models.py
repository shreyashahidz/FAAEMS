from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class SoftDeleteQuerySet(models.QuerySet):
    def alive(self):
        return self.filter(is_deleted=False)

    def dead(self):
        return self.filter(is_deleted=True)


class SoftDeleteManager(models.Manager):
    """Default manager hides soft-deleted rows from normal views. Use
    `all_objects` on the model when the deleted rows are needed on purpose
    (audit trails, alumni archive, integrity checks) — never a raw delete.
    """

    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).alive()


class SoftDeleteModel(models.Model):
    """Soft deletion only, everywhere (playbook Phase 2.6): no hard deletes
    on records that matter for the institutional record.
    """

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        "accounts.User", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    deletion_reason = models.CharField(max_length=255, blank=True, default="")

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def soft_delete(self, by_user=None, reason=""):
        from django.utils import timezone

        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.deleted_by = by_user
        self.deletion_reason = reason
        self.save(update_fields=["is_deleted", "deleted_at", "deleted_by", "deletion_reason"])
