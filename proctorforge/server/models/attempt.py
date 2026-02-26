"""
ProctorForge AI - Attempt, Code Submission, Live Code Log, Typing Metrics Models
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, Text, ForeignKey
from models.portable_types import PortableUUID as UUID, PortableJSON as JSONB
from database import Base


class Attempt(Base):
    __tablename__ = "attempts"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(), ForeignKey("users.id"), nullable=False, index=True)
    exam_id = Column(UUID(), ForeignKey("exams.id"), nullable=False, index=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    trust_score = Column(Float, nullable=False, default=100.0)
    risk_level = Column(String(20), nullable=False, default="low")
    status = Column(String(20), nullable=False, default="active")
    device_fingerprint = Column(Text, nullable=True)
    browser_info = Column(JSONB(), nullable=True)


class CodeSubmission(Base):
    __tablename__ = "code_submissions"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(), ForeignKey("attempts.id"), nullable=False, index=True)
    question_id = Column(UUID(), ForeignKey("questions.id"), nullable=False)
    language = Column(String(20), nullable=False)
    code = Column(Text, nullable=False)
    test_results = Column(JSONB(), nullable=True)
    score = Column(Float, nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow)


class LiveCodeLog(Base):
    __tablename__ = "live_code_logs"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(), ForeignKey("attempts.id"), nullable=False, index=True)
    question_id = Column(UUID(), ForeignKey("questions.id"), nullable=True)
    code_snapshot = Column(Text, nullable=False)
    event_type = Column(String(20), nullable=False, default="autosave")
    timestamp = Column(DateTime, default=datetime.utcnow)


class TypingMetric(Base):
    __tablename__ = "typing_metrics"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    attempt_id = Column(UUID(), ForeignKey("attempts.id"), nullable=False, index=True)
    wpm = Column(Float, nullable=True)
    backspace_ratio = Column(Float, nullable=True)
    paste_size = Column(Integer, nullable=True)
    idle_time = Column(Float, nullable=True)
    entropy_score = Column(Float, nullable=True)
    burst_detected = Column(String(10), default="false")
    recorded_at = Column(DateTime, default=datetime.utcnow)
