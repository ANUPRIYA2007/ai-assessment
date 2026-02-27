"""
ProctorForge AI - Trust Score Service
Computes composite trust scores from multiple dimensions.
"""


def compute_trust_score(
    behavior_stability: float = 100.0,
    typing_consistency: float = 100.0,
    coding_authenticity: float = 100.0,
    identity_stability: float = 100.0,
    environment_integrity: float = 100.0,
    intervention_performance: float = 100.0,
) -> dict:
    """
    Compute a weighted composite trust score (0-100).

    Weights:
    - Behavior Stability: 20%
    - Typing Consistency: 15%
    - Coding Authenticity: 20%
    - Identity Stability: 20%
    - Environment Integrity: 10%
    - Intervention Performance: 15%
    """
    weights = {
        "behavior_stability": 0.20,
        "typing_consistency": 0.15,
        "coding_authenticity": 0.20,
        "identity_stability": 0.20,
        "environment_integrity": 0.10,
        "intervention_performance": 0.15,
    }

    scores = {
        "behavior_stability": max(0, min(100, behavior_stability)),
        "typing_consistency": max(0, min(100, typing_consistency)),
        "coding_authenticity": max(0, min(100, coding_authenticity)),
        "identity_stability": max(0, min(100, identity_stability)),
        "environment_integrity": max(0, min(100, environment_integrity)),
        "intervention_performance": max(0, min(100, intervention_performance)),
    }

    overall = sum(scores[k] * weights[k] for k in weights)

    # Determine risk level
    if overall >= 80:
        risk_level = "low"
    elif overall >= 60:
        risk_level = "medium"
    elif overall >= 40:
        risk_level = "high"
    else:
        risk_level = "critical"

    return {
        "overall": round(overall, 2),
        **scores,
        "risk_level": risk_level,
    }


def apply_violation_penalty(
    current_scores: dict,
    event_type: str,
) -> dict:
    """Apply a penalty to the relevant dimension based on event type."""
    penalties = {
        "tab_switch": ("behavior_stability", 5),
        "window_blur": ("behavior_stability", 3),
        "devtools_open": ("behavior_stability", 15),
        "copy_paste": ("behavior_stability", 8),
        "clipboard_attempt": ("behavior_stability", 5),
        "fullscreen_exit": ("environment_integrity", 10),
        "gaze_deviation": ("identity_stability", 3),
        "face_missing": ("identity_stability", 10),
        "multi_face": ("identity_stability", 15),
        "voice_mismatch": ("identity_stability", 10),
        "typing_anomaly": ("typing_consistency", 8),
        "paste_detected": ("typing_consistency", 10),
        "burst_typing": ("typing_consistency", 5),
        "high_wpm": ("typing_consistency", 7),
        "code_entropy_anomaly": ("coding_authenticity", 10),
        "large_paste": ("coding_authenticity", 12),
        "idle_timeout": ("behavior_stability", 3),
    }

    if event_type in penalties:
        dimension, amount = penalties[event_type]
        current_scores[dimension] = max(0, current_scores.get(dimension, 100) - amount)

    return current_scores


def get_violation_penalty(event_type: str) -> float:
    """Return the flat penalty amount for a given event type (used by monitoring.py)."""
    penalties = {
        "tab_switch": 5,
        "window_blur": 3,
        "devtools_open": 15,
        "devtools_attempt": 10,
        "copy_paste": 8,
        "clipboard_attempt": 5,
        "paste_detected": 10,
        "fullscreen_exit": 10,
        "gaze_deviation": 3,
        "face_missing": 10,
        "camera_face_missing": 10,
        "multi_face": 15,
        "camera_multi_face": 15,
        "voice_mismatch": 10,
        "audio_multiple_voices": 12,
        "typing_anomaly": 8,
        "burst_typing": 5,
        "high_wpm": 7,
        "code_entropy_anomaly": 10,
        "large_paste": 12,
        "idle_timeout": 3,
    }
    return penalties.get(event_type, 2)
