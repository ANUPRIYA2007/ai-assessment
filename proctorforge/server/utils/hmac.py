"""
ProctorForge AI - HMAC Utilities
Signs and verifies event payloads for zero-trust event integrity.
"""
import hmac
import hashlib
import json
from config import settings


def sign_event(event_data: dict) -> str:
    """Generate HMAC-SHA256 signature for an event payload."""
    payload = json.dumps(event_data, sort_keys=True, default=str)
    signature = hmac.new(
        settings.HMAC_SECRET_KEY.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature


def verify_event(event_data: dict, signature: str) -> bool:
    """Verify HMAC-SHA256 signature of an event payload."""
    expected = sign_event(event_data)
    return hmac.compare_digest(expected, signature)
