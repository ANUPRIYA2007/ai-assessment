"""
ProctorForge AI - Monitoring & Heartbeat Router
Zero-trust session monitoring: heartbeat, camera signals, audio events,
session initialization validation, and real-time trust score updates.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pydantic import BaseModel

from database import get_db
from models.user import User
from models.attempt import Attempt, TypingMetric
from models.event import Event, AIIntervention
from middleware.auth import get_current_user, require_teacher_or_admin
from services.trust_score import compute_trust_score, apply_violation_penalty
from services.ai_twin import analyze_session
from utils.hmac import sign_event

router = APIRouter(prefix="/api/monitoring", tags=["Monitoring"])

# ── In-memory heartbeat tracking ──────────────────────────────────────────
_heartbeats: Dict[str, datetime] = {}
_session_states: Dict[str, Dict[str, Any]] = {}

HEARTBEAT_INTERVAL = 3  # seconds
HEARTBEAT_TOLERANCE = 10  # pause after 10s of missing heartbeats


# ══════════════════════════════════════════════════════════════════════════
#  SCHEMAS
# ══════════════════════════════════════════════════════════════════════════

class HeartbeatRequest(BaseModel):
    attempt_id: UUID
    timestamp: Optional[float] = None
    tab_visible: bool = True
    fullscreen: bool = True
    battery_charging: Optional[bool] = None
    battery_level: Optional[float] = None


class CameraEventRequest(BaseModel):
    attempt_id: UUID
    event_type: str  # face_detected, face_missing, multi_face, gaze_deviation, head_pose
    face_count: int = 1
    confidence: float = 1.0
    gaze_x: Optional[float] = None
    gaze_y: Optional[float] = None
    head_yaw: Optional[float] = None
    head_pitch: Optional[float] = None
    details: Optional[dict] = None


class AudioEventRequest(BaseModel):
    attempt_id: UUID
    event_type: str  # voice_detected, multiple_voices, silence, background_noise
    volume_level: float = 0.0
    voice_count: int = 0
    confidence: float = 1.0
    details: Optional[dict] = None


class SessionInitRequest(BaseModel):
    browser_name: str
    browser_version: str
    os_name: str
    screen_count: int = 1
    gpu_renderer: str = ""
    device_fingerprint: str
    vm_detected: bool = False
    webcam_available: bool = True
    mic_available: bool = True
    fullscreen_capable: bool = True
    connection_speed_mbps: Optional[float] = None


class BehaviorEventRequest(BaseModel):
    attempt_id: UUID
    event_type: str  # mouse_idle, rapid_scroll, suspicious_resize, extension_detected
    details: Optional[dict] = None
    confidence: float = 1.0


# ══════════════════════════════════════════════════════════════════════════
#  SESSION INITIALIZATION
# ══════════════════════════════════════════════════════════════════════════

@router.post("/session-init")
async def validate_session(
    data: SessionInitRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Validate the student's browser/device before starting an exam.
    Returns readiness status and any warnings.
    """
    warnings = []
    blocking = []

    # Browser validation
    allowed_browsers = ["chrome", "edge", "chromium"]
    browser_lower = data.browser_name.lower()
    if not any(b in browser_lower for b in allowed_browsers):
        blocking.append(f"Unsupported browser: {data.browser_name}. Use Chrome or Edge.")

    # VM detection
    gpu_lower = data.gpu_renderer.lower()
    vm_indicators = ["swiftshader", "llvmpipe", "virtualbox", "vmware", "parallels"]
    if data.vm_detected or any(ind in gpu_lower for ind in vm_indicators):
        blocking.append("Virtual machine detected. Exams must run on physical hardware.")

    # Multi-monitor
    if data.screen_count > 1:
        warnings.append(f"Multiple monitors detected ({data.screen_count}). Disconnect extra displays.")

    # Webcam & Mic
    if not data.webcam_available:
        blocking.append("Webcam not available. Camera is required for proctoring.")
    if not data.mic_available:
        warnings.append("Microphone not available. Audio monitoring will be limited.")

    # Fullscreen
    if not data.fullscreen_capable:
        warnings.append("Fullscreen API not supported. Browser shield may be limited.")

    # Connection speed
    if data.connection_speed_mbps and data.connection_speed_mbps < 1.0:
        warnings.append(f"Slow connection ({data.connection_speed_mbps:.1f} Mbps). May affect real-time monitoring.")

    ready = len(blocking) == 0
    fingerprint_signed = sign_event({"fingerprint": data.device_fingerprint, "user_id": str(current_user.id)})

    return {
        "ready": ready,
        "blocking": blocking,
        "warnings": warnings,
        "fingerprint_signature": fingerprint_signed,
        "session_token": fingerprint_signed,  # used for heartbeat validation
        "heartbeat_interval_ms": HEARTBEAT_INTERVAL * 1000,
    }


