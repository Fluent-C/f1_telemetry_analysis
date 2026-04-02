"""
routers/sessions.py

GET /sessions          — 시즌별 세션 목록
GET /sessions/{id}/laps — 세션 내 드라이버별 랩 목록
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models import Session as SessionModel, Lap
from ..schemas import SessionOut, LapOut

router = APIRouter(prefix='/sessions', tags=['sessions'])


@router.get('', response_model=list[SessionOut])
async def list_sessions(
    season: int = Query(..., description='시즌 연도 (예: 2025)'),
    db: AsyncSession = Depends(get_db),
):
    """해당 시즌의 모든 세션을 라운드·세션 타입 순으로 반환한다."""
    result = await db.execute(
        select(SessionModel)
        .where(SessionModel.season == season)
        .order_by(SessionModel.round, SessionModel.session_type)
    )
    return result.scalars().all()


@router.get('/{session_id}/laps', response_model=list[LapOut])
async def list_laps(
    session_id: int,
    driver: str | None = Query(None, description='드라이버 코드 필터 (예: VER)'),
    db: AsyncSession = Depends(get_db),
):
    """세션 내 랩 데이터를 반환한다. driver 파라미터로 단일 드라이버 필터 가능."""
    stmt = select(Lap).where(Lap.session_id == session_id)
    if driver:
        stmt = stmt.where(Lap.driver_code == driver.upper())
    stmt = stmt.order_by(Lap.driver_code, Lap.lap_number)

    result = await db.execute(stmt)
    laps = result.scalars().all()
    if not laps:
        raise HTTPException(status_code=404, detail='세션 또는 드라이버를 찾을 수 없습니다.')
    return laps
