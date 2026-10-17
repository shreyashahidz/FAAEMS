"""Attachment analysis — turns the raw OCR / extracted text of an uploaded
evidence document into structured facts (who/what/when/where, counts,
amounts) that the monthly NBA report is built from.

Two layers, so the report never depends on the LLM being reachable:

1. A local LLM (Ollama, running on the college LAN — no cloud API) is asked
   to return a strict JSON object for the document.
2. A rule-based extractor (regex / keyword heuristics) always runs as the
   fallback, and also fills any field the LLM left empty.

Like OCR (see ocr.py), analysis is best-effort and must never block or
break an upload: every public function swallows failures and degrades to
"fewer fields".
"""

import hashlib
import io
import json
import logging
import re
import threading
from datetime import date, datetime

from django.conf import settings

logger = logging.getLogger("faems")

MAX_PROMPT_CHARS = 3000

# Bump when the extraction logic changes: stored analyses from an older version
# are recomputed (rule-based, instantly) at report time and by `reanalyze_attachments`.
ANALYSIS_VERSION = 3

MONTHS = {
    "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3, "apr": 4, "april": 4,
    "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7, "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9, "oct": 10, "october": 10, "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}
_MONTH_NAMES = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"

ROLE_LABELS = {
    "attended": "Attended / participated",
    "resource_person": "Resource person",
    "speaker": "Speaker",
    "organizer": "Organizer / coordinator",
    "member": "Member",
    "author": "Author",
    "mentor": "Mentor / facilitator",
    "certified": "Completed course / certified",
    "principal_investigator": "Principal investigator",
    "other": "",
}

# Words that genuinely indicate the faculty member *taught / spoke* (as opposed to
# attending or completing something). Anything else is not a speaker role.
SPEAKER_MARKERS = r"resource person|speaker|delivered|invited (?:talk|lecture)|expert (?:talk|lecture)|guest lecture|keynote|panelist|session (?:chair|handled)|trainer|conducted (?:a )?(?:session|workshop)"

PLATFORM_HINTS = [
    ("ude.my", "Udemy"), ("udemy", "Udemy"), ("coursera", "Coursera"), ("nptel", "NPTEL"),
    ("swayam", "SWAYAM"), ("edx", "edX"), ("linkedin learning", "LinkedIn Learning"),
]

SCHEMA_KEYS = [
    "title", "organization", "start_date", "end_date", "duration_days", "duration_hours", "recipient_name", "additional_details", "role", "topic",
    "speakers", "co_speakers", "venue", "purpose", "summary",
    "publication_type", "publication_venue", "count",
    "amount_lakhs", "amount_spent_lakhs", "funding_agency",
    "phd_enrolled", "phd_graduated",
]


# ---------------------------------------------------------------- helpers

def _to_date(value):
    if not value:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    return None


def _num(value):
    if value in (None, "", "null"):
        return None
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return None


def _int(value):
    n = _num(value)
    return int(n) if n is not None and n >= 0 else None


def _str_list(value):
    if not value:
        return []
    if isinstance(value, str):
        value = [v for v in re.split(r"[;,]| and ", value) if v.strip()]
    return [str(v).strip() for v in value if str(v).strip()][:6]


_NULLISH = {"null", "none", "n/a", "na", "unknown", "not specified", "not mentioned", "-", "—"}


def _clean(value):
    """Small models sometimes write the literal word "null" (or "N/A") into
    string fields — treat all of those as empty."""
    if isinstance(value, str):
        v = value.strip()
        return "" if v.lower() in _NULLISH else v
    if isinstance(value, list):
        return [x for x in (_clean(i) for i in value) if x]
    return value


def _detail_list(value):
    """"Label: value" strings for anything noteworthy the fixed fields do not
    cover (score, credits, certificate number, invigilator, mode ...)."""
    if isinstance(value, dict):
        value = [f"{k}: {v}" for k, v in value.items()]
    if isinstance(value, str):
        value = [v for v in re.split(r"[;\n]", value) if v.strip()]
    out = []
    for item in value or []:
        text = re.sub(r"\s+", " ", str(item)).strip(" -•")
        if text and text.lower() not in _NULLISH and text not in out:
            out.append(text[:160])
    return out[:8]


def _merge_details(*lists):
    """Union of several detail lists, de-duplicated by label."""
    seen, out = set(), []
    for lst in lists:
        for item in _detail_list(lst):
            key = item.split(":", 1)[0].strip().lower()
            if key not in seen:
                seen.add(key)
                out.append(item)
    return out[:8]


def normalize(raw):
    """Coerce LLM / rule output into the fixed schema with proper types."""
    raw = {k: _clean(v) for k, v in (raw if isinstance(raw, dict) else {}).items()}
    start, end = _to_date(raw.get("start_date")), _to_date(raw.get("end_date"))
    if start and end and end < start:
        start, end = end, start
    role = str(raw.get("role") or "").strip().lower().replace(" ", "_").replace("/", "_")
    if role not in ROLE_LABELS:
        role = "other"
    pub = str(raw.get("publication_type") or "").strip().lower()
    pub = {"book chapter": "book", "book_chapter": "book", "books": "book", "conf": "conference"}.get(pub, pub)
    if pub not in {"journal", "conference", "book"}:
        pub = ""
    duration = _int(raw.get("duration_days"))
    if duration is None and start and end:
        duration = (end - start).days + 1
    return {
        "title": str(raw.get("title") or "").strip()[:255],
        "organization": str(raw.get("organization") or "").strip()[:255],
        "start_date": start.isoformat() if start else "",
        "end_date": end.isoformat() if end else "",
        "duration_days": duration,
        "duration_hours": _num(raw.get("duration_hours")),
        "additional_details": _detail_list(raw.get("additional_details")),
        "recipient_name": str(raw.get("recipient_name") or "").strip()[:150],
        "role": role,
        "topic": str(raw.get("topic") or "").strip()[:255],
        "speakers": _str_list(raw.get("speakers")),
        "co_speakers": _str_list(raw.get("co_speakers")),
        "venue": str(raw.get("venue") or "").strip()[:255],
        "purpose": str(raw.get("purpose") or "").strip()[:400],
        "summary": str(raw.get("summary") or "").strip()[:600],
        "publication_type": pub,
        "publication_venue": str(raw.get("publication_venue") or "").strip()[:255],
        "count": _int(raw.get("count")),
        "amount_lakhs": _num(raw.get("amount_lakhs")),
        "amount_spent_lakhs": _num(raw.get("amount_spent_lakhs")),
        "funding_agency": str(raw.get("funding_agency") or "").strip()[:255],
        "phd_enrolled": _int(raw.get("phd_enrolled")),
        "phd_graduated": _int(raw.get("phd_graduated")),
    }


# ------------------------------------------------------- rule-based layer

def _find_dates(text):
    """Returns (start, end) dates found in the text, handling the common
    certificate phrasings: '12 January 2026 to 16 January 2026',
    '12-16 January 2026', '12/01/2026', 'January 12, 2026'."""
    t = re.sub(r"\s+", " ", text)
    m = re.search(
        rf"(?<!\d)(\d{{1,2}})(?:st|nd|rd|th)?\s*(?:-|–|to|and)\s*(\d{{1,2}})(?:st|nd|rd|th)?\s*,?\s*({_MONTH_NAMES})\.?,?\s*(\d{{4}})",
        t, re.I,
    )
    if m:
        mo = MONTHS[m.group(3).lower().rstrip(".")]
        try:
            return date(int(m.group(4)), mo, int(m.group(1))), date(int(m.group(4)), mo, int(m.group(2)))
        except ValueError:
            pass
    found = []
    for m in re.finditer(rf"(?<!\d)(\d{{1,2}})(?:st|nd|rd|th)?\s+({_MONTH_NAMES})\.?,?\s+(\d{{4}})", t, re.I):
        try:
            found.append(date(int(m.group(3)), MONTHS[m.group(2).lower().rstrip(".")], int(m.group(1))))
        except ValueError:
            pass
    for m in re.finditer(rf"({_MONTH_NAMES})\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})", t, re.I):
        try:
            found.append(date(int(m.group(3)), MONTHS[m.group(1).lower().rstrip(".")], int(m.group(2))))
        except ValueError:
            pass
    for m in re.finditer(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b", t):
        try:
            found.append(date(int(m.group(3)), int(m.group(2)), int(m.group(1))))
        except ValueError:
            pass
    for m in re.finditer(r"\b(\d{4})-(\d{2})-(\d{2})\b", t):
        try:
            found.append(date(int(m.group(1)), int(m.group(2)), int(m.group(3))))
        except ValueError:
            pass
    if not found:
        return None, None
    found = sorted(set(found))
    return found[0], found[-1] if len(found) > 1 else found[0]


def _find_amount_lakhs(text):
    t = text.replace(",", "")
    m = re.search(r"(?:rs\.?|inr|₹)\s*([\d.]+)\s*(lakhs?|lacs?|crores?|cr)\b", t, re.I)
    if m:
        value = float(m.group(1)) if m.group(1).replace(".", "", 1).isdigit() else None
        if value is not None:
            return round(value * (100 if m.group(2).lower().startswith("c") else 1), 2)
    m = re.search(r"([\d.]+)\s*(lakhs?|lacs?)\b", t, re.I)
    if m and m.group(1).replace(".", "", 1).isdigit():
        return round(float(m.group(1)), 2)
    m = re.search(r"(?:rs\.?|inr|₹)\s*/?-?\s*(\d{4,9})(?:\.\d+)?", t, re.I)
    if m:
        return round(int(m.group(1)) / 100000, 2)
    return None


def rule_based_analysis(text, title="", organization=""):
    text = text or ""
    low = text.lower()
    out = {"title": "", "organization": organization}

    start, end = _find_dates(text)
    if start:
        out["start_date"], out["end_date"] = start.isoformat(), (end or start).isoformat()

    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:total\s*)?(?:hours?|hrs?)\b", low)
    if m:
        out["duration_hours"] = float(m.group(1))
    m = re.search(r"(\d{1,2}|one|two|three|four|five|six|seven|eight|ten)[\s-]*(?:days?|day)\b", low)
    words = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "ten": 10}
    if m:
        out["duration_days"] = int(m.group(1)) if m.group(1).isdigit() else words[m.group(1)]

    if re.search(r"certificate of (?:completion|achievement)|successfully completed|has completed|completion", low) and not re.search(SPEAKER_MARKERS, low):
        out["role"] = "certified"
    elif re.search(r"resource person|invited (?:talk|lecture)|expert (?:talk|lecture)|delivered|guest (?:lecture|speaker)|session (?:chair|handled)", low):
        out["role"] = "resource_person"
    elif re.search(r"organi[sz]ed|convener|co-?ordinator|conducted by", low) and not re.search(r"participat|attended", low):
        out["role"] = "organizer"
    elif re.search(r"participated|attended|participation|successfully completed|has completed", low):
        out["role"] = "attended"
    elif re.search(r"\bmember(?:ship)?\b", low):
        out["role"] = "member"
    elif re.search(r"mentor|facilitat", low):
        out["role"] = "mentor"

    m = re.search(r"(?:on|titled|entitled|topic[:\s]*)\s*[\"'“‘]([^\"'”’]{4,120})[\"'”’]", text, re.I)
    if m:
        out["topic"] = m.group(1).strip()
    elif (m := re.search(r"\bon the topic\s+([A-Z][^.\n]{4,100})", text)):
        out["topic"] = m.group(1).strip()

    m = re.search(
        r"(?i:instructors?)\s*[:\-]?\s*((?:[A-Z][\w&.\-]*\s+){0,3}?(?:Inc\.?|Ltd\.?|LLC|LLP|Pvt\.?(?: Ltd\.?)?|University|Institute|Academy)|(?:(?:Dr|Prof|Mr|Ms|Mrs)\.?\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})",
        text,
    )
    if m:
        out["speakers"] = [m.group(1).strip()]

    m = re.search(
        r"\b((?:FDP|STTP|workshop|webinar|seminar|course|training|program(?:me)?|conference|hackathon|bootcamp)\s+(?:on|in|for)\s+[A-Z][\w &/\-]{3,60}?)(?=\s+(?:organi[sz]ed|conducted|from|at|by|held|on|during)\b|\s*[.,;\n]|\s*$)",
        text,
    )
    if m:
        out["title"] = m.group(1).strip()

    m = re.search(r"(?:co-?speaker|jointly with|along with|together with)\s+((?:(?:Dr|Prof|Mr|Ms|Mrs)\.?\s+)?[A-Z][\w.]*(?:\s+[A-Z][\w.]*){0,3})", text)
    if m:
        out["co_speakers"] = [m.group(1).strip().rstrip(".")]

    if not organization:
        from apps.achievements.ocr import KNOWN_ORGANIZATIONS

        for org in KNOWN_ORGANIZATIONS:
            if re.search(r"\b" + re.escape(org) + r"\b", text, re.I):
                out["organization"] = org
                break
    for needle, platform in PLATFORM_HINTS:
        if needle in low:
            out["organization"] = platform
            out["_platform"] = True
            break
    if not out.get("organization"):
        m = re.search(r"(?:organi[sz]ed by|conducted by|offered by|issued by|sponsored by)\s+([A-Z][^\n.,;]*?)(?=\s+(?:from|on|at|during|for|in|between|dated)\b|\s*[.,;\n]|\s*$)", text)
        if m:
            out["organization"] = m.group(1).strip()
    m = re.search(r"(?:funding agency|sponsored by|funded by|sanctioned by)\s*[:\-]?\s*([A-Z][^\n.,;]{2,60})", text, re.I)
    if m:
        out["funding_agency"] = m.group(1).strip()

    amount = _find_amount_lakhs(text)
    if amount is not None:
        out["amount_lakhs"] = amount
    m = re.search(r"(?:utili[sz]ed|spent|expenditure)[^\d₹]{0,40}(?:rs\.?|inr|₹)?\s*([\d,.]+)\s*(lakhs?|lacs?)?", low)
    if m and m.group(2):
        try:
            out["amount_spent_lakhs"] = float(m.group(1).replace(",", ""))
        except ValueError:
            pass

    if re.search(r"\bissn\b|\bvolume\b|\bjournal\b|\bimpact factor\b|\bdoi\b", low):
        out["publication_type"] = "journal"
    if re.search(r"conference|proceedings|symposium|\bicc\b|international conf", low):
        out["publication_type"] = "conference"
    if re.search(r"\bisbn\b|book chapter|\bchapter\b|\bpublisher\b", low) and "journal" not in low:
        out["publication_type"] = "book"

    m = re.search(r"(\d+)\s*(?:students?\s*)?(?:enrolled|registered)", low)
    if m:
        out["phd_enrolled"] = int(m.group(1))
    m = re.search(r"(\d+)\s*(?:ph\.?\s*d\.?\s*)?(?:students?\s*)?(?:graduated|awarded)", low)
    if m:
        out["phd_graduated"] = int(m.group(1))
    extras = []
    m = re.search(r"(?:certificate|reg(?:istration)?|reference|roll)\s*(?:no|number|id)\.?\s*[:\-#]?\s*([A-Za-z0-9][A-Za-z0-9\-_/]{3,})", text, re.I)
    if m:
        extras.append(f"Certificate / reference no: {m.group(1)}")
    for label in ("Score", "Grade", "Marks", "Percentage", "CGPA", "Credits", "Rank", "Position"):
        m = re.search(rf"\b{label}\s*[:\-]?\s*([\d.]+\s*%?(?:\s*/\s*\d+)?|[A-F][+\-]?)(?![A-Za-z])", text)
        if m and m.group(1).strip():
            extras.append(f"{label}: {m.group(1).strip()}")
    m = re.search(r"\b(online|offline|virtual|hybrid|in-person|remote(?:ly)?)\b", low)
    if m:
        extras.append("Mode: " + {"remotely": "Online (remote)", "remote": "Online (remote)"}.get(m.group(1), m.group(1).capitalize()))
    m = re.search(r"invigilated by\s+([A-Za-z .]{3,40})|invigilator\s*[:\-]?\s*([A-Za-z .]{3,40})", text, re.I)
    if m:
        extras.append("Invigilator: " + (m.group(1) or m.group(2)).strip())
    if extras:
        out["additional_details"] = extras
    return out


