from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.models import Department, FacultyProfile, User
from apps.criteria.models import AccreditationFramework, Criterion, Cycle, RequiredEvidenceTarget, SubCriterion

DEMO_PASSWORD = "Faems@2026!"

# code, name, HOD display name (display-only — see Department.head_of_department_name).
# HOD names are the college's real department heads, as supplied by the
# college; EXTC, MECH, MME and Cyber Security don't have a confirmed real
# HOD yet, so those stay as placeholders until the college shares them.
# Only AI & ML gets full login-capable faculty seeded (Phase 1.5's "smallest
# dataset" principle) — the rest exist so the department carousel and HOD
# directory have real rows to render, per the college's own request.
DEPARTMENTS = [
    ("AIML", "AI & ML", "Dr. Shiwani Gupta (Associate Professor & HOD)"),
    ("AIDS", "AI & DS", "Dr. Prachi Janrao (HOD)"),
    ("COMPS", "Computer Engineering", "Dr. R. R. Sedamkar (Professor, Vice Principal & HOD) / Dr. Vaishali Kaiche (Officiating HOD)"),
    ("EXTC", "Electronics & Telecommunication", "Dr. Sunita Pawar"),
    ("ECS", "Electronics and Computer Science", "Dr. Hemant Kasturiwale (Associate Professor & HOD)"),
    ("CIVIL", "Civil Engineering", "Dr. Seema Jagtap (Professor & HOD)"),
    ("MECH", "Mechanical Engineering", "Dr. Prakash Iyer"),
    ("IT", "Information Technology", "Dr. Rajesh S. Bansode (Professor & HOD)"),
    ("IOT", "Internet of Things", "Dr. Sujata Alegavi (HOD)"),
    ("ESH", "Engineering Sciences and Humanities", "Dr. Sunita Pachori & Dr. Ashwin Pathak (Heads of Department)"),
]

# The full NBA Criterion 6 tree, exactly as specified for the achievement
# wizard. Every node is a (code, description, [children]) tuple. `code` is
# an internal id only (DB + report generation) — the UI never renders it,
# and there is no marks/percentage/amount-tier value anywhere in this tree
# or in what the wizard shows. This *is* the seed data for a configurable
# table (SubCriterion.parent) — an admin can add/edit/re-nest any of this
# later without a frontend code change.
CRITERION_6_TREE = [
    (
        "6.1",
        "Professional Development Activities",
        [
            ("6.1.1", "Memberships in Professional Societies at National/International Levels", []),
            (
                "6.1.2",
                "Faculty as Resource Persons or Participants in STTPs/FDPs",
                [
                    (
                        "6.1.2.1",
                        "Faculty as Resource Persons in STTPs/FDPs",
                        [
                            (
                                "6.1.2.1.a",
                                "More than 3 faculty members from the department served as resource persons",
                                [],
                            ),
                            (
                                "6.1.2.1.b",
                                "More than 2 and less than 3 faculty members from the department served as resource persons",
                                [],
                            ),
                        ],
                    ),
                    (
                        "6.1.2.2",
                        "Faculty Members' Participation in STTPs/FDPs",
                        [
                            ("6.1.2.2.a", "Participated in a 2 to 5 day Faculty Development Program", []),
                            ("6.1.2.2.b", "Participated in a Faculty Development Program longer than 5 days", []),
                        ],
                    ),
                ],
            ),
            (
                "6.1.3",
                "Faculty Contribution in Development of SWAYAM MOOCs and other E-Content",
                [
                    ("6.1.3.a", "Faculty member(s) involvement in developing SWAYAM MOOCs", []),
                    ("6.1.3.b", "Involvement of faculty members in developing E-Content", []),
                ],
            ),
            ("6.1.4", "Faculty Certification of MOOCs through SWAYAM, etc.", []),
            ("6.1.5", "FDP/STTP Organized by Department", []),
            ("6.1.6", "Faculty Support in Student Innovative Projects", []),
            ("6.1.7", "Faculty Internship/Training/Collaboration with Industry", []),
        ],
    ),
    (
        "6.2",
        "Research and Development Activities",
        [
            (
                "6.2.1",
                "Academic Research",
                [
                    ("6.2.1.a", "Number of Publications", []),
                    ("6.2.1.b", "Quality of Publications", []),
                ],
            ),
            (
                "6.2.2",
                "Ph.D. Student Details",
                [
                    (
                        "6.2.2.a",
                        "Number of students enrolled for Ph.D. degree in the department during the assessment period",
                        [],
                    ),
                    (
                        "6.2.2.b",
                        "Number of Ph.D. students graduated in the department during the assessment period",
                        [],
                    ),
                ],
            ),
            (
                "6.2.3",
                "Development Activities",
                [
                    ("6.2.3.a", "Patents granted during the assessment period", []),
                    ("6.2.3.b", "Patents published during the assessment period", []),
                    ("6.2.3.c", "Working models and prototypes developed during the assessment period", []),
                ],
            ),
            ("6.2.4", "Sponsored Research Project", []),
            ("6.2.5", "Consultancy Work", []),
            (
                "6.2.6",
                "Institution Seed Money or Internal Research Grant to its Faculty for Research Work",
                [
                    ("6.2.6.a", "Amount received", []),
                    ("6.2.6.b", "Amount utilized", []),
                ],
            ),
        ],
    ),
]

