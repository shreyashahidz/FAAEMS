import base64
import io

import pyotp
import qrcode
from django.conf import settings


def generate_secret() -> str:
    return pyotp.random_base32()


def provisioning_qr_data_uri(user, secret: str) -> str:
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=settings.MFA_ISSUER_NAME)
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def verify_totp(secret: str, code: str) -> bool:
    if not secret or not code:
        return False
    return pyotp.TOTP(secret).verify(code, valid_window=1)
