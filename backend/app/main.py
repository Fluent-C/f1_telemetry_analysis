"""
main.py
FastAPI 앱 진입점.

실행:
  uvicorn app.main:app --reload --port 8000

설계 포인트:
  - session_season_cache: 앱 시작 시 session_id → season 전체 로드
    /telemetry 엔드포인트에서 파티션 프루닝용 season 을 추가 DB 쿼리 없이 조회
  - lifespan 컨텍스트 매니저: 최신 FastAPI 방식 (on_event 대체)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .database import engine, AsyncSessionLocal
from .routers import sessions, drivers, telemetry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── 앱 전역 캐시: session_id → season ──────────────
# 이 캐시를 참조하는 telemetry 라우터가 from ..main import session_season_cache 로 가져감
session_season_cache: dict[int, int] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 훅."""
    # ── Startup ──────────────────────────────────────
    logger.info('앱 시작: session_season_cache 로드 중...')
    async with AsyncSessionLocal() as db:
        result = await db.execute(text('SELECT id, season FROM sessions'))
        rows = result.all()
        session_season_cache.update({row[0]: row[1] for row in rows})
    logger.info(f'  {len(session_season_cache)}개 세션 캐시 완료')

    yield

    # ── Shutdown ─────────────────────────────────────
    await engine.dispose()
    logger.info('앱 종료: DB 연결 풀 해제')


app = FastAPI(
    title='F1 Telemetry Analytics API',
    description='FastF1 기반 F1 텔레메트리 비교 분석 API',
    version='1.0.0',
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────
import os
from dotenv import load_dotenv
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../../.env'))

CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# ── 라우터 등록 ───────────────────────────────────
app.include_router(sessions.router)
app.include_router(drivers.router)
app.include_router(telemetry.router)


@app.get('/health', tags=['health'])
async def health():
    return {'status': 'ok', 'cached_sessions': len(session_season_cache)}