# name, designation, employee_id, role
# The real AI & ML faculty roster, as published on the college's own site
# (tcetmumbai.in/AIML/AI&MLFaculty.html and AI&MLAllFaculty.html). Designation
# is mapped to the closest of the 4 FacultyProfile.Designation choices —
# "Lecturer" and "Associate Professor of Practice" aren't modeled separately,
# so they fold into Assistant/Associate Professor respectively.
# Employee IDs start at 101 (not 001) so this list can be safely re-run
# against a database that already has the older 001-006 fictional-numbered
# rows from before the real-roster swap, without a unique-constraint clash.
AIML_FACULTY = [
    ("Dr. Shiwani Gupta", FacultyProfile.Designation.HOD, "AIML-EMP-001", User.Role.HOD),
    ("Dr. Sukruti Kaulgud", FacultyProfile.Designation.ASSOCIATE_PROFESSOR, "AIML-EMP-101", User.Role.FACULTY),
    ("Dr. Vivek Bhartiya", FacultyProfile.Designation.PROFESSOR, "AIML-EMP-102", User.Role.FACULTY),
    ("Mr. Neeraj Kumar", FacultyProfile.Designation.ASSOCIATE_PROFESSOR, "AIML-EMP-103", User.Role.FACULTY),
    ("Ms. Seema Nagrani", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-104", User.Role.FACULTY),
    ("Ms. Jagruti Jadhav", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-105", User.Role.FACULTY),
    ("Ms. Shilpa Mathur", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-106", User.Role.FACULTY),
    ("Ms. Sampada Bhonde", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-107", User.Role.FACULTY),
    ("Ms. Deepthi Raj", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-108", User.Role.FACULTY),
    ("Mr. Anand Maha", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-109", User.Role.FACULTY),
    ("Mrs. Shital Pazare", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-110", User.Role.FACULTY),
    ("Mrs. Ankita Amravat", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-111", User.Role.FACULTY),
    ("Mrs. Pranjali Sankhe", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-112", User.Role.FACULTY),
    ("Ms. Shruti Pant", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-113", User.Role.FACULTY),
    ("Mrs. Snehal Mahajan", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-114", User.Role.FACULTY),
    ("Mrs. Bhargavi", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-115", User.Role.FACULTY),
    ("Mrs. Pratiksha Ahuja", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-116", User.Role.FACULTY),
    ("Mrs. Purva Khandekar", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-117", User.Role.FACULTY),
    ("Mr. Kunal Pandey", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-118", User.Role.FACULTY),
    ("Mr. Abhijeet Jadhav", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-119", User.Role.FACULTY),
    ("Mr. Anish Yekhande", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-120", User.Role.FACULTY),
    ("Mr. Pratik Dave", FacultyProfile.Designation.ASSISTANT_PROFESSOR, "AIML-EMP-121", User.Role.FACULTY),
]


def _slug_email(full_name: str) -> str:
    parts = [p.lower() for p in full_name.replace(".", "").split() if p.lower() not in {"dr", "mr", "mrs", "ms"}]
    return f"{'.'.join(parts)}@tcetmumbai.in"


def _seed_tree(nodes, criterion, parent, order_start=0):
    count = 0
    for order, (code, description, children) in enumerate(nodes, start=order_start):
        node, _ = SubCriterion.objects.update_or_create(
            criterion=criterion,
            code=code,
            defaults={"description": description, "parent": parent, "order": order},
        )
        count += 1
        count += _seed_tree(children, criterion, node)
    return count


class Command(BaseCommand):
    help = "Seeds demo departments, the NBA Criterion 6 tree, and AI & ML faculty for local dev/testing."

    @transaction.atomic
    def handle(self, *args, **options):
        departments = {}
        for code, name, hod_name in DEPARTMENTS:
            dept, _ = Department.objects.get_or_create(
                code=code, defaults={"name": name, "head_of_department_name": hod_name}
            )
            if dept.head_of_department_name != hod_name:
                dept.head_of_department_name = hod_name
                dept.save(update_fields=["head_of_department_name"])
            departments[code] = dept
        self.stdout.write(self.style.SUCCESS(f"Departments: {len(departments)}"))

        framework, _ = AccreditationFramework.objects.get_or_create(
            code="NBA", defaults={"name": "National Board of Accreditation", "description": "NBA SAR Tier-I (UG Engineering)"}
        )
        cycle_2526, _ = Cycle.objects.get_or_create(framework=framework, label="2025-2026")
        Cycle.objects.get_or_create(framework=framework, label="2026-2027")

        criterion_6, _ = Criterion.objects.get_or_create(
            framework=framework, code="6", defaults={"title": "Faculty Contributions"}
        )

        node_count = _seed_tree(CRITERION_6_TREE, criterion_6, None)
        self.stdout.write(self.style.SUCCESS(f"Criterion 6 tree nodes: {node_count}"))

        for code in ["6.1.1", "6.1.4", "6.1.6"]:
            sub = SubCriterion.objects.get(criterion=criterion_6, code=code)
            RequiredEvidenceTarget.objects.get_or_create(
                department=departments["AIML"], sub_criterion=sub, cycle=cycle_2526,
                defaults={"required_count": 3},
            )

        created_users = []
        for full_name, designation, employee_id, role in AIML_FACULTY:
            email = _slug_email(full_name)
            user, created = User.objects.get_or_create(
                email=email,
                defaults={"full_name": full_name, "role": role, "department": departments["AIML"]},
            )
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save()
                created_users.append((email, role))
            FacultyProfile.objects.get_or_create(
                user=user,
                defaults={
                    "department": departments["AIML"],
                    "full_name": full_name,
                    "designation": designation,
                    "employee_id": employee_id,
                },
            )

        guests = [
            # email, display name, role, employee_id (None = no FacultyProfile), dept code, designation
            ("guest.faculty@tcetmumbai.in", "Guest Faculty", User.Role.FACULTY, "AIML-EMP-099", "AIML", FacultyProfile.Designation.ASSISTANT_PROFESSOR),
            ("guest.iqac@tcetmumbai.in", "Guest IQAC Admin", User.Role.IQAC_ADMIN, "AIML-EMP-098", "AIML", FacultyProfile.Designation.ASSISTANT_PROFESSOR),
            ("guest.admin@tcetmumbai.in", "Guest Super Admin", User.Role.SUPER_ADMIN, None, None, None),
            # IT has no other login-capable HOD yet — a clean, isolated
            # account for testing the HOD role without doubling up AIML's
            # real HOD (Dr. Shiwani Gupta).
            ("guest.hod@tcetmumbai.in", "Guest HOD", User.Role.HOD, "IT-EMP-099", "IT", FacultyProfile.Designation.HOD),
        ]
        for email, name, role, employee_id, dept_code, designation in guests:
            dept = departments[dept_code] if dept_code else None
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "full_name": name,
                    "role": role,
                    "department": dept,
                    "is_staff": role == User.Role.SUPER_ADMIN,
                    "is_superuser": role == User.Role.SUPER_ADMIN,
                },
            )
            if created:
                user.set_password(DEMO_PASSWORD)
                user.save()
                created_users.append((email, role))
            if employee_id:
                FacultyProfile.objects.get_or_create(
                    user=user,
                    defaults={
                        "department": dept,
                        "full_name": name,
                        "designation": designation,
                        "employee_id": employee_id,
                    },
                )

        self.stdout.write(self.style.SUCCESS("\nDemo login credentials (password is the same for all):"))
        self.stdout.write(self.style.WARNING(f"  Password: {DEMO_PASSWORD}\n"))
        for email, role in created_users:
            mfa_note = " (MFA setup will be required on first login)" if role != User.Role.FACULTY else ""
            self.stdout.write(f"  {email}  [{role}]{mfa_note}")
        if not created_users:
            self.stdout.write("  (accounts already existed — no new ones created)")
