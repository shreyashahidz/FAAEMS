from django.core.signing import BadSignature, SignatureExpired, TimestampSigner

_signer = TimestampSigner(salt="faems.password_reset")
_MAX_AGE_SECONDS = 10 * 60


def generate_reset_challenge(user) -> str:
    """Issued once the caller's email + date of birth have already been
    verified to match the account (see PasswordResetRequestView) — this
    token is just proof of that check, redeemed by the confirm step within
    10 minutes."""
    return _signer.sign(str(user.id))


def verify_reset_challenge(token: str):
    if not token:
        return None
    try:
        user_id_str = _signer.unsign(token, max_age=_MAX_AGE_SECONDS)
    except (BadSignature, SignatureExpired):
        return None
    try:
        return int(user_id_str)
    except ValueError:
        return None
