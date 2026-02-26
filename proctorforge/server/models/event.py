"""
ProctorForge AI - Event, AI Intervention, and Audit Report Models
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, Text, ForeignKey
from models.portable_types import PortableUUID as UUID, PortableJSON as JSONB
from database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(), ForeignKey("attempts.id"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False)
    event_data = Column(JSONB(), nullable=True)
    confidence_score = Column(Float, nullable=True)
    hmac_signature = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AIIntervention(Base):
    __tablename__ = "ai_interventions"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(), ForeignKey("attempts.id"), nullable=False, index=True)
    trigger_event = Column(String(50), nullable=False)
    risk_level = Column(String(20), nullable=False)
    intervention_text = Column(Text, nullable=True)
    challenge_prompt = Column(Text, nullable=True)
    response_text = Column(Text, nullable=True)
    outcome = Column(String(20), nullable=True)
    trust_adjustment = Column(Float, nullable=True)
    reasoning_trace = Column(JSONB(), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditReport(Base):
    __tablename__ = "audit_reports"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(), ForeignKey("attempts.id"), nullable=False, index=True)
    summary = Column(Text, nullable=True)
    timeline = Column(JSONB(), nullable=True)
    risk_breakdown = Column(JSONB(), nullable=True)
    final_trust_score = Column(Float, nullable=True)
    ai_reasoning = Column(JSONB(), nullable=True)
    generated_at = Column(DateTime, default=datetime.utcnow)

