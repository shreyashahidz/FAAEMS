"""Natural-language query layer over existing, already-computed data
(Phase 11). Strictly read-only, strictly grounded: every branch below calls
the same querysets the Gap Analysis / Action Centre / search views use —
there is no independent DB access path here, and nothing is ever invented.
If a question doesn't match a supported pattern, we say so rather than
guessing (Phase 11.5).

Out of scope by design (per the playbook): generating achievement text,
judging document authenticity, general chit-chat unrelated to accreditation
data. Those branches simply don't exist here.
"""

import re

from apps.accounts.models import Department, FacultyProfile, User
from apps.achievements.models import Achievement, EvidenceMapping

VERIFIED_STATUSES = [Achievement.Status.VERIFIED, Achievement.Status.IQAC_LOCKED]
UNVERIFIED_STATUSES = [
    Achievement.Status.DRAFT,
    Achievement.Status.SUBMITTED,
    Achievement.Status.RESUBMITTED,
    Achievement.Status.CORRECTIONS_REQUIRED,
]


class AssistantError(Exception):
    """Raised when the question can't be mapped to a supported, data-backed
    operation — the caller turns this into the 'can't answer' response
    rather than falling through to a guess."""


def _department_scope(user):
    """Faculty: only their own data. HOD: their department. IQAC/super
    admin: everything. This mirrors the RBAC already enforced on the real
    endpoints (Phase 11.4) — the assistant doesn't get its own looser rules."""
    if user.role in {User.Role.IQAC_ADMIN, User.Role.SUPER_ADMIN}:
        return None  # no restriction
    if user.role == User.Role.HOD:
        return user.department_id
    return "self-only"


def _resolve_department(text):
    text_lower = text.lower()
    for dept in Department.objects.all():
        if dept.code.lower() in text_lower or dept.name.lower() in text_lower:
            return dept
    return None


# --- Intent: departments below X% for a given criterion --------------------

_CRITERION_GAP_RE = re.compile(
    r"below\s+(\d{1,3})\s*%.*?criteri(?:on|a)\s+(\d+(?:\.\d+)*)", re.IGNORECASE
)


def _answer_criterion_gap(question, user):
    match = _CRITERION_GAP_RE.search(question)
    if not match:
        return None
    threshold = int(match.group(1))
    criterion_code = match.group(2)

    scope = _department_scope(user)
    if scope == "self-only":
        raise AssistantError(
            "Department-wide gap analysis isn't part of your own data — ask your HOD or IQAC, "
            "or ask me what's missing from your own profile instead."
        )

    mappings = EvidenceMapping.objects.filter(sub_criterion__criterion__code=criterion_code).select_related(
        "achievement__faculty__department"
    )
    if scope is not None:
        mappings = mappings.filter(achievement__faculty__department_id=scope)

    by_dept = {}
    for m in mappings:
        dept = m.achievement.faculty.department
        by_dept.setdefault(dept, {"total": 0, "verified": 0, "evidence_ids": []})
        by_dept[dept]["total"] += 1
        if m.achievement.status in VERIFIED_STATUSES:
            by_dept[dept]["verified"] += 1
        by_dept[dept]["evidence_ids"].append(m.achievement.evidence_id)

    below = []
    cited = []
    for dept, stats in by_dept.items():
        pct = round((stats["verified"] / stats["total"]) * 100) if stats["total"] else 0
        if pct < threshold:
            below.append((dept.name, pct, stats["total"]))
            cited.extend(stats["evidence_ids"])

    if not by_dept:
        return {
            "answer": f"No evidence is currently mapped to Criterion {criterion_code}, so there's nothing to evaluate.",
            "evidence_ids": [],
            "api_calls": ["EvidenceMapping (filtered by sub_criterion__criterion__code)"],
        }

    if not below:
        answer = f"No departments are below {threshold}% for Criterion {criterion_code}."
    else:
        lines = [f"{name}: {pct}% ({total} mapped records)" for name, pct, total in sorted(below, key=lambda x: x[1])]
        answer = f"Departments below {threshold}% for Criterion {criterion_code}:\n" + "\n".join(lines)

    return {"answer": answer, "evidence_ids": sorted(set(cited)), "api_calls": ["EvidenceMapping (grouped by department)"]}


# --- Intent: what's missing for <faculty>'s profile -------------------------

