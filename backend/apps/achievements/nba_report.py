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
import re

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    KeepTogether,
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
    "6.1.3": "Platform",
    "6.1.4": "Platform (SWAYAM/NPTEL)",
    "6.1.7": "Industry Partner",
}

# Criteria whose "Observations of Evaluators" column in the SAR Tier-I
# evaluation guidelines carries a CAYm1 / CAYm2 / CAYm3 table. For these the
# report prints, per faculty member, that very table filled with their data;
# every other criterion keeps the Sr. No. / Faculty / Activity / Date rows
# plus a "Details" column read from the attachments.
#
# Row key meanings (see _metric_for): count, ap_participation, ap_conducted,
# journal, conference, book, phd_enrolled, phd_graduated, amount
# (each a per-year value) and avg / total_* (spanned across the 3 years).
TABLE_SPECS = {
    "6.1.2.2": [
        ("Assessment points (AP) are", "ap_participation", "years"),
        ("Average Assessment points (AP) are", "ap_participation", "avg"),
    ],
    "6.1.5": [
        ("No. of FDP/STTP conducted", "count", "years"),
        ("Assessment points (AP) are", "ap_conducted", "years"),
    ],
    "6.2.1": [
        ("No. of peer reviewed journal papers", "journal", "years"),
        ("No. of peer reviewed conference papers", "conference", "years"),
        ("No. of books/book chapters", "book", "years"),
    ],
    "6.2.2": [
        ("No. of students enrolled for Ph.D. in the Department", "phd_enrolled", "years"),
        ("No. of Ph.D. students graduated in the Department", "phd_graduated", "years"),
    ],
    "6.2.4": [
        ("No. of projects received", "count", "years"),
        ("Amount (Rs. In Lakhs)", "amount", "years"),
        ("Total amount for past 3 years", "amount", "total"),
    ],
    "6.2.5": [
        ("No. of projects received", "count", "years"),
        ("Amount (Rs. In Lakhs)", "amount", "years"),
        ("Total amount for past 3 years", "amount", "total"),
    ],
    "6.2.6": [
        ("No. of projects received", "count", "years"),
        ("Amount (Rs. In Lakhs)", "amount", "years"),
        ("Total amount for past 3 years", "amount", "total"),
        ("Total amount spent for past 3 years", "spent", "total"),
    ],
}

# The three year-columns of every CAYm table. The website's data starts in
# SYSTEM_START_YEAR, so no column ever reaches back before that: the first
# three academic years from it are shown from day one, and
# from then on the window slides so it always ends at the present year with
# its two previous years (2029-30 shows 2027-28, 2028-29, 2029-30) — always
# exactly three columns, never growing.
# Temporarily 2025 so the 2025-26 year is still shown; set to 2026 when asked to drop it.
SYSTEM_START_YEAR = 2025


def report_year_window(academic_year_start: int) -> list[int]:
    first = max(SYSTEM_START_YEAR, academic_year_start - 2)
    return [first, first + 1, first + 2]


def _ordinal(n: int) -> str:
    if 11 <= n % 100 <= 13:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n:02d}{suffix}"


def _format_report_date(d) -> str:
    return f"{_ordinal(d.day)} {d.strftime('%B %Y')}"


def _academic_year_label(month: int, year: int) -> str:
    """The academic year runs June-May (A.Y. 2026-27 = June 2026 to May
    2027) — a report for any month from June onwards belongs to the A.Y.
    starting that calendar year, January-May to the one that started the
    previous year."""
    from apps.criteria.academic_year import AY_START_MONTH

    start_year = year if month >= AY_START_MONTH else year - 1
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


def _year_start_from_label(label):
    try:
        return int(str(label).split("-")[0])
    except (ValueError, IndexError):
        return None


def _facts(achievement):
    """One analysis dict per attachment of this achievement (or, when it has
    no attachment, a single one built from the submission text)."""
    from apps.achievements.analysis import analyze_text, get_or_build_analysis

    docs = list(achievement.documents.all())
    if docs:
        return [(doc, get_or_build_analysis(doc)) for doc in docs]
    return [(None, analyze_text(
        "", title=achievement.title, organization=achievement.issuing_organization,
        use_llm=False, faculty_name=achievement.faculty.full_name,
    ))]


