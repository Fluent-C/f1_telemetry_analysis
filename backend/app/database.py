"""
database.py
SQLAlchemy 2.0 async 엔진 및 세션 팩토리.

get_db() — FastAPI Depends()에서 사용하는 async 세션 제너레이터.
engine    — 앱 시작/종료 시 connect/dispose에 직접 사용.
"""

import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

DB_HOST = os.getenv('DB_HOST', '127.0.0.1')
DB_PORT = os.getenv('DB_PORT', '3306')
DB_NAME = os.getenv('DB_NAME', 'f1db')
DB_USER = os.getenv('DB_USER', 'f1user')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')

DATABASE_URL = (
    f"mysql+aiomysql://{DB_USER}:{DB_PASSWORD}"
    f"@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    f"?charset=utf8mb4"
)

engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,   # 끊긴 연결 자동 재시도
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    """FastAPI Depends()용 async 세션 제너레이터."""
    async with AsyncSessionLocal() as session:
        yield session
