"""
routers/drivers.py

GET /drivers?session_id=5
  — 세션 참가 드라이버 목록 + 팀 색상 (teams 테이블 LEFT JOIN)
  — COALESCE(team_color, 'FFFFFF'): 팀 정보 없을 때 흰색 폴백
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas import DriverOut

router = APIRouter(prefix='/drivers', tags=['drivers'])

_SQL = text("""
    SELECT
        d.driver_code,
        d.full_name,
        d.team_name,
        d.car_number,
        COALESCE(t.team_color, 'FFFFFF') AS team_color
    FROM drivers d
    JOIN sessions s ON d.session_id = s.id
    LEFT JOIN teams t
           ON d.team_name = t.team_name
          AND s.season    = t.season
    WHERE d.session_id = :session_id
    ORDER BY d.driver_code
""")


@router.get('', response_model=list[DriverOut])
async def list_drivers(
    session_id: int = Query(..., description='세션 ID'),
    db: AsyncSession = Depends(get_db),
):
    """세션 참가 드라이버 목록 + 팀 색상을 반환한다."""
    result = await db.execute(_SQL, {'session_id': session_id})
    rows = result.mappings().all()
    if not rows:
        raise HTTPException(status_code=404, detail='세션을 찾을 수 없습니다.')
    return [DriverOut(**row) for row in rows]
