"""
ProctorForge AI - Attempts & Events Router
Session management, event logging, and typing metrics.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List
from datetime import datetime

from database import get_db
from models.user import User
from models.exam import ExamAssignment
from models.attempt import Attempt, CodeSubmission, LiveCodeLog, TypingMetric
from models.event import Event
from schemas.exam import (
    AttemptCreate, AttemptResponse,
    EventCreate, EventResponse,
    TypingMetricCreate, LiveCodeLogCreate,
    CodeSubmitRequest,
)
from middleware.auth import get_current_user, require_teacher_or_admin
from utils.hmac import verify_event

router = APIRouter(prefix="/api/attempts", tags=["Attempts & Events"])


# ===== ATTEMPTS =====

@router.post("/", response_model=AttemptResponse, status_code=201)
async def create_attempt(
    data: AttemptCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start an exam attempt. Validates assignment exists."""
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Only students can start attempts")

    # Check assignment (individual or class-based)
    result = await db.execute(
        select(ExamAssignment).where(
            ExamAssignment.exam_id == data.exam_id,
            ExamAssignment.student_id == current_user.id,
        )
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        # Auto-assign if student matches the exam's class/year/section
        from models.exam import Exam as ExamModel
        exam_result = await db.execute(select(ExamModel).where(ExamModel.id == data.exam_id))
        exam_obj = exam_result.scalar_one_or_none()
        if not exam_obj:
            raise HTTPException(status_code=404, detail="Exam not found")
        if exam_obj.status not in ("active", "draft"):
            raise HTTPException(status_code=403, detail="Exam is not currently active")
        if (
            exam_obj.assigned_class
            and exam_obj.assigned_year
            and exam_obj.assigned_section
            and current_user.class_name == exam_obj.assigned_class
            and current_user.year == exam_obj.assigned_year
            and current_user.section == exam_obj.assigned_section
        ):
            assignment = ExamAssignment(
                exam_id=data.exam_id,
                student_id=current_user.id,
                assigned_by=exam_obj.created_by,
            )
            db.add(assignment)
            await db.flush()
        else:
            raise HTTPException(status_code=403, detail="Not assigned to this exam")

    # Check for existing active attempt
    result = await db.execute(
        select(Attempt).where(
            Attempt.user_id == current_user.id,
            Attempt.exam_id == data.exam_id,
            Attempt.status == "active",
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        return AttemptResponse.model_validate(existing)

    attempt = Attempt(
        user_id=current_user.id,
        exam_id=data.exam_id,
        device_fingerprint=data.device_fingerprint,
        browser_info=data.browser_info,
    )
    db.add(attempt)
    assignment.status = "started"
    await db.flush()
    return AttemptResponse.model_validate(attempt)


@router.get("/{attempt_id}", response_model=AttemptResponse)
async def get_attempt(
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get attempt details."""
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    # Students can only view their own attempts
    if current_user.role == "student" and attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return AttemptResponse.model_validate(attempt)


@router.patch("/{attempt_id}/end")
async def end_attempt(
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """End an exam attempt."""
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    if current_user.role == "student" and attempt.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    attempt.status = "completed"
    attempt.end_time = datetime.utcnow()
    return {"message": "Attempt ended", "trust_score": attempt.trust_score}


# ===== EVENTS =====

@router.post("/{attempt_id}/events", response_model=EventResponse, status_code=201)
async def log_event(
    attempt_id: UUID,
    data: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log a proctoring event with optional HMAC verification."""
    # Verify HMAC if provided
    if data.hmac_signature and data.event_data:
        if not verify_event(data.event_data, data.hmac_signature):
            raise HTTPException(status_code=400, detail="Invalid event signature")

    event = Event(
        attempt_id=attempt_id,
        event_type=data.event_type,
        event_data=data.event_data,
        confidence_score=data.confidence_score,
        hmac_signature=data.hmac_signature,
    )
    db.add(event)
    await db.flush()
    return EventResponse.model_validate(event)


@router.get("/{attempt_id}/events", response_model=List[EventResponse])
async def get_events(
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
):
    """Get all events for an attempt (teacher/admin only)."""
    result = await db.execute(
        select(Event).where(Event.attempt_id == attempt_id).order_by(Event.created_at)
    )
    return [EventResponse.model_validate(e) for e in result.scalars().all()]


# ===== TYPING METRICS =====

@router.post("/{attempt_id}/typing", status_code=201)
async def log_typing_metric(
    attempt_id: UUID,
    data: TypingMetricCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Log typing analytics."""
    metric = TypingMetric(
        attempt_id=attempt_id,
        wpm=data.wpm,
        backspace_ratio=data.backspace_ratio,
        paste_size=data.paste_size,
        idle_time=data.idle_time,
        entropy_score=data.entropy_score,
        burst_detected=data.burst_detected,
    )
    db.add(metric)
    await db.flush()
    return {"message": "Typing metric logged"}


# ===== LIVE CODE LOGS =====

@router.post("/{attempt_id}/code-logs", status_code=201)
async def log_code_snapshot(
    attempt_id: UUID,
    data: LiveCodeLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Auto-save a code snapshot."""
    log = LiveCodeLog(
        attempt_id=attempt_id,
        question_id=data.question_id,
        code_snapshot=data.code_snapshot,
        event_type=data.event_type,
    )
    db.add(log)
    await db.flush()
    return {"message": "Code snapshot saved"}


@router.get("/{attempt_id}/code-logs")
async def get_code_logs(
    attempt_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
):
    """Get code evolution logs (teacher/admin only)."""
    result = await db.execute(
        select(LiveCodeLog).where(LiveCodeLog.attempt_id == attempt_id).order_by(LiveCodeLog.timestamp)
    )
    logs = result.scalars().all()
    return [
        {
            "id": str(l.id),
            "code_snapshot": l.code_snapshot,
            "event_type": l.event_type,
            "timestamp": l.timestamp.isoformat(),
            "question_id": str(l.question_id) if l.question_id else None,
        }
        for l in logs
    ]


# ===== CODE SUBMISSIONS =====

@router.post("/{attempt_id}/submit-code", status_code=201)
async def submit_code(
    attempt_id: UUID,
    data: CodeSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit code for evaluation (stores submission, execution is separate)."""
    submission = CodeSubmission(
        attempt_id=attempt_id,
        question_id=data.question_id,
        language=data.language,
        code=data.code,
    )
    db.add(submission)
    await db.flush()
    return {"message": "Code submitted", "submission_id": str(submission.id)}