# ------------------------------------------------------------- LLM layer

FIELD_HELP = {
    "title": "short name of the activity / event / paper / project",
    "organization": "institute, society, platform or company that issued or organised it",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD (same as start_date for a one-day event)",
    "summary": "ONE factual sentence, max 25 words: what this faculty member did (role, topic, dates, co-speakers)",
    "role": "attended | resource_person | speaker | organizer | member | author | mentor | certified | principal_investigator | other",
    "duration_days": "integer number of DAYS the event lasted (null if given in hours, or for projects/papers)",
    "duration_hours": "number of HOURS if the duration is given in hours (e.g. 46 total hours), else null",
    "recipient_name": "name of the person the certificate/letter is awarded to",
    "additional_details": "list of up to 6 OTHER noteworthy facts as short 'Label: value' strings, for example Score: 85%, Credits: 4, Grade, Certificate no, Mode: Online, Organised by: <person>, Invigilator, Sponsor, Level, Place - anything useful that the other fields do not already hold",
    "topic": "topic of the talk / course / paper / project",
    "speakers": "list of instructors / speakers / resource persons named (not the recipient)",
    "co_speakers": "list of OTHER speakers who spoke together with this faculty member",
    "venue": "place of the event",
    "purpose": "why it was held, one short sentence",
    "publication_type": "journal | conference | book",
    "publication_venue": "journal / conference / publisher name",
    "amount_lakhs": "sanctioned / received amount as a number in Rs. lakhs (1 lakh = 100000)",
    "amount_spent_lakhs": "amount spent / utilised, number in Rs. lakhs",
    "funding_agency": "agency / client that funded it",
    "phd_enrolled": "integer",
    "phd_graduated": "integer",
}
# No "summary" here on purpose: the model generates ~4 tokens/s on this CPU, so
# every extra sentence costs ~10 s; the summary is built from the fields instead.
BASE_FIELDS = ["title", "organization", "start_date", "end_date", "additional_details"]
FIELDS_BY_CRITERION = {
    "6.2.1": ["publication_type", "publication_venue"],
    "6.2.2": ["phd_enrolled", "phd_graduated"],
    "6.2.3": ["topic"],
    "6.2.4": ["funding_agency", "amount_lakhs", "topic"],
    "6.2.5": ["funding_agency", "amount_lakhs", "topic"],
    "6.2.6": ["amount_lakhs", "amount_spent_lakhs"],
}
EVENT_FIELDS = ["recipient_name", "role", "duration_days", "duration_hours", "topic", "speakers", "co_speakers", "venue", "purpose"]

