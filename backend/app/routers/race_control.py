"""
race_control.py
GET /race-control?session_id=X
레이스 컨트롤 메시지 반환 (time_ms 오름차순).
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from ..database import get_db

router = APIRouter(prefix='/race-control', tags=['race_control'])


@router.get('')
async def get_race_control(
    session_id: int = Query(..., description='세션 ID'),
    db=Depends(get_db),
):
    sql = text("""
        SELECT time_ms, lap_number, category, message, flag, driver_code
        FROM race_control_messages
        WHERE session_id = :session_id
        ORDER BY time_ms ASC
    """)
    rows = (await db.execute(sql, {'session_id': session_id})).mappings().all()
    return [dict(r) for r in rows]
