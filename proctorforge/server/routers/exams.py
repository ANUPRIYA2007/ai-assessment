"""
ProctorForge AI - Exam Router
CRUD for exams, questions, and assignments. Teacher-controlled only.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from database import get_db
from models.user import User
from models.exam import Exam, ExamAssignment, Question
from schemas.exam import (
    ExamCreate, ExamUpdate, ExamResponse,
    QuestionCreate, QuestionUpdate, QuestionResponse, QuestionStudentView,
    AssignExam, AssignmentResponse,
)
from middleware.auth import get_current_user, require_teacher, require_teacher_or_admin

router = APIRouter(prefix="/api/exams", tags=["Exams"])


# ===== EXAM CRUD =====

@router.post("/", response_model=ExamResponse, status_code=201)
async def create_exam(
    data: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """Create a new exam (teacher only). Auto-assigns students if class info provided."""
    exam = Exam(
        title=data.title,
        description=data.description,
        created_by=current_user.id,
        type=data.type or "mcq",
        status=data.status or "active",
        duration_minutes=data.duration_minutes,
        start_time=data.start_time,
        end_time=data.end_time,
        settings=data.settings or {},
        assigned_class=data.assigned_class,
        assigned_year=data.assigned_year,
        assigned_section=data.assigned_section,
    )
    db.add(exam)
    await db.flush()

    # Process inline questions if provided in the payload
    if data.questions:
        for idx, q_data in enumerate(data.questions):
            q_type = q_data.get("type") or q_data.get("question_type") or exam.type or "mcq"
            q_text = q_data.get("question_text") or q_data.get("text") or ""
            if not q_text:
                continue
            options = q_data.get("options") or []
            correct_answer = None
            if q_type == "mcq" and options:
                if isinstance(options[0], dict):
                    # [{text, is_correct}, ...]
                    correct_opts = [o.get("text", "") for o in options if o.get("is_correct")]
                    correct_answer = correct_opts[0] if correct_opts else None
                elif isinstance(options[0], str):
                    ci = q_data.get("correct_option")
                    correct_answer = options[ci] if ci is not None and ci < len(options) else None
            # For coding questions, test_cases come via options list or metadata
            test_cases = q_data.get("test_cases") or q_data.get("metadata")
            db.add(Question(
                exam_id=exam.id,
                type=q_type,
                language=q_data.get("language"),
                question_text=q_text,
                options=options if options else None,
                correct_answer=correct_answer,
                test_cases=test_cases,
                points=q_data.get("marks") or q_data.get("points") or 10,
                order_index=idx,
            ))

    # Auto-assign all students matching the class/year/section
    if data.assigned_class and data.assigned_year and data.assigned_section:
        student_query = select(User).where(
            User.role == "student",
            User.class_name == data.assigned_class,
            User.year == data.assigned_year,
            User.section == data.assigned_section,
        )
        student_result = await db.execute(student_query)
        matching_students = student_result.scalars().all()
        for student in matching_students:
            assignment = ExamAssignment(
                exam_id=exam.id,
                student_id=student.id,
                assigned_by=current_user.id,
            )
            db.add(assignment)

    await db.commit()
    await db.refresh(exam)
    return ExamResponse.model_validate(exam)


@router.get("/", response_model=List[ExamResponse])
async def list_exams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List exams. Teachers see their own exams. Students see assigned exams (individual + class)."""
    if current_user.role == "teacher":
        result = await db.execute(
            select(Exam).where(Exam.created_by == current_user.id).order_by(Exam.created_at.desc())
        )
        return [ExamResponse.model_validate(e) for e in result.scalars().all()]
    elif current_user.role == "student":
        from sqlalchemy import or_, and_
        # Individually assigned exams
        individual_q = (
            select(Exam)
            .join(ExamAssignment, ExamAssignment.exam_id == Exam.id)
            .where(ExamAssignment.student_id == current_user.id)
        )
        # Class-based assigned exams (student's class matches exam class assignment)
        class_conditions = []
        if current_user.class_name and current_user.year and current_user.section:
            class_conditions = [
                and_(
                    Exam.assigned_class == current_user.class_name,
                    Exam.assigned_year == current_user.year,
                    Exam.assigned_section == current_user.section,
                )
            ]

        if class_conditions:
            combined_q = select(Exam).where(
                or_(
                    Exam.id.in_(select(individual_q.subquery().c.id)),
                    *class_conditions,
                ),
                Exam.status == "active",
            ).order_by(Exam.created_at.desc())
        else:
            combined_q = individual_q.where(Exam.status == "active").order_by(Exam.created_at.desc())

        result = await db.execute(combined_q)
        exams = list({e.id: e for e in result.scalars().all()}.values())
        return [ExamResponse.model_validate(e) for e in exams]
    else:  # admin
        result = await db.execute(select(Exam).order_by(Exam.created_at.desc()))
        return [ExamResponse.model_validate(e) for e in result.scalars().all()]