def _leaf_suffix(achievement, leaf_ids):
    for m in achievement.criterion_mappings.all():
        if m.sub_criterion_id in leaf_ids:
            return m.sub_criterion.code.rsplit(".", 1)[-1]
    return ""


def _publication_kind(achievement, facts):
    for _doc, a in facts:
        if a.get("publication_type"):
            return a["publication_type"]
    blob = f"{achievement.title} {achievement.description} {achievement.issuing_organization}".lower()
    if any(k in blob for k in ("conference", "proceedings", "symposium")):
        return "conference"
    if any(k in blob for k in ("book", "chapter", "isbn")):
        return "book"
    return "journal"


def _first(facts, key):
    for _doc, a in facts:
        if a.get(key) not in (None, "", []):
            return a[key]
    return None


def _contribution(code, achievement, facts, suffix):
    """What one submission adds to each table metric of criterion `code`."""
    out = {}
    if code == "6.1.2.2":
        days = _first(facts, "duration_days")
        if days is not None:
            score = 5 if days > 5 else (3 if days >= 2 else 0)
        else:
            score = 5 if suffix == "b" else 3
        out["ap_participation"] = score
    elif code == "6.1.5":
        out["count"] = 1
        out["ap_conducted"] = 2
    elif code == "6.2.1":
        out[_publication_kind(achievement, facts)] = 1
    elif code == "6.2.2":
        if suffix == "b":
            out["phd_graduated"] = _first(facts, "phd_graduated") or 1
        else:
            out["phd_enrolled"] = _first(facts, "phd_enrolled") or 1
    else:  # 6.2.4 / 6.2.5 / 6.2.6
        out["count"] = 1
        amount = _first(facts, "amount_lakhs") or 0
        spent = _first(facts, "amount_spent_lakhs")
        if code == "6.2.6" and suffix == "b":
            out["spent"] = spent if spent is not None else amount
            out["count"] = 0
        else:
            out["amount"] = amount
            if spent is not None:
                out["spent"] = spent
    return out


def _fmt_iso(value):
    from datetime import date

    try:
        return date.fromisoformat(value).strftime("%d/%m/%Y")
    except (TypeError, ValueError):
        return str(value)


def _fmt_num(v):
    if v is None:
        return "Not available"
    return f"{v:g}" if isinstance(v, float) else str(v)


def _doc_filename(ev_doc):
    import os

    return re.sub(r"^v\d+_", "", os.path.basename(ev_doc.file.name)) if ev_doc is not None else ""


def _details_text(achievement, analysis, ev_doc=None):
    from apps.achievements.analysis import build_details

    rows = build_details(analysis, achievement.faculty.full_name)
    if ev_doc is not None:
        rows.insert(0, ("Attachment", _doc_filename(ev_doc)))
    return "<br/>".join(f"<b>{escape_keep_tags(k)}:</b> {escape_keep_tags(v)}" for k, v in rows) or "Not available"