PROMPT = """Extract facts from the OCR text of ONE document a faculty member uploaded as evidence for: "{criterion}".
Rules:
- The person the certificate is AWARDED TO (the faculty member) is the recipient. Put their name in recipient_name; NEVER list them under speakers or co_speakers unless the text says they delivered/spoke at the event.
- "speakers" are other people who taught or spoke (instructors, trainers, resource persons). People who only organised, invigilated or signed go into additional_details, not speakers.
- Capture EVERYTHING else the document says that a reviewer would care about (scores, credits, marks, grade, mode, certificate number, who organised or invigilated) in additional_details.
- Choose role "attended" for participation certificates, "certified" for certificates of completion of a course, and "resource_person" or "speaker" ONLY if the text says the recipient delivered a talk/session.
- Durations written in hours go in duration_hours, never in duration_days.
- "organization" is who issued the certificate or ran the programme (a platform or institute such as Udemy, NPTEL, IIT Bombay), not an individual.
Return ONLY a JSON object with these keys (null or [] when the text does not say; never invent):
{fields}

TEXT:
{text}
"""


def _fields_for(criterion_label):
    m = re.match(r"\s*(6\.\d+\.\d+)", criterion_label or "")
    code = m.group(1) if m else ""
    extra = FIELDS_BY_CRITERION.get(code, EVENT_FIELDS)
    return BASE_FIELDS + extra