@router.get("/{exam_id}", response_model=ExamResponse)
async def get_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific exam."""
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    # Students can view exams they are individually assigned to OR class-matched
    if current_user.role == "student":
        # Check individual assignment
        assignment = await db.execute(
            select(ExamAssignment).where(
                ExamAssignment.exam_id == exam_id,
                ExamAssignment.student_id == current_user.id,
            )
        )
        has_assignment = assignment.scalar_one_or_none() is not None

        # Check class-based match
        class_match = (
            exam.assigned_class
            and exam.assigned_year
            and exam.assigned_section
            and current_user.class_name == exam.assigned_class
            and current_user.year == exam.assigned_year
            and current_user.section == exam.assigned_section
        )

        if not has_assignment and not class_match:
            raise HTTPException(status_code=403, detail="Not assigned to this exam")

    return ExamResponse.model_validate(exam)


@router.patch("/{exam_id}", response_model=ExamResponse)
async def update_exam(
    exam_id: UUID,
    data: ExamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """Update an exam (teacher only)."""
    result = await db.execute(select(Exam).where(Exam.id == exam_id, Exam.created_by == current_user.id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(exam, field, value)

    # If class assignment changed, re-assign matching students
    if data.assigned_class and data.assigned_year and data.assigned_section:
        student_query = select(User).where(
            User.role == "student",
            User.class_name == data.assigned_class,
            User.year == data.assigned_year,
            User.section == data.assigned_section,
        )
        student_result = await db.execute(student_query)
        matching_students = student_result.scalars().all()
        for student in matching_students:
            existing = await db.execute(
                select(ExamAssignment).where(
                    ExamAssignment.exam_id == exam_id,
                    ExamAssignment.student_id == student.id,
                )
            )
            if not existing.scalar_one_or_none():
                assignment = ExamAssignment(
                    exam_id=exam_id,
                    student_id=student.id,
                    assigned_by=current_user.id,
                )
                db.add(assignment)

    await db.commit()
    await db.refresh(exam)
    return ExamResponse.model_validate(exam)


@router.delete("/{exam_id}")
async def delete_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """Delete an exam (teacher only)."""
    result = await db.execute(select(Exam).where(Exam.id == exam_id, Exam.created_by == current_user.id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    await db.delete(exam)
    return {"message": "Exam deleted"}


# ===== QUESTIONS =====

@router.post("/{exam_id}/questions", response_model=QuestionResponse, status_code=201)
async def create_question(
    exam_id: UUID,
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """Add a question to an exam (teacher only)."""
    # Verify exam belongs to teacher
    result = await db.execute(select(Exam).where(Exam.id == exam_id, Exam.created_by == current_user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Exam not found")

    question = Question(
        exam_id=exam_id,
        type=data.type,
        language=data.language,
        question_text=data.question_text,
        options=data.options,
        correct_answer=data.correct_answer,
        test_cases=data.test_cases,
        points=data.points,
        order_index=data.order_index,
    )
    db.add(question)
    await db.flush()
    return QuestionResponse.model_validate(question)


@router.get("/{exam_id}/questions")
async def get_questions(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get questions for an exam. Students don't see correct answers or test cases."""
    result = await db.execute(
        select(Question).where(Question.exam_id == exam_id).order_by(Question.order_index)
    )
    questions = result.scalars().all()

    if current_user.role == "student":
        return [QuestionStudentView.model_validate(q) for q in questions]
    return [QuestionResponse.model_validate(q) for q in questions]


@router.patch("/{exam_id}/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    exam_id: UUID,
    question_id: UUID,
    data: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """Update a question (teacher only)."""
    result = await db.execute(
        select(Question).where(Question.id == question_id, Question.exam_id == exam_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(question, field, value)
    await db.flush()
    return QuestionResponse.model_validate(question)


@router.delete("/{exam_id}/questions/{question_id}")
async def delete_question(
    exam_id: UUID,
    question_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """Delete a question (teacher only)."""
    result = await db.execute(
        select(Question).where(Question.id == question_id, Question.exam_id == exam_id)
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    await db.delete(question)
    return {"message": "Question deleted"}


# ===== ASSIGNMENTS =====

@router.post("/{exam_id}/assign", response_model=List[AssignmentResponse])
async def assign_exam(
    exam_id: UUID,
    data: AssignExam,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    """Assign an exam to students (teacher only)."""
    # Verify exam exists and belongs to teacher
    result = await db.execute(select(Exam).where(Exam.id == exam_id, Exam.created_by == current_user.id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Exam not found")

    assignments = []
    for student_id in data.student_ids:
        # Check if already assigned
        existing = await db.execute(
            select(ExamAssignment).where(
                ExamAssignment.exam_id == exam_id,
                ExamAssignment.student_id == student_id,
            )
        )
        if existing.scalar_one_or_none():
            continue

        assignment = ExamAssignment(
            exam_id=exam_id,
            student_id=student_id,
            assigned_by=current_user.id,
        )
        db.add(assignment)
        assignments.append(assignment)

    await db.flush()
    return [AssignmentResponse.model_validate(a) for a in assignments]


@router.get("/{exam_id}/assignments", response_model=List[AssignmentResponse])
async def get_assignments(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
):
    """List assignments for an exam (teacher/admin)."""
    result = await db.execute(
        select(ExamAssignment).where(ExamAssignment.exam_id == exam_id)
    )
    return [AssignmentResponse.model_validate(a) for a in result.scalars().all()]
