"""
results.py
GET /results?session_id=X
해당 세션의 공식 결과를 반환한다.
classified_position 오름차순 정렬. DNF(NULL)는 마지막에 위치.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..database import get_db
from ..schemas import SessionResultOut

router = APIRouter(prefix='/results', tags=['results'])


@router.get('', response_model=list[SessionResultOut])
async def get_results(
    session_id: int = Query(..., description='세션 ID'),
    db: AsyncSession = Depends(get_db),
):
    sql = text("""
        SELECT
            sr.driver_code,
            sr.classified_position,
            sr.grid_position,
            sr.points,
            sr.q1_ms,
            sr.q2_ms,
            sr.q3_ms,
            sr.status,
            d.full_name,
            d.team_name,
            COALESCE(t.team_color, 'FFFFFF') AS team_color
        FROM session_results sr
        LEFT JOIN drivers d
            ON d.session_id = sr.session_id
           AND d.driver_code = sr.driver_code
        LEFT JOIN sessions s
            ON s.id = sr.session_id
        LEFT JOIN teams t
            ON t.team_name = d.team_name
           AND t.season = s.season
        WHERE sr.session_id = :session_id
        ORDER BY
            sr.classified_position IS NULL,
            sr.classified_position ASC
    """)
    result = await db.execute(sql, {'session_id': session_id})
    rows = result.mappings().all()
    return [SessionResultOut(**dict(r)) for r in rows]
