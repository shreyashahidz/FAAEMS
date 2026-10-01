from datetime import timedelta

from rest_framework_simplejwt.tokens import Token


class MFAPendingToken(Token):
    """Short-lived token minted after a correct email+password, scoped only
    to completing the MFA step — it cannot be used as a normal access token
    because normal endpoints require rest_framework_simplejwt's AccessToken
    type, and this token's own type claim is different.
    """

    token_type = "mfa_pending"
    lifetime = timedelta(minutes=5)

    @classmethod
    def for_user(cls, user):
        token = cls()
        token[cls.token_type + "_user_id"] = user.id
        token["user_id"] = user.id
        return token
