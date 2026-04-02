"""
fetch_weather.py
FastF1 세션 객체에서 날씨 데이터를 추출한다.

반환값:
  weather_df : weather 테이블 LOAD DATA INFILE용 DataFrame

[중요] weather.time_ms 는 세션 시작 기준 (telemetry.session_time_ms 와 조인)
"""

import logging
import pandas as pd

logger = logging.getLogger(__name__)

# weather 테이블 컬럼 순서 (LOAD DATA INFILE 컬럼 목록과 일치해야 함)
WEATHER_COLUMNS = [
    'season', 'session_id',
    'time_ms',
    'air_temp', 'track_temp', 'humidity', 'rainfall',
    'wind_speed', 'wind_dir',
]


def fetch_weather(session, session_db_id: int, season: int) -> pd.DataFrame:
    """
    weather 테이블 LOAD DATA INFILE용 DataFrame을 반환한다.
    session.load(weather=True)가 이미 완료된 상태에서 호출해야 한다.

    FastF1 컬럼 → DB 컬럼:
      Time          → time_ms       (세션 시작 기준 ms)
      AirTemp       → air_temp
      TrackTemp     → track_temp
      Humidity      → humidity
      Rainfall      → rainfall
      WindSpeed     → wind_speed
      WindDirection → wind_dir
    """
    weather_data = session.weather_data
    if weather_data is None or weather_data.empty:
        logger.warning("날씨 데이터 없음")
        return pd.DataFrame(columns=WEATHER_COLUMNS)

    df = weather_data.copy()

    # Time (Timedelta, 세션 시작 기준) → int ms
    df['time_ms'] = (df['Time'].dt.total_seconds() * 1000).round(0).astype('Int64')

    # 메타 컬럼 추가
    df['season']     = season
    df['session_id'] = session_db_id

    # FastF1 컬럼명 → DB 컬럼명 매핑
    df = df.rename(columns={
        'AirTemp':       'air_temp',
        'TrackTemp':     'track_temp',
        'Humidity':      'humidity',
        'Rainfall':      'rainfall',
        'WindSpeed':     'wind_speed',
        'WindDirection': 'wind_dir',
    })

    # 필요한 컬럼만 선택
    available = [c for c in WEATHER_COLUMNS if c in df.columns]
    result = df[available].copy()

    logger.info(f"  날씨 데이터 {len(result)} rows 추출")
    return result
