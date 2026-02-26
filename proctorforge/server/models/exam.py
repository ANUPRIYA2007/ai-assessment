"""
ProctorForge AI - Exam, Question, and Assignment Models
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey
from models.portable_types import PortableUUID as UUID, PortableJSON as JSONB
from database import Base


class Exam(Base):
    __tablename__ = "exams"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(UUID(), ForeignKey("users.id"), nullable=False)
    type = Column(String(20), nullable=False, default="mcq")  # mcq or coding
    duration_minutes = Column(Integer, nullable=False, default=60)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="draft")
    settings = Column(JSONB(), nullable=True, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    # Class assignment
    assigned_class = Column(String(100), nullable=True)
    assigned_year = Column(String(20), nullable=True)
    assigned_section = Column(String(20), nullable=True)


class ExamAssignment(Base):
    __tablename__ = "exam_assignments"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(), ForeignKey("exams.id"), nullable=False, index=True)
    student_id = Column(UUID(), ForeignKey("users.id"), nullable=False, index=True)
    assigned_by = Column(UUID(), ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), nullable=False, default="pending")


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    exam_id = Column(UUID(), ForeignKey("exams.id"), nullable=False, index=True)
    type = Column(String(20), nullable=False, default="mcq")
    language = Column(String(20), nullable=True)
    question_text = Column(Text, nullable=False)
    options = Column(JSONB(), nullable=True)
    correct_answer = Column(Text, nullable=True)
    test_cases = Column(JSONB(), nullable=True)
    points = Column(Integer, nullable=False, default=10)
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

