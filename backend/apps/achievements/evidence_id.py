from django.db import transaction


def generate_evidence_id(department_code: str, year: int) -> str:
    """EV-<DEPTCODE>-<YEAR>-<sequence>, e.g. EV-AIML-2026-001245 (Phase 2.3).
    HOD/IQAC only ever see this id — never the raw DB primary key.
    """
    from apps.achievements.models import EvidenceIdSequence

    with transaction.atomic():
        seq, _ = EvidenceIdSequence.objects.select_for_update().get_or_create(
            department_code=department_code, year=year
        )
        seq.last_value += 1
        seq.save(update_fields=["last_value"])
        return f"EV-{department_code}-{year}-{seq.last_value:06d}"