_PROFILE_GAP_RE = re.compile(r"missing.*for\s+(.+?)(?:'s)?\s+profile", re.IGNORECASE)


def _answer_profile_gap(question, user):
    match = _PROFILE_GAP_RE.search(question)
    if not match:
        return None
    name_fragment = match.group(1).strip().strip("'\"")
    scope = _department_scope(user)
    own_profile = getattr(user, "faculty_profile", None)

    if name_fragment.lower() in {"my", "my own", "me"}:
        if not own_profile:
            raise AssistantError("Your account doesn't have a linked faculty profile.")
        profiles = FacultyProfile.objects.filter(id=own_profile.id)
    else:
        profiles = FacultyProfile.objects.filter(full_name__icontains=name_fragment)
        if scope == "self-only":
            if not own_profile or name_fragment.lower() not in own_profile.full_name.lower():
                raise AssistantError(
                    "You can only ask about your own profile — try 'what's missing for my profile'."
                )
            profiles = FacultyProfile.objects.filter(id=own_profile.id)
        elif scope is not None:
            profiles = profiles.filter(department_id=scope)

    profile = profiles.first()
    if not profile:
        raise AssistantError(f"No faculty profile matching '{name_fragment}' found in your scope.")

    gaps = []
    if not profile.contact_number:
        gaps.append("missing contact number")
    if not profile.join_date:
        gaps.append("missing join date")

    achievements = Achievement.objects.filter(faculty=profile, is_deleted=False)
    missing_date = achievements.filter(achievement_date__isnull=True)
    missing_org = achievements.filter(issuing_organization="")
    unverified = achievements.filter(status__in=UNVERIFIED_STATUSES)

    if missing_date.exists():
        gaps.append(f"{missing_date.count()} achievement(s) missing a date")
    if missing_org.exists():
        gaps.append(f"{missing_org.count()} achievement(s) missing an issuing organization")
    if unverified.exists():
        gaps.append(f"{unverified.count()} achievement(s) not yet verified")

    cited = list(missing_date.values_list("evidence_id", flat=True)) + list(
        missing_org.values_list("evidence_id", flat=True)
    ) + list(unverified.values_list("evidence_id", flat=True))

    answer = (
        f"{profile.full_name}'s profile is complete." if not gaps else f"{profile.full_name}: " + "; ".join(gaps) + "."
    )
    return {"answer": answer, "evidence_ids": sorted(set(cited)), "api_calls": ["FacultyProfile.get", "Achievement.filter"]}


# --- Intent: how many unverified records does <department> have ------------

_UNVERIFIED_COUNT_RE = re.compile(r"how many unverified", re.IGNORECASE)


def _answer_unverified_count(question, user):
    if not _UNVERIFIED_COUNT_RE.search(question):
        return None

    scope = _department_scope(user)
    qs = Achievement.objects.filter(is_deleted=False, status__in=UNVERIFIED_STATUSES)

    if scope == "self-only":
        own_profile = getattr(user, "faculty_profile", None)
        qs = qs.filter(faculty=own_profile) if own_profile else qs.none()
        label = "your own"
    elif scope is not None:
        qs = qs.filter(faculty__department_id=scope)
        label = "your department's"
    else:
        dept = _resolve_department(question)
        if dept:
            qs = qs.filter(faculty__department_id=dept.id)
            label = f"{dept.name}'s"
        else:
            label = "the institution's"

    count = qs.count()
    evidence_ids = list(qs.values_list("evidence_id", flat=True))
    return {
        "answer": f"{label[0].upper()}{label[1:]} unverified record count is {count}.",
        "evidence_ids": evidence_ids,
        "api_calls": ["Achievement.filter(status__in=unverified)"],
    }


_HANDLERS = [_answer_criterion_gap, _answer_profile_gap, _answer_unverified_count]


def answer_question(question, user):
    for handler in _HANDLERS:
        result = handler(question, user)
        if result is not None:
            return {**result, "matched_intent": handler.__name__.removeprefix("_answer_")}

    raise AssistantError(
        "I can only answer a few specific question types right now: "
        "'which departments are below X% for Criterion N', "
        "'what's missing for <name>'s profile', and "
        "'how many unverified records does <department> have'. "
        "I don't generate achievement content or judge document authenticity."
    )
