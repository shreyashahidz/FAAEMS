"""Simple, dependency-free captcha.

No third-party captcha keys exist for this project yet, so login uses a
server-generated random code instead: the frontend renders it as a
distorted image and the answer is never trusted from the client alone —
it's carried in a signed, time-limited token so verification needs no
shared server-side cache. Swap this module for reCAPTCHA/hCaptcha later
without touching the login view's contract (challenge in, {token, answer}
out).
"""

import secrets

from django.core.signing import BadSignature, SignatureExpired, TimestampSigner

_signer = TimestampSigner(salt="faems.captcha")
_MAX_AGE_SECONDS = 15 * 60
# Deliberately small alphabet: excludes not just 0/O and 1/I/L, but every
# other letter/digit pair that a rotated, wavy rendering can make look
# identical (S/5, B/8, Z/2, G/6, U/V) — a person reading the image
# correctly should never be able to type something that still fails.
_ALPHABET = "ACDEFHJKMNPQRTWXY347"
_CODE_LENGTH = 5


def generate_captcha():
    code = "".join(secrets.choice(_ALPHABET) for _ in range(_CODE_LENGTH))
    token = _signer.sign(code)
    return {"question": code, "token": token}


def verify_captcha(token: str, answer: str) -> bool:
    if not token or answer is None:
        return False
    try:
        expected = _signer.unsign(token, max_age=_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return False
    return expected.strip().upper() == str(answer).strip().upper()
