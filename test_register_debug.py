#!/usr/bin/env python
"""
Direct test of the registration endpoint logic
"""
import asyncio
import sys
import os

# Add server to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'proctorforge', 'server'))

async def test_registration():
    """Test registration flow directly"""
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from sqlalchemy.orm import DeclarativeBase
    from schemas.auth import UserRegister
    from models.user import User
    from middleware.auth import hash_password, create_access_token
    from database import Base
    
    # Create in-memory SQLite database
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=True)
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Create session
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # Test data
        data = UserRegister(
            name="Test User",
            email="test@example.com",
            password="testpass123",
            role="student"
        )
        
        print(f"[TEST] Starting with data: {data}")
        
        try:
            # Check email uniqueness
            from sqlalchemy import select
            print(f"[TEST] Checking email uniqueness...")
            result = await db.execute(select(User).where(User.email == data.email))
            existing = result.scalar_one_or_none()
            print(f"[TEST] Email check result: {existing}")
            
            # Create user
            print(f"[TEST] Creating user object...")
            password_hash = hash_password(data.password)
            print(f"[TEST] Password hash created: {password_hash[:20]}...")
            
            user = User(
                name=data.name,
                email=data.email,
                password_hash=password_hash,
                role=data.role,
            )
            print(f"[TEST] User object created: {user}")
            
            # Add to session
            print(f"[TEST] Adding user to session...")
            db.add(user)
            
            # Flush
            print(f"[TEST] Flushing to database...")
            await db.flush()
            print(f"[TEST] Flush successful! User ID: {user.id}")
            
            # Create token
            print(f"[TEST] Creating JWT token...")
            token = create_access_token({"sub": str(user.id), "role": user.role})
            print(f"[TEST] Token created: {token[:50]}...")
            
            # Build response
            print(f"[TEST] Building response object...")
            response = {
                "access_token": token,
                "token_type": "bearer",
                "user": {
                    "id": str(user.id),
                    "name": user.name,
                    "email": user.email,
                    "role": user.role,
                    "status": user.status,
                    "created_at": user.created_at.isoformat() if user.created_at else None,
                }
            }
            print(f"[TEST] Response created successfully!")
            print(f"[TEST] Response: {response}")
            
            # Commit
            print(f"[TEST] Committing transaction...")
            await db.commit()
            print(f"[TEST] SUCCESS! Registration test passed!")
            
        except Exception as e:
            print(f"[TEST ERROR] {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_registration())