def build_prompt(text, criterion_label=""):
    fields = "\n".join(f"{k}: {FIELD_HELP[k]}" for k in _fields_for(criterion_label))
    return PROMPT.format(criterion=criterion_label or "faculty contribution", fields=fields, text=text[:MAX_PROMPT_CHARS])


_LLM_LOCK = threading.Lock()
_LLM_CACHE = {}
_IMAGE_CACHE = {}


def describe_image(image_bytes):
    """One-sentence description of a photo that has no readable text, from
    the local vision model (gemma3). Best-effort: returns "" on any problem.
    The model is unloaded straight after (keep_alive 0) so it never competes
    with the text model for RAM."""
    if not getattr(settings, "ANALYSIS_USE_VISION", True):
        return ""
    digest = hashlib.md5(image_bytes).hexdigest()
    if digest in _IMAGE_CACHE:
        return _IMAGE_CACHE[digest]
    try:
        import base64

        import requests
        from PIL import Image, ImageOps

        img = ImageOps.exif_transpose(Image.open(io.BytesIO(image_bytes))).convert("RGB")
        img.thumbnail((768, 768))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=80)
        with _LLM_LOCK:
            response = requests.post(
                f"{settings.OLLAMA_URL.rstrip('/')}/api/generate",
                json={
                    "model": getattr(settings, "OLLAMA_VISION_MODEL", "gemma3:latest"),
                    "prompt": "Describe this image in one factual sentence of at most 25 words. If it shows an event, a certificate or a document, say what it is and mention any visible names, dates or titles.",
                    "images": [base64.b64encode(buf.getvalue()).decode()],
                    "stream": False,
                    "keep_alive": 0,
                    "options": {"temperature": 0, "num_predict": 70},
                },
                timeout=settings.OLLAMA_TIMEOUT,
            )
        response.raise_for_status()
        _IMAGE_CACHE[digest] = re.sub(r"\s+", " ", response.json().get("response", "")).strip()[:240]
        return _IMAGE_CACHE[digest]
    except Exception as exc:  # noqa: BLE001
        logger.warning("Image description unavailable: %s", exc)
        return ""


