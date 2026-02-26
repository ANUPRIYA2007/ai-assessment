"""
ProctorForge AI - Audit Service
Generates forensic audit reports and violation timelines.
"""
import json
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.attempt import Attempt
from models.event import Event, AIIntervention, AuditReport


async def generate_audit_report(
    attempt_id: UUID,
    db: AsyncSession,
) -> dict:
    """Generate a comprehensive audit report for an attempt."""
    # Get attempt
    result = await db.execute(select(Attempt).where(Attempt.id == attempt_id))
    attempt = result.scalar_one_or_none()
    if not attempt:
        return {"error": "Attempt not found"}

    # Get all events
    result = await db.execute(
        select(Event).where(Event.attempt_id == attempt_id).order_by(Event.created_at)
    )
    events = result.scalars().all()

    # Get interventions
    result = await db.execute(
        select(AIIntervention).where(AIIntervention.attempt_id == attempt_id).order_by(AIIntervention.created_at)
    )
    interventions = result.scalars().all()

    # Build timeline
    timeline = []
    for event in events:
        timeline.append({
            "timestamp": event.created_at.isoformat(),
            "type": "violation",
            "event_type": event.event_type,
            "data": event.event_data,
            "confidence": event.confidence_score,
        })

    for intervention in interventions:
        timeline.append({
            "timestamp": intervention.created_at.isoformat(),
            "type": "intervention",
            "trigger": intervention.trigger_event,
            "risk_level": intervention.risk_level,
            "text": intervention.intervention_text,
            "outcome": intervention.outcome,
            "trust_adjustment": intervention.trust_adjustment,
        })

    # Sort by timestamp
    timeline.sort(key=lambda x: x["timestamp"])

    # Generate summary
    violation_counts = {}
    for event in events:
        violation_counts[event.event_type] = violation_counts.get(event.event_type, 0) + 1

    summary = (
        f"Session for attempt {attempt_id}. "
        f"Duration: {attempt.start_time.isoformat()} to {(attempt.end_time or datetime.utcnow()).isoformat()}. "
        f"Final trust score: {attempt.trust_score}. "
        f"Risk level: {attempt.risk_level}. "
        f"Total violations: {len(events)}. "
        f"Total interventions: {len(interventions)}. "
        f"Violation breakdown: {json.dumps(violation_counts)}."
    )

    # Risk breakdown (placeholder - would aggregate from trust score dimensions)
    risk_breakdown = {
        "behavior_stability": 100,
        "typing_consistency": 100,
        "coding_authenticity": 100,
        "identity_stability": 100,
        "environment_integrity": 100,
        "intervention_performance": 100,
    }

    # Save report
    report = AuditReport(
        attempt_id=attempt_id,
        summary=summary,
        timeline=timeline,
        risk_breakdown=risk_breakdown,
        final_trust_score=attempt.trust_score,
        ai_reasoning=[
            {
                "trigger": i.trigger_event,
                "reasoning": i.reasoning_trace,
                "outcome": i.outcome,
            }
            for i in interventions
        ],
    )
    db.add(report)
    await db.flush()

    return {
        "id": str(report.id),
        "summary": summary,
        "timeline": timeline,
        "risk_breakdown": risk_breakdown,
        "final_trust_score": attempt.trust_score,
        "violation_counts": violation_counts,
        "interventions_count": len(interventions),
    }
