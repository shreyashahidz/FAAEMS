"""Monthly NBA Criterion 6 (Faculty Contributions) report — HOD-only, see
FacultyProfileViewSet.nba_report. Built fresh every time it's requested
(always reflects live data, never a stored snapshot) so a submission made
five minutes ago already shows up, and so a department's current HOD /
Deputy HOD / R&D Coordinator are whoever actually holds those roles today,
not whoever held them when some earlier report was generated.

Styled after the institution's own "Monthly Research Progress Report"
format (TCET/DEPT/FRM/IP-11/03) — same header banner, same document-control
line, same Department/Report-for-the-month/Date line, same plain
(non-bold), stacked Name/Role/Date signature block.
"""

import io
import os

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

HEADER_IMAGE_PATH = os.path.join(os.path.dirname(__file__), "report_assets", "nba_report_header.png")

BLACK = colors.HexColor("#111111")
BORDER = colors.black

SERIF = "Times-Roman"
SERIF_BOLD = "Times-Bold"

# Every reportable sub-criterion gets Sr. No. / Faculty Name / Activity /
# Title / Date — the same core columns regardless of topic — plus one more
# column where the evaluation guidelines (3-Evaluation Guidelines
# -UG-Eng-T1-14-1-2025) actually call for an external detail (a society, a
# host institute, a funding agency, ...). Where the guideline's own
# "Exhibits/Context to be Observed/Assessed" text never mentions anything
# external — department-run activities like mentoring, an internally
# organized FDP, or an institution's own seed money — there's no such
# column at all, rather than a generic "Organization" field that would
# just repeat this department's own name on every row.
EXTRA_COLUMN_BY_CODE = {
    "6.1.1": "Professional Society",
    "6.1.2.1": "Program / Institute",
    "6.1.2.2": "Program / Institute",
    "6.1.3": "Platform",
    "6.1.4": "Platform (SWAYAM/NPTEL)",
    "6.1.7": "Industry Partner",
    "6.2.1": "Journal / Publisher",
    "6.2.4": "Funding Agency",
    "6.2.5": "Client / Industry",
}


def _ordinal(n: int) -> str:
    if 11 <= n % 100 <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n:02d}{suffix}"


def _format_report_date(d) -> str:
    return f"{_ordinal(d.day)} {d.strftime('%B %Y')}"


def _academic_year_label(month: int, year: int) -> str:
    """July-June academic year, matching the institution's own convention
    (see the reference report's "A.Y. 2025-26") — a report for any month
    from July through December belongs to the AY starting that same
    calendar year; January through June belongs to the AY that started the
    previous calendar year."""
    start_year = year if month >= 7 else year - 1
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def _leaf_descendant_ids(sub_criterion):
    """A faculty submission always links to a *leaf* SubCriterion (one with
    no children — see SubCriterion's own docstring on why), several levels
    below the numbered, marks-bearing node (e.g. 6.1.2.1) this report
    groups by. Walks down to collect every leaf under that node so the
    achievement query can match any of them."""
    children = list(sub_criterion.children.all())
    if not children:
        return [sub_criterion.id]
    ids = []
    for child in children:
        ids.extend(_leaf_descendant_ids(child))
    return ids


def _find_role_holder(department, designation):
    from apps.accounts.models import FacultyProfile, currently_active_faculty_q

    return (
        FacultyProfile.objects.filter(currently_active_faculty_q(), department=department, designation=designation)
        .order_by("full_name")
        .first()
    )


def _find_rd_coordinator(department):
    """No dedicated "R&D Coordinator" field exists — whoever currently
    holds that role is identified by the phrase appearing in their own
    bio/dossier summary (which they, or the HOD on their behalf, keep up
    to date), so the signatory here changes automatically the moment that
    text changes, without a code change or a new designation value."""
    from apps.accounts.models import FacultyProfile, currently_active_faculty_q

    candidates = FacultyProfile.objects.filter(currently_active_faculty_q(), department=department).order_by(
        "full_name"
    )
    for fp in candidates:
        bio = (fp.bio or "").lower()
        if "r&d coordinator" in bio or "r & d coordinator" in bio or "rnd coordinator" in bio:
            return fp
    return None


def available_report_years():
    """2025 through next calendar year — always includes the year ahead so
    a department never has to wait for an explicit "add year" step the
    moment January 1st turns over; see FacultyProfileViewSet.nba_report."""
    current_year = timezone.localdate().year
    return list(range(2025, current_year + 2))


