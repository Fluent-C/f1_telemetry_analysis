"""
fetch_telemetry.py
FastF1 세션 객체에서 드라이버·랩·텔레메트리 데이터를 추출한다.

반환값:
  drivers_list  : drivers 테이블 INSERT용 dict 리스트
  laps_df       : laps 테이블 INSERT용 DataFrame
  telemetry_df  : telemetry 테이블 LOAD DATA INFILE용 DataFrame

[중요] time_ms vs session_time_ms
  time_ms         : FastF1 lap.Time       → 랩 시작 기준 (차트 X축용)
  session_time_ms : FastF1 lap.SessionTime → 세션 시작 기준 (weather 조인용)
  두 기준을 혼동하면 Phase 3 날씨 조인이 의미없는 결과를 낸다.
"""

import logging
import pandas as pd

logger = logging.getLogger(__name__)

# telemetry 테이블 컬럼 순서 (LOAD DATA INFILE 컬럼 목록과 일치해야 함)
TEL_COLUMNS = [
    'season', 'session_id', 'driver_code', 'lap_number',
    'time_ms', 'session_time_ms',
    'speed', 'throttle', 'brake', 'gear', 'rpm', 'drs', 'x', 'y',
]


def _timedelta_to_ms(td_series: pd.Series) -> pd.Series:
    """pandas Timedelta Series → int milliseconds (NaT → pd.NA)
    .round(0) 필수: pandas 2.x는 소수점 있는 float64 → Int64 safe-cast를 거부한다."""
    return (td_series.dt.total_seconds() * 1000).round(0).astype('Int64')


def fetch_drivers(session, session_db_id: int) -> list[dict]:
    """세션 참가 드라이버 정보를 반환한다."""
    drivers_list = []
    driver_codes = session.laps['Driver'].dropna().unique()

    for code in driver_codes:
        try:
            info = session.get_driver(code)

            full_name_raw = info.get('FullName', '')
            team_name_raw = info.get('TeamName', '')
            car_num_raw   = info.get('DriverNumber', 0)

            full_name  = '' if pd.isna(full_name_raw)  else str(full_name_raw)
            team_name  = '' if pd.isna(team_name_raw)  else str(team_name_raw)
            car_number = 0  if pd.isna(car_num_raw)    else int(car_num_raw)

            drivers_list.append({
                'session_id':  session_db_id,
                'driver_code': str(code),
                'full_name':   full_name,
                'team_name':   team_name,
                'car_number':  car_number,
            })
        except Exception as e:
            logger.warning(f"드라이버 정보 조회 실패 {code}: {e}")

    logger.info(f"  드라이버 {len(drivers_list)}명 확인")
    return drivers_list


def fetch_laps(session, session_db_id: int) -> pd.DataFrame:
    """laps 테이블 INSERT용 DataFrame을 반환한다."""
    rows = []
    laps = session.laps

    for _, lap in laps.iterrows():
        lap_time_ms = None
        if pd.notna(lap.get('LapTime')):
            lt = lap['LapTime']
            if hasattr(lt, 'total_seconds'):
                lap_time_ms = int(lt.total_seconds() * 1000)

        tyre_life = None
        if pd.notna(lap.get('TyreLife')):
            try:
                tyre_life = int(lap['TyreLife'])
            except (ValueError, TypeError):
                pass

        compound = lap.get('Compound')
        if pd.isna(compound) if compound is not None else True:
            compound = None

        rows.append({
            'session_id':       session_db_id,
            'driver_code':      str(lap['Driver']),
            'lap_number':       int(lap['LapNumber']),
            'lap_time_ms':      lap_time_ms,
            'compound':         compound,
            'tyre_life':        tyre_life,
            'is_personal_best': bool(lap.get('IsPersonalBest', False)),
            'deleted':          bool(lap.get('Deleted', False)),
        })

    df = pd.DataFrame(rows)
    logger.info(f"  랩 데이터 {len(df)}건 추출")
    return df


def fetch_telemetry(session, session_db_id: int, season: int) -> pd.DataFrame:
    """
    telemetry 테이블 LOAD DATA INFILE용 DataFrame을 반환한다.
    드라이버별·랩별로 get_car_data()를 호출하여 수집한다.
    session.load(telemetry=True)가 이미 완료된 상태에서 호출해야 한다.
    """
    driver_codes = session.laps['Driver'].dropna().unique()
    all_chunks: list[pd.DataFrame] = []
    total_laps = 0

    for code in driver_codes:
        driver_laps = session.laps.pick_drivers(code)

        for _, lap in driver_laps.iterrows():
            try:
                lap_num_raw = lap.get('LapNumber')
                if pd.isna(lap_num_raw):
                    continue
                lap_num = int(lap_num_raw)
                tel = lap.get_car_data()
                if tel is None or tel.empty:
                    continue

                # [필수] Timedelta → int ms 변환
                tel['time_ms']         = _timedelta_to_ms(tel['Time'])
                tel['session_time_ms'] = _timedelta_to_ms(tel['SessionTime'])

                # season, session_id, driver, lap 추가
                tel['season']       = season
                tel['session_id']   = session_db_id
                tel['driver_code']  = str(code)
                tel['lap_number']   = lap_num

                # FastF1 컬럼명 → DB 컬럼명 매핑
                tel = tel.rename(columns={
                    'Speed':    'speed',
                    'Throttle': 'throttle',
                    'Brake':    'brake',
                    'nGear':    'gear',
                    'RPM':      'rpm',
                    'DRS':      'drs',
                    'X':        'x',
                    'Y':        'y',
                })

                # 필요한 컬럼만 선택 (TEL_COLUMNS 순서와 일치)
                available = [c for c in TEL_COLUMNS if c in tel.columns]
                all_chunks.append(tel[available].copy())
                total_laps += 1

            except Exception as e:
                logger.warning(f"  텔레메트리 실패: {code} lap {lap_num}: {e}")

    if not all_chunks:
        logger.warning("텔레메트리 데이터 없음")
        return pd.DataFrame(columns=TEL_COLUMNS)

    result = pd.concat(all_chunks, ignore_index=True)
    # 누락된 컬럼(x, y 등)은 NA로 채운다 → LOAD DATA INFILE 시 \N(NULL)로 들어감
    for col in TEL_COLUMNS:
        if col not in result.columns:
            result[col] = pd.NA
    result = result[TEL_COLUMNS]

    logger.info(f"  텔레메트리 {len(result):,} rows ({total_laps} 랩 처리)")
    return result