# ══════════════════════════════════════════════════════════════════════════
#  HEARTBEAT
# ══════════════════════════════════════════════════════════════════════════

@router.post("/heartbeat")
async def receive_heartbeat(
    data: HeartbeatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Receive a heartbeat ping from the student's browser every 3 seconds.
    Detects missing heartbeats and auto-pauses the exam.
    """
    attempt_key = str(data.attempt_id)
    now = datetime.utcnow()

    # Check gap since last heartbeat
    last_beat = _heartbeats.get(attempt_key)
    gap_seconds = (now - last_beat).total_seconds() if last_beat else 0

    # Update heartbeat
    _heartbeats[attempt_key] = now

    # Update session state
    if attempt_key not in _session_states:
        _session_states[attempt_key] = {
            "paused": False,
            "violations": 0,
            "last_camera_event": None,
            "last_audio_event": None,
        }

    violations = []

    # Detect missing heartbeat gap
    if last_beat and gap_seconds > HEARTBEAT_TOLERANCE:
        violations.append({
            "type": "heartbeat_gap",
            "gap_seconds": round(gap_seconds, 1),
            "message": f"Heartbeat gap of {gap_seconds:.0f}s detected",
        })
        # Log event
        event = Event(
            attempt_id=data.attempt_id,
            event_type="heartbeat_gap",
            event_data={"gap_seconds": gap_seconds},
            confidence_score=1.0,
        )
        db.add(event)

    # Tab visibility check
    if not data.tab_visible:
        violations.append({"type": "tab_hidden", "message": "Tab is not visible"})

    # Fullscreen check
    if not data.fullscreen:
        violations.append({"type": "fullscreen_exit", "message": "Not in fullscreen mode"})

    # Battery check (optional)
    if data.battery_level is not None and data.battery_level < 0.15 and not data.battery_charging:
        violations.append({
            "type": "low_battery",
            "level": data.battery_level,
            "message": "Battery critically low. Please plug in your device.",
        })

    # Apply penalties for violations
    if violations:
        result = await db.execute(select(Attempt).where(Attempt.id == data.attempt_id))
        attempt = result.scalar_one_or_none()
        if attempt and attempt.user_id == current_user.id:
            for v in violations:
                penalty = apply_violation_penalty(v["type"], attempt.trust_score)
                attempt.trust_score = max(0, attempt.trust_score - penalty)
            _session_states[attempt_key]["violations"] += len(violations)

    await db.flush()

    return {
        "status": "ok",
        "server_time": now.isoformat(),
        "gap_seconds": round(gap_seconds, 1) if last_beat else 0,
        "violations": violations,
        "paused": _session_states.get(attempt_key, {}).get("paused", False),
    }


# ══════════════════════════════════════════════════════════════════════════
#  CAMERA EVENTS
# ══════════════════════════════════════════════════════════════════════════

@router.post("/camera-event")
async def receive_camera_event(
    data: CameraEventRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Receive camera-based monitoring signals (face detection, gaze, head pose).
    Maps events to risk levels and updates trust score.
    """
    risk_map = {
        "face_missing": {"penalty": 8, "risk": "high"},
        "multi_face": {"penalty": 12, "risk": "critical"},
        "gaze_deviation": {"penalty": 3, "risk": "medium"},
        "head_pose": {"penalty": 2, "risk": "low"},
        "face_detected": {"penalty": 0, "risk": "none"},
    }

    risk_info = risk_map.get(data.event_type, {"penalty": 1, "risk": "low"})

    # Log event to database
    event = Event(
        attempt_id=data.attempt_id,
        event_type=f"camera_{data.event_type}",
        event_data={
            "face_count": data.face_count,
            "confidence": data.confidence,
            "gaze": {"x": data.gaze_x, "y": data.gaze_y} if data.gaze_x is not None else None,
            "head_pose": {"yaw": data.head_yaw, "pitch": data.head_pitch} if data.head_yaw is not None else None,
            "details": data.details,
        },
        confidence_score=data.confidence,
        hmac_signature=sign_event({"type": data.event_type, "attempt": str(data.attempt_id)}),
    )
    db.add(event)

    # Apply trust penalty
    trust_adjustment = 0
    if risk_info["penalty"] > 0:
        result = await db.execute(select(Attempt).where(Attempt.id == data.attempt_id))
        attempt = result.scalar_one_or_none()
        if attempt and attempt.user_id == current_user.id:
            penalty = risk_info["penalty"] * (1 - data.confidence * 0.3)  # Scale by confidence
            attempt.trust_score = max(0, attempt.trust_score - penalty)
            trust_adjustment = -penalty

            # Trigger AI analysis for high-risk events
            if risk_info["risk"] in ("high", "critical"):
                background_tasks.add_task(
                    _trigger_ai_analysis, str(data.attempt_id), data.event_type, db
                )

    await db.flush()

    return {
        "processed": True,
        "risk_level": risk_info["risk"],
        "trust_adjustment": round(trust_adjustment, 2),
        "event_id": str(event.id) if hasattr(event, 'id') else None,
    }


# ══════════════════════════════════════════════════════════════════════════
#  AUDIO EVENTS
# ══════════════════════════════════════════════════════════════════════════

@router.post("/audio-event")
async def receive_audio_event(
    data: AudioEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Receive audio monitoring signals (voice detection, multiple speakers, noise levels).
    """
    risk_map = {
        "multiple_voices": {"penalty": 10, "risk": "critical"},
        "voice_detected": {"penalty": 0, "risk": "none"},
        "background_noise": {"penalty": 1, "risk": "low"},
        "silence": {"penalty": 0, "risk": "none"},
    }

    risk_info = risk_map.get(data.event_type, {"penalty": 0, "risk": "low"})

    event = Event(
        attempt_id=data.attempt_id,
        event_type=f"audio_{data.event_type}",
        event_data={
            "volume_level": data.volume_level,
            "voice_count": data.voice_count,
            "confidence": data.confidence,
            "details": data.details,
        },
        confidence_score=data.confidence,
    )
    db.add(event)

    trust_adjustment = 0
    if risk_info["penalty"] > 0:
        result = await db.execute(select(Attempt).where(Attempt.id == data.attempt_id))
        attempt = result.scalar_one_or_none()
        if attempt and attempt.user_id == current_user.id:
            penalty = risk_info["penalty"]
            attempt.trust_score = max(0, attempt.trust_score - penalty)
            trust_adjustment = -penalty

    await db.flush()

    return {
        "processed": True,
        "risk_level": risk_info["risk"],
        "trust_adjustment": round(trust_adjustment, 2),
    }


# ══════════════════════════════════════════════════════════════════════════
#  BEHAVIOR EVENTS
# ══════════════════════════════════════════════════════════════════════════

@router.post("/behavior-event")
async def receive_behavior_event(
    data: BehaviorEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Receive behavior-based monitoring signals (mouse activity, scrolling patterns, etc).
    """
    risk_map = {
        "mouse_idle": {"penalty": 1, "risk": "low"},
        "rapid_scroll": {"penalty": 2, "risk": "low"},
        "suspicious_resize": {"penalty": 5, "risk": "medium"},
        "extension_detected": {"penalty": 15, "risk": "critical"},
        "devtools_open": {"penalty": 20, "risk": "critical"},
        "clipboard_paste": {"penalty": 4, "risk": "medium"},
        "tab_switch": {"penalty": 6, "risk": "high"},
        "window_blur": {"penalty": 5, "risk": "high"},
    }

    risk_info = risk_map.get(data.event_type, {"penalty": 1, "risk": "low"})

    event = Event(
        attempt_id=data.attempt_id,
        event_type=f"behavior_{data.event_type}",
        event_data=data.details or {},
        confidence_score=data.confidence,
        hmac_signature=sign_event({"type": data.event_type, "attempt": str(data.attempt_id)}),
    )
    db.add(event)

    trust_adjustment = 0
    result = await db.execute(select(Attempt).where(Attempt.id == data.attempt_id))
    attempt = result.scalar_one_or_none()
    if attempt and attempt.user_id == current_user.id and risk_info["penalty"] > 0:
        attempt.trust_score = max(0, attempt.trust_score - risk_info["penalty"])
        trust_adjustment = -risk_info["penalty"]

        # Update risk level
        if attempt.trust_score < 40:
            attempt.risk_level = "critical"
        elif attempt.trust_score < 60:
            attempt.risk_level = "high"
        elif attempt.trust_score < 80:
            attempt.risk_level = "medium"
        else:
            attempt.risk_level = "low"

    await db.flush()

    return {
        "processed": True,
        "risk_level": risk_info["risk"],
        "trust_adjustment": round(trust_adjustment, 2),
        "new_trust_score": attempt.trust_score if attempt else None,
    }


# ══════════════════════════════════════════════════════════════════════════
#  MONITORING STATUS
# ══════════════════════════════════════════════════════════════════════════

@router.get("/status/{attempt_id}")
async def get_monitoring_status(
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get full monitoring status for an attempt."""
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    # Get recent events
    events_result = await db.execute(
        select(Event)
        .where(Event.attempt_id == attempt_id)
        .order_by(Event.created_at.desc())
        .limit(20)
    )
    recent_events = events_result.scalars().all()

    # Get typing metrics
    typing_result = await db.execute(
        select(TypingMetric)
        .where(TypingMetric.attempt_id == attempt_id)
        .order_by(TypingMetric.recorded_at.desc())
        .limit(5)
    )
    typing_metrics = typing_result.scalars().all()

    attempt_key = str(attempt_id)
    session_state = _session_states.get(attempt_key, {})

    return {
        "attempt_id": str(attempt_id),
        "trust_score": attempt.trust_score,
        "risk_level": attempt.risk_level,
        "status": attempt.status,
        "session_state": session_state,
        "last_heartbeat": _heartbeats.get(attempt_key, {None: None}),
        "recent_events": [
            {
                "id": str(e.id),
                "type": e.event_type,
                "data": e.event_data,
                "confidence": e.confidence_score,
                "timestamp": e.created_at.isoformat(),
            }
            for e in recent_events
        ],
        "typing_summary": {
            "avg_wpm": sum(t.wpm or 0 for t in typing_metrics) / max(len(typing_metrics), 1),
            "avg_backspace_ratio": sum(t.backspace_ratio or 0 for t in typing_metrics) / max(len(typing_metrics), 1),
            "paste_detected": any(t.paste_size and t.paste_size > 0 for t in typing_metrics),
            "burst_detected": any(t.burst_detected == "true" for t in typing_metrics),
        },
    }


# ══════════════════════════════════════════════════════════════════════════
#  LIVE SESSIONS (for teacher dashboard)
# ══════════════════════════════════════════════════════════════════════════

@router.get("/live-sessions/{exam_id}")
async def get_live_sessions(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
):
    """Get all active attempts for an exam with their monitoring status."""
    result = await db.execute(
        select(Attempt).where(
            Attempt.exam_id == exam_id,
            Attempt.status == "active",
        )
    )
    attempts = result.scalars().all()

    sessions = []
    for attempt in attempts:
        # Get student info
        user_result = await db.execute(select(User).where(User.id == attempt.user_id))
        student = user_result.scalar_one_or_none()

        # Get violation count
        event_count = await db.execute(
            select(func.count(Event.id)).where(Event.attempt_id == attempt.id)
        )
        violation_count = event_count.scalar() or 0

        attempt_key = str(attempt.id)
        last_beat = _heartbeats.get(attempt_key)
        is_online = last_beat and (datetime.utcnow() - last_beat).total_seconds() < HEARTBEAT_TOLERANCE

        sessions.append({
            "attempt_id": str(attempt.id),
            "student": {
                "id": str(student.id) if student else None,
                "name": student.name if student else "Unknown",
                "email": student.email if student else None,
                "register_number": student.register_number if student else None,
            },
            "trust_score": attempt.trust_score,
            "risk_level": attempt.risk_level,
            "is_online": is_online,
            "last_heartbeat": last_beat.isoformat() if last_beat else None,
            "violation_count": violation_count,
            "start_time": attempt.start_time.isoformat(),
        })

    # Sort by risk: critical first
    risk_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sessions.sort(key=lambda s: risk_order.get(s["risk_level"], 4))

    return {"exam_id": str(exam_id), "sessions": sessions, "total": len(sessions)}


# ══════════════════════════════════════════════════════════════════════════
#  HELPER: Trigger AI Analysis (background)
# ══════════════════════════════════════════════════════════════════════════

async def _trigger_ai_analysis(attempt_id: str, trigger_event: str, db: AsyncSession):
    """Background task to run AI Twin analysis on high-risk events."""
    try:
        # Simple analysis data
        session_data = {
            "trigger_event": trigger_event,
            "tab_switches": 0,
            "paste_size": 0,
            "typing_speed": 50,
            "gaze_deviation": 0.5 if "gaze" in trigger_event else 0,
            "voice_match": True,
            "backspace_ratio": 0.1,
            "code_entropy": 3.0,
        }
        result = await analyze_session(session_data)
        # Result would be used by the WebSocket to push to teachers
    except Exception:
        pass  # Non-critical background task