def generate_monthly_nba_report(department, month: int, year: int) -> io.BytesIO:
    from apps.achievements.models import Achievement
    from apps.criteria.models import SubCriterion

    reportable_nodes = (
        SubCriterion.objects.filter(criterion__code="6", criterion__framework__code="NBA", max_marks__gt=0)
        .order_by("order", "code")
    )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=0.55 * inch, rightMargin=0.55 * inch, topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        title=f"NBA Criterion 6 Report — {department.name} — {month:02d}/{year}",
    )

    styles = getSampleStyleSheet()
    doc_control_style = ParagraphStyle(
        "RptDocControl", parent=styles["Normal"], fontName=SERIF, fontSize=9, textColor=BLACK, leading=12,
    )
    doc_control_right_style = ParagraphStyle(
        "RptDocControlRight", parent=doc_control_style, alignment=2,
    )
    title_style = ParagraphStyle(
        "RptTitle", parent=styles["Title"], fontName=SERIF_BOLD, fontSize=13, textColor=BLACK,
        alignment=1, spaceBefore=8, spaceAfter=6,
    )
    meta_style = ParagraphStyle(
        "RptMeta", parent=styles["Normal"], fontName=SERIF, fontSize=10, textColor=BLACK,
        alignment=1, spaceAfter=10,
    )
    section_style = ParagraphStyle(
        "RptSection", parent=styles["Heading2"], fontName=SERIF_BOLD, fontSize=10.5, textColor=BLACK,
        spaceBefore=12, spaceAfter=4,
    )
    sig_style = ParagraphStyle("RptSig", parent=styles["Normal"], fontName=SERIF, fontSize=9.3, leading=13, alignment=1)
    cell_style = ParagraphStyle("RptCell", parent=styles["Normal"], fontName=SERIF, fontSize=8.6, leading=10.8)
    cell_header_style = ParagraphStyle("RptCellHeader", parent=cell_style, fontName=SERIF_BOLD)

    def _cell(text, style=cell_style):
        return Paragraph(str(text), style)

    today = timezone.localdate()
    month_label = timezone.datetime(year, month, 1).strftime("%B %Y")
    academic_year = _academic_year_label(month, year)

    story = []
    if os.path.exists(HEADER_IMAGE_PATH):
        img_w = 7.4 * inch
        img_h = img_w * (299 / 2000)
        story.append(Image(HEADER_IMAGE_PATH, width=img_w, height=img_h))
        story.append(Spacer(1, 8))

    # Document-control block — mirrors the institution's own
    # TCET/DEPT/FRM/IP-11/03 report header exactly, but with the
    # department code, month and year driven by what the HOD actually
    # selected rather than hand-typed.
    doc_control = Table(
        [
            [Paragraph(f"TCET/{department.code}/ &nbsp; of {month_label}", doc_control_style), ""],
            [Paragraph("TCET/DEPT/FRM/IP-11/03", doc_control_style),
             Paragraph("Revision: A", doc_control_right_style)],
        ],
        colWidths=[5.4 * inch, 1.9 * inch],
    )
    doc_control.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(doc_control)

    story.append(Paragraph(f"Monthly NBA Criterion 6 — Faculty Contributions Report A.Y. {academic_year}", title_style))
    story.append(Paragraph(
        f"Department: {department.name} &nbsp;&nbsp;&nbsp;&nbsp;"
        f"Report for the month of: <b>{month_label}</b> &nbsp;&nbsp;&nbsp;&nbsp;"
        f"Date: {_format_report_date(today)}",
        meta_style,
    ))

    from apps.accounts.models import FacultyProfile

    for node in reportable_nodes:
        leaf_ids = _leaf_descendant_ids(node)
        achievement_rows = list(
            Achievement.objects.filter(
                faculty__department=department,
                criterion_mappings__sub_criterion_id__in=leaf_ids,
                created_at__year=year,
                created_at__month=month,
            )
            .exclude(status=Achievement.Status.DRAFT)
            .select_related("faculty")
            .order_by("faculty__full_name", "created_at")
            .distinct()
        )

        extra_label = EXTRA_COLUMN_BY_CODE.get(node.code)
        if extra_label:
            headers = ["Sr. No.", "Faculty Name", "Activity / Title", extra_label, "Date"]
            col_widths = [0.5 * inch, 1.7 * inch, 2.3 * inch, 1.6 * inch, 0.7 * inch]
        else:
            headers = ["Sr. No.", "Faculty Name", "Activity / Title", "Date"]
            col_widths = [0.5 * inch, 2.3 * inch, 3.3 * inch, 0.7 * inch]

        story.append(Paragraph(f"{node.code}. {node.description} ({node.max_marks})", section_style))
        rows = [[_cell(h, cell_header_style) for h in headers]]
        if achievement_rows:
            for i, a in enumerate(achievement_rows, start=1):
                activity_date = a.achievement_date or a.created_at.date()
                row = [_cell(i), _cell(a.faculty.full_name), _cell(a.title)]
                if extra_label:
                    row.append(_cell(a.issuing_organization or "—"))
                row.append(_cell(activity_date.strftime("%d/%m/%Y")))
                rows.append(row)
        else:
            nil_row = [_cell("—"), _cell("NIL"), _cell("NIL")]
            if extra_label:
                nil_row.append(_cell("NIL"))
            nil_row.append(_cell("NIL"))
            rows.append(nil_row)

        table = Table(rows, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.75, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(table)

    # Extra blank room above each printed name — this is where the actual
    # pen signature goes once the report is printed, so it needs real
    # space, not just a gap between the last table and the names.
    story.append(Spacer(1, 50))

    rd_coordinator = _find_rd_coordinator(department)
    hod = _find_role_holder(department, FacultyProfile.Designation.HOD)
    deputy_hod = _find_role_holder(department, FacultyProfile.Designation.DEPUTY_HOD)
    sig_date = _format_report_date(today)

    def _sig_cell(profile, role_label):
        name = profile.full_name if profile else "—"
        return Paragraph(f"{name}<br/>{role_label}<br/>Date: {sig_date}", sig_style)

    sig_table = Table(
        [[
            _sig_cell(rd_coordinator, "R&amp;D Co-ordinator"),
            _sig_cell(hod, "HOD"),
            _sig_cell(deputy_hod, "Deputy HOD"),
        ]],
        colWidths=[2.43 * inch, 2.43 * inch, 2.43 * inch],
    )
    sig_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(sig_table)

    doc.build(story)
    buffer.seek(0)
    return buffer
