"""
routers/telemetry.py

GET /telemetry?session_id=5&drivers=VER,HAM&laps=10,10

핵심 설계:
  - session_season_cache 로 season 조회 (추가 DB 쿼리 없음)
  - WHERE 에 season 포함 → RANGE 파티션 프루닝 동작
  - 컬럼 방향(column-oriented) 직렬화 → JSON 크기 최소화
  - drivers/laps 를 쌍으로 처리: drivers=VER,HAM&laps=10,12
    → VER lap 10, HAM lap 12
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..schemas import DriverTelemetry, TelemetryData, TelemetryOut

router = APIRouter(prefix='/telemetry', tags=['telemetry'])

_TEL_SQL = text("""
    SELECT
        time_ms, speed, throttle, brake, gear, rpm, drs
    FROM telemetry
    WHERE season      = :season
      AND session_id  = :session_id
      AND driver_code = :driver_code
      AND lap_number  = :lap_number
    ORDER BY time_ms
""")

_TEAM_COLOR_SQL = text("""
    SELECT COALESCE(t.team_color, 'FFFFFF') AS team_color
    FROM drivers d
    JOIN sessions s ON d.session_id = s.id
    LEFT JOIN teams t
           ON d.team_name = t.team_name
          AND s.season    = t.season
    WHERE d.session_id  = :session_id
      AND d.driver_code = :driver_code
    LIMIT 1
""")


@router.get('', response_model=TelemetryOut)
async def get_telemetry(
    session_id: int = Query(..., description='세션 ID'),
    drivers: str    = Query(..., description='드라이버 코드 콤마 구분 (예: VER,HAM)'),
    laps:    str    = Query(..., description='랩 번호 콤마 구분, drivers 와 순서 일치 (예: 10,12)'),
    db: AsyncSession = Depends(get_db),
):
    """
    드라이버×랩 조합의 텔레메트리를 비교용으로 반환한다.

    예: /telemetry?session_id=5&drivers=VER,HAM&laps=10,12
      → VER의 10랩 + HAM의 12랩 데이터
    """
    # ── 파라미터 파싱 ────────────────────────────────────
    driver_list = [d.strip().upper() for d in drivers.split(',')]
    try:
        lap_list = [int(x.strip()) for x in laps.split(',')]
    except ValueError:
        raise HTTPException(status_code=422, detail='laps 파라미터는 정수 콤마 목록이어야 합니다.')

    if len(driver_list) != len(lap_list):
        raise HTTPException(
            status_code=422,
            detail=f'drivers({len(driver_list)})와 laps({len(lap_list)}) 개수가 일치해야 합니다.',
        )

    # ── session_season_cache 에서 season 조회 (추가 DB 쿼리 없음) ──
    from ..main import session_season_cache
    season = session_season_cache.get(session_id)
    if season is None:
        raise HTTPException(status_code=404, detail=f'session_id={session_id}를 찾을 수 없습니다.')

    # ── 드라이버×랩별 텔레메트리 조회 ───────────────────
    comparisons: list[DriverTelemetry] = []

    for driver_code, lap_number in zip(driver_list, lap_list):
        # 팀 색상
        color_result = await db.execute(
            _TEAM_COLOR_SQL, {'session_id': session_id, 'driver_code': driver_code}
        )
        color_row = color_result.mappings().first()
        team_color = color_row['team_color'] if color_row else 'FFFFFF'

        # 텔레메트리
        tel_result = await db.execute(
            _TEL_SQL,
            {
                'season':      season,
                'session_id':  session_id,
                'driver_code': driver_code,
                'lap_number':  lap_number,
            },
        )
        rows = tel_result.mappings().all()

        if not rows:
            continue   # 데이터 없는 드라이버×랩은 스킵

        # 컬럼 방향 직렬화
        data = TelemetryData(
            time_ms  = [r['time_ms']  for r in rows],
            speed    = [r['speed']    for r in rows],
            throttle = [r['throttle'] for r in rows],
            brake    = [r['brake']    for r in rows],
            gear     = [r['gear']     for r in rows],
            rpm      = [r['rpm']      for r in rows],
            drs      = [r['drs']      for r in rows],
        )
        comparisons.append(DriverTelemetry(
            driver_code=driver_code,
            team_color=team_color,
            lap_number=lap_number,
            data=data,
        ))

    if not comparisons:
        raise HTTPException(status_code=404, detail='조건에 맞는 텔레메트리 데이터가 없습니다.')

    return TelemetryOut(session_id=session_id, comparisons=comparisons)
