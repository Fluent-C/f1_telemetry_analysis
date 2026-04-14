"""
fetch_race_control.py
FastF1 session.race_control_messages DataFrame 에서 레이스 컨트롤 메시지를 수집한다.
session.load(messages=True) 가 호출된 상태여야 한다.
"""
import pandas as pd
import fastf1


def fetch_race_control(session: fastf1.core.Session) -> list[dict]:
    """
    반환값: dict 리스트 (DB INSERT 용)
    time_ms: 세션 시작 기준 경과 시간(ms)
    """
    try:
        msgs = session.race_control_messages
    except Exception:
        return []

    if msgs is None or msgs.empty:
        return []

    rows = []
    for _, row in msgs.iterrows():
        # Time 필드: Timedelta 또는 NaT
        time_td = row.get('Time')
        time_ms = None
        try:
            if pd.notna(time_td):
                time_ms = int(round(time_td.total_seconds() * 1000))
        except (TypeError, AttributeError):
            pass

        lap_raw = row.get('Lap')
        try:
            lap_number = int(lap_raw) if pd.notna(lap_raw) else None
        except (TypeError, ValueError):
            lap_number = None

        # 드라이버 코드: RacingNumber 또는 Driver 컬럼
        driver_raw = row.get('RacingNumber') or row.get('Driver')
        try:
            driver_code = str(driver_raw)[:3] if pd.notna(driver_raw) else None
        except (TypeError, ValueError):
            driver_code = None

        flag_raw = row.get('Flag')
        try:
            flag = str(flag_raw)[:20] if pd.notna(flag_raw) else None
        except (TypeError, ValueError):
            flag = None

        rows.append({
            'time_ms':     time_ms,
            'lap_number':  lap_number,
            'category':    str(row.get('Category', '') or '')[:30],
            'message':     str(row.get('Message', '') or ''),
            'flag':        flag,
            'driver_code': driver_code,
        })

    return rows
