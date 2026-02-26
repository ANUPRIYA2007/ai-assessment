"""
ProctorForge AI - Pydantic Schemas for Exams, Questions, Assignments
"""
from pydantic import BaseModel
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime


# --- Exam ---
class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    type: Optional[str] = "mcq"
    status: Optional[str] = "active"   # default active so students see it immediately
    duration_minutes: int = 60
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    settings: Optional[dict] = {}
    assigned_class: Optional[str] = None
    assigned_year: Optional[str] = None
    assigned_section: Optional[str] = None
    passing_score: Optional[int] = None
    questions: Optional[List[Any]] = None


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    duration_minutes: Optional[int] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None
    settings: Optional[dict] = None
    assigned_class: Optional[str] = None
    assigned_year: Optional[str] = None
    assigned_section: Optional[str] = None


class ExamResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str]
    created_by: UUID
    type: str
    duration_minutes: int
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    status: str
    settings: Optional[dict]
    created_at: datetime
    assigned_class: Optional[str] = None
    assigned_year: Optional[str] = None
    assigned_section: Optional[str] = None

    class Config:
        from_attributes = True


# --- Question ---
class QuestionCreate(BaseModel):
    type: str = "mcq"  # mcq or coding
    language: Optional[str] = None
    question_text: str
    options: Optional[List[dict]] = None
    correct_answer: Optional[str] = None
    test_cases: Optional[List[dict]] = None
    points: int = 10
    order_index: int = 0


class QuestionUpdate(BaseModel):
    type: Optional[str] = None
    language: Optional[str] = None
    question_text: Optional[str] = None
    options: Optional[List[dict]] = None
    correct_answer: Optional[str] = None
    test_cases: Optional[List[dict]] = None
    points: Optional[int] = None
    order_index: Optional[int] = None


class QuestionResponse(BaseModel):
    id: UUID
    exam_id: UUID
    type: str
    language: Optional[str]
    question_text: str
    options: Optional[List[dict]]
    correct_answer: Optional[str] = None
    points: int
    order_index: int
    created_at: datetime

    class Config:
        from_attributes = True


class QuestionStudentView(BaseModel):
    """Question view for students - no correct answer or test cases exposed."""
    id: UUID
    exam_id: UUID
    type: str
    language: Optional[str]
    question_text: str
    options: Optional[List[dict]]
    points: int
    order_index: int

    class Config:
        from_attributes = True


# --- Assignment ---
class AssignExam(BaseModel):
    student_ids: List[UUID]


class AssignmentResponse(BaseModel):
    id: UUID
    exam_id: UUID
    student_id: UUID
    assigned_by: UUID
    assigned_at: datetime
    status: str

    class Config:
        from_attributes = True


# --- Attempt ---
class AttemptCreate(BaseModel):
    exam_id: UUID
    device_fingerprint: Optional[str] = None
    browser_info: Optional[dict] = None


class AttemptResponse(BaseModel):
    id: UUID
    user_id: UUID
    exam_id: UUID
    start_time: datetime
    end_time: Optional[datetime]
    trust_score: float
    risk_level: str
    status: str

    class Config:
        from_attributes = True


# --- Code Execution ---
class CodeExecuteRequest(BaseModel):
    attempt_id: UUID
    question_id: UUID
    language: str
    code: str


class CodeExecuteResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    test_results: Optional[List[dict]] = None
    execution_time_ms: int


class CodeSubmitRequest(BaseModel):
    attempt_id: UUID
    question_id: UUID
    language: str
    code: str


# --- Events ---
class EventCreate(BaseModel):
    attempt_id: UUID
    event_type: str
    event_data: Optional[dict] = None
    confidence_score: Optional[float] = None
    hmac_signature: Optional[str] = None


class EventResponse(BaseModel):
    id: UUID
    attempt_id: UUID
    event_type: str
    event_data: Optional[dict]
    confidence_score: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Typing Metrics ---
class TypingMetricCreate(BaseModel):
    attempt_id: UUID
    wpm: Optional[float] = None
    backspace_ratio: Optional[float] = None
    paste_size: Optional[int] = None
    idle_time: Optional[float] = None
    entropy_score: Optional[float] = None
    burst_detected: str = "false"


# --- Live Code Log ---
class LiveCodeLogCreate(BaseModel):
    attempt_id: UUID
    question_id: Optional[UUID] = None
    code_snapshot: str
    event_type: str = "autosave"


# --- AI Intervention ---
class InterventionResponse(BaseModel):
    id: UUID
    attempt_id: UUID
    trigger_event: str
    risk_level: str
    intervention_text: Optional[str]
    challenge_prompt: Optional[str]
    outcome: Optional[str]
    trust_adjustment: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


# --- Trust Score ---
class TrustScoreUpdate(BaseModel):
    behavior_stability: float
    typing_consistency: float
    coding_authenticity: float
    identity_stability: float
    environment_integrity: float
    intervention_performance: float


class TrustScoreResponse(BaseModel):
    overall: float
    behavior_stability: float
    typing_consistency: float
    coding_authenticity: float
    identity_stability: float
    environment_integrity: float
    intervention_performance: float
    risk_level: str
