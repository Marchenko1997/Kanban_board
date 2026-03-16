import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional

SECRET_KEY_ENV = "JWT_SECRET_KEY"
DEFAULT_SECRET = "dev-secret-key-change-in-production"
TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600  # 7 days


def get_secret_key() -> str:
    return os.getenv(SECRET_KEY_ENV, DEFAULT_SECRET)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
    return salt.hex() + ":" + key.hex()


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, key_hex = stored_hash.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 100_000)
        return hmac.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_token(username: str) -> str:
    header = _b64url_encode(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url_encode(
        json.dumps(
            {"sub": username, "exp": int(time.time()) + TOKEN_EXPIRY_SECONDS}
        ).encode()
    )
    signing_input = f"{header}.{payload}"
    secret = get_secret_key().encode()
    sig = hmac.new(secret, signing_input.encode(), hashlib.sha256).digest()
    return f"{signing_input}.{_b64url_encode(sig)}"


def decode_token(token: str) -> Optional[str]:
    """Return the username from a valid token, or None if invalid/expired."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_str, payload_str, sig_str = parts
        signing_input = f"{header_str}.{payload_str}"
        secret = get_secret_key().encode()
        expected = hmac.new(secret, signing_input.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64url_decode(sig_str)):
            return None
        payload = json.loads(_b64url_decode(payload_str))
        if payload.get("exp", 0) < time.time():
            return None
        return payload.get("sub")
    except Exception:
        return None