def _call_ollama(prompt):
    import requests

    # One request at a time: Ollama serialises them anyway, and letting several
    # upload threads wait inside requests.post would make later ones hit the
    # timeout while merely queued and fall back to the weaker rule-based result.
    _LLM_LOCK.acquire()
    try:
        response = _post(requests, prompt)
    finally:
        _LLM_LOCK.release()
    return json.loads(response.json().get("response", "{}"))


def _post(requests, prompt):
    response = requests.post(
        f"{settings.OLLAMA_URL.rstrip('/')}/api/generate",
        json={
            "model": settings.OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            # Keep the model resident between uploads (the default unloads it
            # after 5 minutes, and a cold load costs ~30-60 s on CPU) and
            # cap both context and output length — on a CPU-only server
            # generation time is dominated by how many tokens are read/written.
            "keep_alive": getattr(settings, "OLLAMA_KEEP_ALIVE", "24h"),
            "options": {"temperature": 0, "num_ctx": 2048, "num_predict": 320},
        },
        timeout=settings.OLLAMA_TIMEOUT,
    )
    response.raise_for_status()
    return response


def llm_analysis(text, criterion_label=""):
    if not getattr(settings, "ANALYSIS_USE_LLM", True) or not (text or "").strip():
        return None
    prompt = build_prompt(text, criterion_label)
    key = hashlib.md5(prompt.encode("utf-8", "ignore")).hexdigest()
    if key in _LLM_CACHE:  # the same file uploaded again (e.g. by several faculty) costs nothing
        return _LLM_CACHE[key]
    try:
        result = _call_ollama(prompt)
        if len(_LLM_CACHE) > 200:
            _LLM_CACHE.clear()
        _LLM_CACHE[key] = result
        return result
    except Exception as exc:  # noqa: BLE001 — LLM is optional, rules take over
        logger.warning("LLM analysis unavailable, using rule-based extraction: %s", exc)
        return None


