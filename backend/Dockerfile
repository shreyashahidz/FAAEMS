# syntax=docker/dockerfile:1
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# libreoffice-writer/impress/calc (not the full libreoffice metapackage,
# which pulls in Draw/Base/Math and a full language-pack set neither this
# app nor its evidence files need) give headless `soffice --convert-to pdf`
# for Word/PowerPoint/Excel evidence — browsers have no built-in renderer
# for those formats, so this is what makes "View" on a .docx/.pptx/.xlsx
# actually preview something instead of just downloading it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev gcc curl tesseract-ocr poppler-utils \
       libreoffice-writer libreoffice-impress libreoffice-calc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# --mount=type=cache persists pip's download cache in a BuildKit cache
# volume (never baked into the image layer, so it doesn't bloat the final
# image the way keeping --no-cache-dir off normally would) — on a flaky
# connection to PyPI, a build that fails partway through no longer throws
# away every package it already downloaded, so a retry is fast and only
# has to fetch what's still missing. --timeout gives slow reads more
# room before pip gives up and retries, instead of pip's 15s default.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --timeout 120 -r requirements.txt

COPY . .

RUN mkdir -p /app/logs

EXPOSE 8000

CMD ["gunicorn", "faems.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
