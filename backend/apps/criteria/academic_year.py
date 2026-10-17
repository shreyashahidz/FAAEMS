"""The institution's academic year runs 1 June - 31 May (A.Y. 2026-2027 is
June 2026 to May 2027). Everything that depends on "the current year" - the
leaderboard default, the report's A.Y., the submission form's default year -
derives it from today's date here, so it rolls over by itself on 1 June
with no code or data change.
"""

import datetime

AY_START_MONTH = 6  # June


def academic_year_start(d: datetime.date) -> int:
    return d.year if d.month >= AY_START_MONTH else d.year - 1


def academic_year_label(d: datetime.date) -> str:
    start = academic_year_start(d)
    return f"{start}-{start + 1}"


def ensure_current_cycle():
    """Makes sure an assessment cycle exists for the current academic year, so
    a new year appears everywhere automatically (leaderboard, submission
    form) on 1 June without anyone adding it by hand."""
    from django.utils import timezone

    from apps.criteria.models import AccreditationFramework, Cycle

    framework = AccreditationFramework.objects.filter(code="NBA").first()
    if framework is None:
        return None
    today = timezone.localdate()
    start = academic_year_start(today)
    cycle, _ = Cycle.objects.get_or_create(
        framework=framework,
        label=academic_year_label(today),
        defaults={
            "start_date": datetime.date(start, AY_START_MONTH, 1),
            "end_date": datetime.date(start + 1, AY_START_MONTH - 1, 31),
            "is_active": True,
        },
    )
    return cycle


def ordered_year_labels(labels, today=None):
    """Current academic year first, then earlier years (newest first), then
    later years (soonest first)."""
    from django.utils import timezone

    today = today or timezone.localdate()
    current = academic_year_start(today)

    def start_of(label):
        try:
            return int(str(label).split("-")[0])
        except ValueError:
            return 0

    unique = sorted(set(labels) | {academic_year_label(today)}, key=start_of)
    past = [l for l in reversed(unique) if start_of(l) < current]
    future = [l for l in unique if start_of(l) > current]
    return [academic_year_label(today)] + past + future
