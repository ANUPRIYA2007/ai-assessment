"""
ProctorForge AI - Code Execution Router
Secure code execution with automatic test case validation.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import datetime

from database import get_db
from models.attempt import Attempt, CodeSubmission
from models.exam import Question
from models.user import User
from middleware.auth import get_current_user
from services.sandbox import execute_code, run_test_cases

router = APIRouter(prefix="/api/code", tags=["Code Execution"])


@router.post("/run")
async def run_code(
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute code in the sandbox and return output."""
    code = data.get("code", "")
    language = data.get("language", "python")
    stdin_data = data.get("stdin", "")

    if not code.strip():
        raise HTTPException(status_code=400, detail="No code provided")

    result = await execute_code(code, language, stdin_data=stdin_data, timeout=15)
    return result.to_dict()


@router.post("/submit/{attempt_id}/{question_id}")
async def submit_code(
    attempt_id: str,
    question_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit code for grading against hidden test cases."""
    code = data.get("code", "")
    language = data.get("language", "python")

    if not code.strip():
        raise HTTPException(status_code=400, detail="No code provided")

    # Verify attempt belongs to user
    result = await db.execute(
        select(Attempt).where(Attempt.id == UUID(attempt_id), Attempt.user_id == current_user.id)
    )
    attempt = result.scalar_one_or_none()
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")

    # Get question and test cases
    result = await db.execute(select(Question).where(Question.id == UUID(question_id)))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    test_cases = question.test_cases or []
    test_results = {}

    if test_cases:
        test_results = await run_test_cases(code, test_cases, language)
    else:
        # No test cases: just run the code
        exec_result = await execute_code(code, language, timeout=15)
        test_results = {
            "total": 0,
            "passed": 0,
            "score": 0,
            "output": exec_result.to_dict(),
        }

    # Save submission
    submission = CodeSubmission(
        attempt_id=UUID(attempt_id),
        question_id=UUID(question_id),
        language=language,
        code=code,
        test_results=test_results,
        score=test_results.get("score", 0),
        submitted_at=datetime.utcnow(),
    )
    db.add(submission)

    return {
        "submission_id": str(submission.id),
        "test_results": test_results,
    }
