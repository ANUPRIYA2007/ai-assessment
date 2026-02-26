"""
ProctorForge AI - User Model
"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Text
from models.portable_types import PortableUUID as UUID
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role = Column(String(20), nullable=False, default="student")  # student, teacher, admin
    status = Column(String(20), nullable=False, default="active")  # active, suspended, locked
    created_at = Column(DateTime, default=datetime.utcnow)

    # Student-specific fields
    gender = Column(String(20), nullable=True)
    class_name = Column(String(100), nullable=True)
    year = Column(String(20), nullable=True)
    section = Column(String(20), nullable=True)
    register_number = Column(String(100), nullable=True)
