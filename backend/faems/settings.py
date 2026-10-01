"""
Django settings for FAEMS (Faculty Achievement & Accreditation Evidence
Management System).

Every setting that differs between local dev and the college server comes
from the environment (see .env.example) — nothing environment-specific is
hardcoded here, per the playbook's Phase 12.3 pre-deploy rules.
"""

from datetime import timedelta
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env()
env_file = BASE_DIR.parent / ".env"
if env_file.exists():
    environ.Env.read_env(str(env_file))

# --- Core / required env vars (Phase 12.3: refuse to start with a clear error) ---
SECRET_KEY = env("DJANGO_SECRET_KEY")
DEBUG = env.bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])
# The institution actually issues accounts on more than one domain (e.g.
# HOD/IQAC addresses under thakureducation.org alongside the main
# tcetmumbai.in faculty domain) — a single fixed domain rejected real staff
# with a legitimate institutional address. env.list splits on commas.
ALLOWED_EMAIL_DOMAINS = env.list("ALLOWED_EMAIL_DOMAINS", default=["tcetmumbai.in", "thakureducation.org"])
# Back-compat for any code/config still reading the old singular name —
# the first configured domain is what registration/login forms default to.
ALLOWED_EMAIL_DOMAIN = ALLOWED_EMAIL_DOMAINS[0]

if not DEBUG and SECRET_KEY == "change-me-to-a-long-random-value":
    raise RuntimeError(
        "DJANGO_SECRET_KEY is still the placeholder value. Set a real secret "
        "before running with DJANGO_DEBUG=false."
    )

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
    "django_filters",
    "apps.accounts",
    "apps.audit",
    "apps.criteria",
    "apps.achievements",
    "apps.reports",
    "apps.notifications",
    "apps.assistant",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.common.middleware.CorrelationIdMiddleware",
    "apps.common.middleware.SecurityHeadersMiddleware",
]

ROOT_URLCONF = "faems.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "faems.wsgi.application"
ASGI_APPLICATION = "faems.asgi.application"

# --- Database: PostgreSQL only, never SQLite (playbook ground rule) ---
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": env("POSTGRES_DB"),
        "USER": env("POSTGRES_USER"),
        "PASSWORD": env("POSTGRES_PASSWORD"),
        "HOST": env("POSTGRES_HOST", default="db"),
        "PORT": env("POSTGRES_PORT", default="5432"),
        "OPTIONS": {"sslmode": env("POSTGRES_SSLMODE", default="disable")},
        "CONN_MAX_AGE": 60,
    }
}

AUTH_USER_MODEL = "accounts.User"

# --- Password policy (Phase 1.6) ---

# BreachedPasswordValidator is deliberately not in this list — a HIBP hit
# is a "we'd recommend against this" warning, not a hard rule, and is
# checked separately (with an explicit override) in RegisterView /
# PasswordResetConfirmView. Every validator below this line stays a hard,
# non-overridable block.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 6}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
    {"NAME": "apps.accounts.validators.ComplexityValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# --- CORS ---
CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:5173"])
CORS_ALLOW_CREDENTIALS = True

# --- REST framework ---
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_PAGINATION_CLASS": "apps.common.pagination.DefaultPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_THROTTLE_CLASSES": (),
    "DEFAULT_THROTTLE_RATES": {
        "login": "5/min",
        "password_reset": "3/hour",
        "register": "5/hour",
    },
    "EXCEPTION_HANDLER": "apps.common.exceptions.correlated_exception_handler",
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_MINUTES", default=15)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_DAYS", default=1)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# --- MFA ---
MFA_ISSUER_NAME = env("MFA_ISSUER_NAME", default="FAEMS-TCET")

# --- Account lockout ---
LOGIN_FAILURE_LIMIT = env.int("LOGIN_FAILURE_LIMIT", default=5)
LOGIN_LOCKOUT_MINUTES = env.int("LOGIN_LOCKOUT_MINUTES", default=15)

# --- File upload constraints (Phase 2.5) ---
ALLOWED_EVIDENCE_CONTENT_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",  # legacy .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/vnd.ms-powerpoint",  # legacy .ppt
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
    "application/vnd.ms-excel",  # legacy .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  # .xlsx
    "text/csv",
]
MAX_EVIDENCE_FILE_SIZE_MB = 40

# --- MinIO / S3-compatible object storage (system of record for files) ---
AWS_ACCESS_KEY_ID = env("MINIO_ROOT_USER", default="")
AWS_SECRET_ACCESS_KEY = env("MINIO_ROOT_PASSWORD", default="")
AWS_STORAGE_BUCKET_NAME = env("MINIO_BUCKET_NAME", default="faems-evidence")
AWS_S3_ENDPOINT_URL = ("https://" if env.bool("MINIO_USE_SSL", default=False) else "http://") + env(
    "MINIO_ENDPOINT", default="minio:9000"
)
AWS_S3_USE_SSL = env.bool("MINIO_USE_SSL", default=False)
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL = None
AWS_QUERYSTRING_AUTH = True
AWS_S3_SIGNATURE_VERSION = "s3v4"

STORAGES = {
    "default": {"BACKEND": "storages.backends.s3boto3.S3Boto3Storage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# --- Security headers / cookies (Phase 12.2 / 12.3) ---
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # frontend reads it to set the X-CSRFToken header
CSRF_COOKIE_SAMESITE = "Lax"

if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# --- Structured logging (Phase 12.6) ---
LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(exist_ok=True)

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "correlation_id": {"()": "apps.common.logging_filters.CorrelationIdFilter"},
    },
    "formatters": {
        "json": {
            "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
            "format": "%(asctime)s %(levelname)s %(name)s %(correlation_id)s %(message)s",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["correlation_id"],
        },
        "file": {
            "class": "logging.handlers.RotatingFileHandler",
            "filename": str(LOGS_DIR / "faems.log"),
            "maxBytes": 10 * 1024 * 1024,
            "backupCount": 10,
            "formatter": "json",
            "filters": ["correlation_id"],
        },
    },
    "root": {"handlers": ["console", "file"], "level": "INFO"},
    "loggers": {
        "django": {"handlers": ["console", "file"], "level": "INFO", "propagate": False},
        "faems": {"handlers": ["console", "file"], "level": "DEBUG" if DEBUG else "INFO", "propagate": False},
    },
}