def escape_keep_tags(text):
    """Escapes user/LLM text for reportlab Paragraphs but keeps our own
    <b>…</b> tags."""
    from xml.sax.saxutils import escape

    return escape(text).replace("&lt;b&gt;", "<b>").replace("&lt;/b&gt;", "</b>")


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
    # "order" is not reliable across levels (6.2.2 sorted between 6.1.2.2
    # and 6.1.3), so sort numerically by code instead.
    reportable_nodes = sorted(reportable_nodes, key=lambda n: [int(x) if x.isdigit() else 0 for x in n.code.split(".")])

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=0.55 * inch, rightMargin=0.55 * inch, topMargin=0.5 * inch, bottomMargin=0.5 * inch,
        title=f"Faculty Contribution Report, {department.name}, {month:02d}/{year}",
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
    detail_style = ParagraphStyle("RptDetail", parent=cell_style, leftIndent=14, firstLineIndent=-10)

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

    story.append(Paragraph(f"Monthly NBA Criterion 6: Faculty Contributions Report A.Y. {academic_year}", title_style))
    story.append(Paragraph(
        f"Department: {department.name} &nbsp;&nbsp;&nbsp;&nbsp;"
        f"Report for the month of: <b>{month_label}</b> &nbsp;&nbsp;&nbsp;&nbsp;"
        f"Date: {_format_report_date(today)}",
        meta_style,
    ))

    from apps.accounts.models import FacultyProfile

    from xml.sax.saxutils import escape

    cay_years = report_year_window(int(academic_year.split("-")[0]))  # CAYm1, CAYm2, CAYm3, oldest first
    cay_labels = [f"CAYm{i + 1}<br/>({y}-{str(y + 1)[-2:]})" for i, y in enumerate(cay_years)]
    next_month_start = timezone.datetime(year + (month == 12), (month % 12) + 1, 1, tzinfo=timezone.get_current_timezone())

    base_qs = (
        Achievement.objects.filter(faculty__department=department)
        .exclude(status=Achievement.Status.DRAFT)
        .select_related("faculty", "cycle")
        .prefetch_related("documents", "criterion_mappings__sub_criterion")
        .order_by("faculty__full_name", "created_at")
        .distinct()
    )

    for node in reportable_nodes:
        leaf_ids = set(_leaf_descendant_ids(node))
        story.append(Paragraph(f"{node.code}. {node.description} ({node.max_marks})", section_style))
        node_qs = base_qs.filter(criterion_mappings__sub_criterion_id__in=leaf_ids)

        if node.code in TABLE_SPECS:
            spec = TABLE_SPECS[node.code]
            per_faculty = {}
            for a in node_qs.filter(created_at__lt=next_month_start):
                y = _year_start_from_label(a.cycle.label)
                if y not in cay_years:
                    continue
                facts = _facts(a)
                if all(d is None for d, _x in facts):
                    continue  # no attachment, so nothing to report (same rule as the leaderboard)
                contrib = _contribution(node.code, a, facts, _leaf_suffix(a, leaf_ids))
                entry = per_faculty.setdefault(a.faculty_id, {"faculty": a.faculty, "years": {}, "records": []})
                bucket = entry["years"].setdefault(y, {})
                for key, value in contrib.items():
                    bucket[key] = bucket.get(key, 0) + value
                entry["records"].append((a, facts))

            if not per_faculty:
                story.append(Paragraph("NIL", cell_style))
                continue

            for entry in sorted(per_faculty.values(), key=lambda e: e["faculty"].full_name):
                story.append(Paragraph(f"<b>Faculty: {escape(entry['faculty'].full_name)}</b>", cell_style))
                story.append(Spacer(1, 3))
                # Details read from this faculty member's attachments come
                # first, the CAYm table is drawn below them.
                story.append(Paragraph("<b>Details:</b>", cell_style))
                n_rec = 0
                for ach, facts in entry["records"]:
                    for ev_doc, analysis in facts:
                        n_rec += 1
                        body = _details_text(ach, analysis, ev_doc) if ev_doc is not None else f"<b>Course / Event:</b> {escape(ach.title)}<br/>No attachment added."
                        story.append(Paragraph(f"{n_rec}. {body}", detail_style))
                        story.append(Spacer(1, 3))
                story.append(Spacer(1, 3))
                rows = [[_cell("", cell_header_style)] + [_cell(l, cell_header_style) for l in cay_labels]]
                spans = []
                for r, (label, key, mode) in enumerate(spec, start=1):
                    per_year = [entry["years"].get(y, {}).get(key, 0) for y in cay_years]
                    if key == "ap_conducted":
                        per_year = [min(v, 4) for v in per_year]
                    if key == "ap_participation":
                        per_year = [min(v, 5) for v in per_year]
                    if mode == "years":
                        rows.append([_cell(label)] + [_cell(_fmt_num(round(v, 2) if isinstance(v, float) else v)) for v in per_year])
                    else:
                        value = sum(per_year) / 3 if mode == "avg" else sum(per_year)
                        rows.append([_cell(label), _cell(_fmt_num(round(value, 2))), "", ""])
                        spans.append(("SPAN", (1, r), (3, r)))
                t = Table(rows, colWidths=[3.1 * inch, 1.4 * inch, 1.4 * inch, 1.4 * inch])
                t.setStyle(TableStyle([
                    ("GRID", (0, 0), (-1, -1), 0.75, BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                    ("TOPPADDING", (0, 0), (-1, -1), 3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ] + spans))
                story.append(t)
                story.append(Spacer(1, 8))
            continue

        # ---- criteria without an evaluator table: one row per attachment,
        # with the "Details" column read from that attachment.
        achievement_rows = list(node_qs.filter(created_at__year=year, created_at__month=month))
        extra_label = EXTRA_COLUMN_BY_CODE.get(node.code)
        if extra_label:
            headers = ["Sr. No.", "Faculty Name", "Activity / Title", extra_label, "Date", "Details"]
            col_widths = [0.4 * inch, 1.2 * inch, 1.35 * inch, 1.0 * inch, 0.8 * inch, 2.55 * inch]
        else:
            headers = ["Sr. No.", "Faculty Name", "Activity / Title", "Date", "Details"]
            col_widths = [0.4 * inch, 1.3 * inch, 1.6 * inch, 0.85 * inch, 3.15 * inch]

        rows = [[_cell(h, cell_header_style) for h in headers]]
        # One row per faculty member, however many submissions / attachments
        # they have under this criterion: every attachment contributes a
        # numbered entry inside that single row's cells.
        per_faculty = {}
        for a in achievement_rows:
            for ev_doc, analysis in _facts(a):
                if ev_doc is None:
                    continue  # a submission with no attachment is not reported
                per_faculty.setdefault(a.faculty_id, {"faculty": a.faculty, "items": []})["items"].append((a, ev_doc, analysis))

        n = 0
        for group in sorted(per_faculty.values(), key=lambda g: g["faculty"].full_name):
            n += 1
            items = group["items"]
            many = len(items) > 1

            def numbered(i, text):
                return f"{i}. {text}" if many else text

            titles, orgs, dates, details = [], [], [], []
            for i, (a, ev_doc, analysis) in enumerate(items, start=1):
                start, end = analysis.get("start_date"), analysis.get("end_date")
                if start:
                    d1 = _fmt_iso(start)
                    date_text = d1 if not end or end == start else f"{d1} to {_fmt_iso(end)}"
                else:
                    date_text = (a.achievement_date or a.created_at.date()).strftime("%d/%m/%Y")
                titles.append(numbered(i, escape(analysis.get("title") or a.title)))
                orgs.append(numbered(i, escape(analysis.get("organization") or a.issuing_organization or "Not stated")))
                dates.append(numbered(i, date_text))
                body = _details_text(a, analysis, ev_doc) if ev_doc is not None else "No attachment added."
                details.append(numbered(i, body))

            row = [_cell(n), _cell(escape(group["faculty"].full_name)), _cell("<br/>".join(titles))]
            if extra_label:
                row.append(_cell("<br/>".join(orgs)))
            row.append(_cell("<br/>".join(dates)))
            row.append(_cell("<br/><br/>".join(details)))
            rows.append(row)
        if n == 0:
            rows.append([_cell("")] + [_cell("NIL")] * (len(headers) - 1))

        table = Table(rows, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.75, BORDER),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(table)

    # Extra blank room above each printed name — this is where the actual
    # pen signature goes once the report is printed, so it needs real
    # space, not just a gap between the last table and the names.
    tail_gap = Spacer(1, 50)

    rd_coordinator = _find_rd_coordinator(department)
    hod = _find_role_holder(department, FacultyProfile.Designation.HOD)
    deputy_hod = _find_role_holder(department, FacultyProfile.Designation.DEPUTY_HOD)
    sig_date = _format_report_date(today)

    def _sig_cell(profile, role_label):
        name = profile.full_name if profile else "Not assigned"
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
    # The signature block must never end up alone on a page: pull the last
    # few flowables of the report (back to the last criterion heading, but
    # at most ~3.2 inches of it) into one KeepTogether with the signatures,
    # so if they do not fit on the current page the content moves down with
    # them.
    tail, tail_height = [], 0
    while story and len(tail) < 6:
        flowable = story[-1]
        height = flowable.wrap(doc.width, 10000)[1]
        if tail and tail_height + height > 3.2 * inch:
            break
        tail.insert(0, story.pop())
        tail_height += height
        if isinstance(flowable, Paragraph) and flowable.style.name == "RptSection":
            break
    story.append(KeepTogether(tail + [tail_gap, sig_table]))

    doc.build(story)
    buffer.seek(0)
    return buffer