# ------------------------------------------------------------- public API

def _same_person(a, b):
    def key(n):
        n = re.sub(r"\b(dr|prof|mr|mrs|ms|miss)\b\.?", "", (n or "").lower())
        return set(re.findall(r"[a-z]{2,}", n))
    ka, kb = key(a), key(b)
    return bool(ka and kb and (ka <= kb or kb <= ka))


def _sanitize(result, text, faculty_name=""):
    """Fixes the mistakes a small local model (or the regexes) keep making."""
    low = (text or "").lower()
    # The faculty member / certificate recipient is never a "speaker" unless
    # they are explicitly a speaker (role below).
    people = [result.get("recipient_name"), faculty_name]
    for key in ("speakers", "co_speakers"):
        result[key] = [n for n in result[key] if not any(p and _same_person(n, p) for p in people)]
    # Role must be backed by wording in the document itself.
    if result["role"] in {"resource_person", "speaker"} and not re.search(SPEAKER_MARKERS, low):
        result["role"] = "certified" if re.search(r"complet", low) else "attended"
    if result["role"] in {"other", ""}:
        if re.search(r"complet", low):
            result["role"] = "certified"
        elif re.search(r"participat|attended", low):
            result["role"] = "attended"
    recipient = result.get("recipient_name")
    if recipient and faculty_name:
        import difflib

        def norm(n):
            return re.sub(r"\b(dr|prof|mr|mrs|ms|miss)\b\.?|[^a-z ]", "", n.lower()).strip()

        r_tokens, f_tokens = norm(recipient).split(), norm(faculty_name).split()
        windows = [" ".join(f_tokens[i:i + len(r_tokens)]) for i in range(max(1, len(f_tokens) - len(r_tokens) + 1))]
        if any(difflib.SequenceMatcher(None, " ".join(r_tokens), w).ratio() >= 0.8 for w in windows):
            result["recipient_name"] = faculty_name
    # Hours are not days.
    if result.get("duration_hours") and not re.search(r"\bdays?\b", low):
        result["duration_days"] = None
    if result["role"] not in {"resource_person", "speaker"}:
        result["co_speakers"] = []
    return result


