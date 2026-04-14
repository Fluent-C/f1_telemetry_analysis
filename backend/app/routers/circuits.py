"""
circuits.py
GET /circuits/{circuit_key}
서킷 코너 및 마샬 섹터 JSON 반환.
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from ..database import get_db

router = APIRouter(prefix='/circuits', tags=['circuits'])


@router.get('/{circuit_key}')
async def get_circuit(circuit_key: str, db=Depends(get_db)):
    sql = text("""
        SELECT rotation, corners, marshal_sectors
        FROM circuits
        WHERE circuit_key = :k
    """)
    row = (await db.execute(sql, {'k': circuit_key})).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail='Circuit not found')

    # JSON 컬럼은 문자열로 반환될 수 있음 — 파싱 보장
    def parse_json(val):
        if isinstance(val, str):
            return json.loads(val)
        return val or []

    return {
        'circuit_key':     circuit_key,
        'rotation':        row['rotation'],
        'corners':         parse_json(row['corners']),
        'marshal_sectors': parse_json(row['marshal_sectors']),
    }
