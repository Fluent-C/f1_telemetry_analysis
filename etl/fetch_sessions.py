"""
fetch_sessions.py
세션 메타데이터를 FastF1에서 가져와 sessions 테이블에 적재할 dict 리스트를 반환한다.

circuit_key 컨벤션: event_name 소문자+언더스코어
  예) 'Bahrain Grand Prix' → 'bahrain_grand_prix'
  Phase 2에서 circuits 테이블 추가 시 FK로 참조되므로 Phase 1부터 일관성 유지.
"""

import logging
import fastf1
import pandas as pd

from config import FASTF1_CACHE_DIR

logger = logging.getLogger(__name__)

# 이벤트 포맷별 세션 타입 목록
EVENT_FORMAT_SESSIONS: dict[str, list[str]] = {
    'conventional':       ['FP1', 'FP2', 'FP3', 'Q', 'R'],
    'sprint_shootout':    ['FP1', 'SQ',  'S',   'Q', 'R'],
    'sprint':             ['FP1', 'Q',   'S',   'FP2','R'],
    'sprint_qualifying':  ['FP1', 'SQ',  'S',   'Q', 'R'],
}

# 세션 슬롯 번호 → session_type 매핑 (포맷별)
SLOT_TO_TYPE: dict[str, dict[int, str]] = {
    'conventional':       {1:'FP1', 2:'FP2', 3:'FP3', 4:'Q',  5:'R'},
    'sprint_shootout':    {1:'FP1', 2:'SQ',  3:'S',   4:'Q',  5:'R'},
    'sprint':             {1:'FP1', 2:'Q',   3:'S',   4:'FP2',5:'R'},
    'sprint_qualifying':  {1:'FP1', 2:'SQ',  3:'S',   4:'Q',  5:'R'},
}


def get_circuit_key(event_name: str) -> str:
    """'Bahrain Grand Prix' → 'bahrain_grand_prix'"""
    return event_name.lower().replace(' ', '_')


def fetch_session_meta(season: int, round_num: int) -> list[dict]:
    """
    주어진 시즌/라운드의 모든 세션 메타데이터를 반환한다.
    sessions 테이블 INSERT에 바로 사용 가능한 dict 리스트.
    """
    fastf1.Cache.enable_cache(FASTF1_CACHE_DIR)

    schedule = fastf1.get_event_schedule(season, include_testing=False)
    match = schedule[schedule['RoundNumber'] == round_num]
    if match.empty:
        raise ValueError(f"{season} 시즌 Round {round_num} 를 찾을 수 없습니다.")

    event = match.iloc[0]
    event_name   = event['EventName']
    circuit_key  = get_circuit_key(event_name)
    event_format = event.get('EventFormat', 'conventional')
    session_types = EVENT_FORMAT_SESSIONS.get(event_format,
                                               EVENT_FORMAT_SESSIONS['conventional'])
    slot_map      = SLOT_TO_TYPE.get(event_format,
                                     SLOT_TO_TYPE['conventional'])

    logger.info(f"[{season} R{round_num}] {event_name} ({event_format})")

    sessions = []
    for slot, stype in slot_map.items():
        if stype not in session_types:
            continue

        date_col = f'Session{slot}Date'
        session_date = None
        if date_col in event.index:
            raw = event[date_col]
            if isinstance(raw, pd.Timestamp) and not pd.isna(raw):
                session_date = raw.date()
            elif hasattr(raw, 'date'):
                session_date = raw.date()

        sessions.append({
            'season':       season,
            'round':        round_num,
            'event_name':   event_name,
            'circuit_key':  circuit_key,
            'session_type': stype,
            'session_date': session_date,
        })
        logger.info(f"  세션: {stype}  날짜: {session_date}  circuit_key: {circuit_key}")

    return sessions