def analyze_text(text, title="", organization="", criterion_label="", use_llm=True, faculty_name=""):
    """Returns {"source": "llm"|"rules", **normalized fields}."""
    rules = rule_based_analysis(text, title=title, organization=organization)
    llm = llm_analysis(text, criterion_label) if use_llm else None
    merged = dict(rules)
    source = "rules"
    if isinstance(llm, dict):
        source = "llm"
        for key in SCHEMA_KEYS:
            value = _clean(llm.get(key))
            if value not in (None, "", [], {}):
                merged[key] = value
    # A quoted topic ("... on 'Explainable AI'") is read verbatim from the
    # document, so it beats a small local model's paraphrase of it.
    if rules.get("topic"):
        merged["topic"] = rules["topic"]
    merged["additional_details"] = _merge_details(rules.get("additional_details"), (llm or {}).get("additional_details") if isinstance(llm, dict) else None)
    if rules.get("_platform"):
        merged["organization"] = rules["organization"]
    merged.pop("_platform", None)
    result = _sanitize(normalize(merged), text, faculty_name)
    if not result["speakers"] and rules.get("speakers"):
        # The model sometimes lists only the recipient (which sanitising then
        # drops); fall back to the instructor the document itself names.
        result["speakers"] = [
            n for n in _str_list(rules["speakers"])
            if not any(p and _same_person(n, p) for p in (result.get("recipient_name"), faculty_name))
        ]
    # No fallback to the submission title here: it is usually just the
    # criterion wording, and the report falls back to it by itself where needed.
    result["source"] = source
    result["summary"] = ""  # report text is built from the fields (see build_details)
    result["version"] = ANALYSIS_VERSION
    return result


def build_summary(a):
    """Human-readable one-liner built from the structured fields, used when
    the LLM gave no summary of its own."""
    parts = []
    role = ROLE_LABELS.get(a.get("role") or "other", "")
    if role:
        parts.append(role)
    if a.get("title"):
        parts.append(f"“{a['title']}”")
    if a.get("organization"):
        parts.append(f"by {a['organization']}")
    sentence = " ".join(parts)
    extras = []
    period = format_period(a)
    if period:
        extras.append(period)
    if a.get("topic"):
        extras.append(f"topic: {a['topic']}")
    if a.get("co_speakers"):
        extras.append("co-speaker(s): " + ", ".join(a["co_speakers"]))
    elif a.get("speakers"):
        extras.append("speaker(s): " + ", ".join(a["speakers"]))
    if a.get("venue"):
        extras.append(f"venue: {a['venue']}")
    if a.get("funding_agency"):
        extras.append(f"agency: {a['funding_agency']}")
    if a.get("amount_lakhs") is not None:
        extras.append(f"amount: Rs. {a['amount_lakhs']:g} lakhs")
    return "; ".join([p for p in [sentence] + extras if p])


def format_period(a):
    start, end = _to_date(a.get("start_date")), _to_date(a.get("end_date"))
    if not start:
        return ""
    days = a.get("duration_days")
    if end and end != start:
        text = f"{start.strftime('%d/%m/%Y')} to {end.strftime('%d/%m/%Y')}"
    else:
        text = start.strftime("%d/%m/%Y")
    return f"{text} ({days} day{'s' if days and days != 1 else ''})" if days else text


