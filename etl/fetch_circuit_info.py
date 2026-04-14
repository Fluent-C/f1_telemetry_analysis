"""
fetch_circuit_info.py
FastF1 session.get_circuit_info() 에서 코너 및 마샬 섹터 데이터를 수집한다.
circuit_key 는 session.event['Location'] 을 사용한다.
"""
import fastf1


def fetch_circuit_info(session: fastf1.core.Session) -> dict | None:
    """
    반환값: {'circuit_key': str, 'rotation': float, 'corners': list, 'marshal_sectors': list}
    데이터 없으면 None 반환.
    """
    try:
        circuit_info = session.get_circuit_info()
    except Exception:
        return None

    if circuit_info is None:
        return None

    # sessions 테이블의 circuit_key 생성 방식과 동일: EventName 소문자+언더스코어
    event_name  = str(session.event.get('EventName', 'unknown'))
    circuit_key = event_name.lower().replace(' ', '_')

    import math

    def safe_float(val, default=0.0) -> float:
        """NaN / Inf → default (MySQL JSON은 NaN 거부)."""
        try:
            v = float(val)
            return default if (math.isnan(v) or math.isinf(v)) else v
        except (TypeError, ValueError):
            return default

    corners = []
    try:
        for _, row in circuit_info.corners.iterrows():
            corners.append({
                'number':   int(row['Number']),
                'letter':   str(row.get('Letter', '') or ''),
                'x':        safe_float(row['X']),
                'y':        safe_float(row['Y']),
                'angle':    safe_float(row.get('Angle')),
                'distance': safe_float(row.get('Distance')),
            })
    except Exception:
        corners = []

    marshal_sectors = []
    try:
        if hasattr(circuit_info, 'marshal_sectors') and circuit_info.marshal_sectors is not None:
            for _, row in circuit_info.marshal_sectors.iterrows():
                marshal_sectors.append({
                    'number': int(row['Number']),
                    'x':      safe_float(row['X']),
                    'y':      safe_float(row['Y']),
                })
    except Exception:
        marshal_sectors = []

    return {
        'circuit_key':     circuit_key,
        'rotation':        float(getattr(circuit_info, 'rotation', 0) or 0),
        'corners':         corners,
        'marshal_sectors': marshal_sectors,
    }
