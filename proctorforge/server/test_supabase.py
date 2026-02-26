
import asyncio
import os
import sys

# Add the server directory to sys.path to import config and database
sys.path.append(os.getcwd())

from config import settings
from sqlalchemy.ext.asyncio import create_async_engine
import ssl

async def test_conn():
    db_url = settings.DATABASE_URL
    print(f"Testing connection to: {db_url}")
    
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    engine = create_async_engine(
        db_url,
        echo=True,
        connect_args={
            "ssl": ssl_context,
            "prepared_statement_cache_size": 0,
        },
    )
    
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
            print("✅ CONNECTION SUCCESSFUL!")
    except Exception as e:
        print(f"❌ CONNECTION FAILED: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_conn())
