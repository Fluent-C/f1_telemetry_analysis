"""
fetch_results.py
세션의 공식 결과를 FastF1 session.results DataFrame에서 수집한다.

사용법:
    from fetch_results import fetch_results
    rows = fetch_results(session)
"""
import pandas as pd
import fastf1


def _timedelta_to_ms(val) -> int | None:
    """단일 Timedelta 값을 ms 정수로 변환. NaT/None은 None 반환."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    try:
        total_sec = val.total_seconds()
        return int(round(total_sec * 1000))
    except Exception:
        return None


def _to_int_position(val) -> int | None:
    """
    ClassifiedPosition / GridPosition 변환.
    FastF1은 DNF/DSQ 등을 문자열 'R','D','E','W','F','N'으로 반환함.
    숫자로 변환 가능하면 int, 아니면 None (DNF 등).
    """
    if val is None:
        return None
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return int(float(str(val)))
    except (ValueError, TypeError):
        return None


def fetch_results(session: fastf1.core.Session) -> list[dict]:
    """
    session.results DataFrame에서 결과 행을 추출하여 dict 리스트로 반환.
    session.load()가 호출된 상태여야 함.

    ClassifiedPosition이 문자열('R','D' 등)인 경우 → None (DNF/DSQ 처리)
    Q1/Q2/Q3가 NaT인 경우 → None (레이스 세션 등)
    """
    try:
        results = session.results
    except Exception:
        return []

    if results is None or results.empty:
        return []

    rows = []
    for _, row in results.iterrows():
        driver_code = str(row.get('Abbreviation', '') or '')[:3].strip()
        if not driver_code:
            continue

        classified_pos = _to_int_position(row.get('ClassifiedPosition'))
        grid_pos       = _to_int_position(row.get('GridPosition'))

        points_raw = row.get('Points')
        try:
            points = float(points_raw) if pd.notna(points_raw) else None
        except (TypeError, ValueError):
            points = None

        status_raw = row.get('Status')
        try:
            status = str(status_raw) if pd.notna(status_raw) else None
        except (TypeError, ValueError):
            status = None

        rows.append({
            'driver_code':         driver_code,
            'classified_position': classified_pos,
            'grid_position':       grid_pos,
            'points':              points,
            'q1_ms':               _timedelta_to_ms(row.get('Q1')),
            'q2_ms':               _timedelta_to_ms(row.get('Q2')),
            'q3_ms':               _timedelta_to_ms(row.get('Q3')),
            'status':              status,
        })

    return rows