def analyze_document(doc, use_llm=True):
    """Analyzes one EvidenceDocument and stores the result on it under
    ocr_extracted_fields["analysis"]. Safe to call repeatedly."""
    achievement = doc.achievement
    mapping = achievement.criterion_mappings.select_related("sub_criterion").first()
    criterion_label = ""
    if mapping:
        sc = mapping.sub_criterion
        criterion_label = f"{sc.code} {sc.description}"
    text = doc.ocr_text or ""
    # Only the document's own text is analysed. The submission title is
    # usually just the criterion wording ("Faculty as Resource Persons…"),
    # which used to leak into the result and make a participation
    # certificate look like a resource-person role.
    try:
        analysis = analyze_text(
            text,
            title=achievement.title,
            organization=achievement.issuing_organization,
            criterion_label=criterion_label,
            use_llm=use_llm,
            faculty_name=achievement.faculty.full_name,
        )
        # A photo with no readable text (event photo, scenery, a hand-written
        # note): describe what it shows so the report still says something.
        if use_llm and doc.content_type.startswith("image/") and len(text.strip()) < 25:
            with doc.file.open("rb") as f:
                caption = describe_image(f.read())
            if caption:
                analysis["additional_details"] = _merge_details([f"Image content: {caption}"], analysis.get("additional_details"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("Attachment analysis failed for document %s: %s", doc.id, exc)
        return None
    fields = dict(doc.ocr_extracted_fields or {})
    fields["analysis"] = analysis
    doc.ocr_extracted_fields = fields
    doc.save(update_fields=["ocr_extracted_fields"])
    return analysis


def get_or_build_analysis(doc):
    """Report-time accessor: the stored analysis if the background job has
    run, otherwise a quick rule-based one (never calls the LLM, so
    generating a report stays fast)."""
    stored = (doc.ocr_extracted_fields or {}).get("analysis")
    if stored and stored.get("version") == ANALYSIS_VERSION:
        return stored
    achievement = doc.achievement
    return analyze_text(
        doc.ocr_text or "",
        title=achievement.title,
        organization=achievement.issuing_organization,
        use_llm=False,
        faculty_name=achievement.faculty.full_name,
    )


def build_details(a, faculty_name=""):
    """Labelled facts for the report's "Details" cell / block — only fields
    that were actually found, never "null"."""
    rows = []
    role = ROLE_LABELS.get(a.get("role") or "other", "")
    if role:
        rows.append(("Participation", role))
    if a.get("title"):
        rows.append(("Course / Event", a["title"]))
    if a.get("organization"):
        rows.append(("Issued by", a["organization"]))
    if a.get("speakers"):
        label = "Instructor(s) / Speaker(s)"
        rows.append((label, ", ".join(a["speakers"])))
    if a.get("co_speakers"):
        rows.append(("Co-speaker(s)", ", ".join(a["co_speakers"])))
    if a.get("recipient_name"):
        rows.append(("Awarded to", a["recipient_name"]))
    period = format_period(a)
    if period:
        rows.append(("Date / Period", period))
    if a.get("duration_hours"):
        h = a["duration_hours"]
        rows.append(("Duration", f"{h:g} hours"))
    if a.get("topic"):
        rows.append(("Topic", a["topic"]))
    if a.get("venue"):
        rows.append(("Venue", a["venue"]))
    if a.get("purpose"):
        rows.append(("Purpose", a["purpose"]))
    for item in a.get("additional_details") or []:
        label, _, value = item.partition(":")
        rows.append((label.strip(), value.strip()) if value.strip() else ("Other", label.strip()))
    if a.get("funding_agency"):
        rows.append(("Funding agency", a["funding_agency"]))
    if a.get("amount_lakhs") is not None:
        rows.append(("Amount", f"Rs. {a['amount_lakhs']:g} lakhs"))
    if a.get("amount_spent_lakhs") is not None:
        rows.append(("Amount spent", f"Rs. {a['amount_spent_lakhs']:g} lakhs"))
    if a.get("publication_type"):
        rows.append(("Publication type", a["publication_type"].capitalize()))
    if a.get("publication_venue"):
        rows.append(("Journal / Conference / Publisher", a["publication_venue"]))
    return rows
