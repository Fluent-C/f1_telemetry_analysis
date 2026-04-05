"""
load_data.py
F1 텔레메트리 ETL 메인 오케스트레이터

사용법:
  python load_data.py --season 2025 --round 1
  python load_data.py --season 2025 --round 1 --session R
  python load_data.py --season 2025 --all-rounds
  python load_data.py --season 2025 --all-rounds --workers 4
  python load_data.py --season 2025 --round 1 --force        # done 상태도 재처리
  python load_data.py --season 2025 --all-rounds --laps-only  # laps 컬럼만 갱신 (텔레메트리 생략)

처리 순서 (FK 의존성):
  1. sessions  INSERT (upsert)         → session_db_id 확보
  2. drivers   INSERT IGNORE
  3. laps      ON DUPLICATE KEY UPDATE
  4. telemetry LOAD DATA INFILE        ← --laps-only 시 생략
  5. weather   LOAD DATA INFILE        ← --laps-only 시 생략
  6. etl_progress UPDATE → 'done'      ← --laps-only 시 생략
"""

import argparse
import logging
import os
import sys
import tempfile
from datetime import datetime
from multiprocessing import Pool

import fastf1
import pandas as pd

from config import FASTF1_CACHE_DIR, ETL_WORKERS, ETL_MAX_RETRIES, get_db_connection
from fetch_sessions  import fetch_session_meta
from fetch_telemetry import fetch_drivers, fetch_laps, fetch_telemetry
from fetch_weather   import fetch_weather, WEATHER_COLUMNS
from fetch_telemetry import TEL_COLUMNS

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# DB 헬퍼
# ──────────────────────────────────────────────

def upsert_session(conn, meta: dict) -> int:
    """
    sessions 테이블에 INSERT … ON DUPLICATE KEY UPDATE.
    반환값: 해당 세션의 id (auto_increment PK)
    """
    sql_upsert = """
        INSERT INTO sessions
            (season, round, event_name, circuit_key, session_type, session_date)
        VALUES
            (%(season)s, %(round)s, %(event_name)s,
             %(circuit_key)s, %(session_type)s, %(session_date)s)
        ON DUPLICATE KEY UPDATE
            event_name   = VALUES(event_name),
            circuit_key  = VALUES(circuit_key),
            session_date = VALUES(session_date)
    """
    sql_select = """
        SELECT id FROM sessions
        WHERE season = %s AND round = %s AND session_type = %s
    """
    with conn.cursor() as cur:
        cur.execute(sql_upsert, meta)
        cur.execute(sql_select, (meta['season'], meta['round'], meta['session_type']))
        row = cur.fetchone()
    conn.commit()
    return row[0]


def insert_drivers(conn, drivers: list[dict]) -> None:
    """drivers 테이블에 INSERT IGNORE."""
    if not drivers:
        return
    sql = """
        INSERT IGNORE INTO drivers
            (session_id, driver_code, full_name, team_name, car_number)
        VALUES
            (%(session_id)s, %(driver_code)s, %(full_name)s,
             %(team_name)s, %(car_number)s)
    """
    with conn.cursor() as cur:
        cur.executemany(sql, drivers)
    conn.commit()


def upsert_laps(conn, laps_df: pd.DataFrame) -> None:
    """
    laps 테이블에 ON DUPLICATE KEY UPDATE.
    [주의] INSERT IGNORE 금지 — FK 있는 테이블에서 silent data loss 위험.
    """
    if laps_df.empty:
        return
    sql = """
        INSERT INTO laps
            (session_id, driver_code, lap_number,
             lap_time_ms, sector1_ms, sector2_ms, sector3_ms,
             speed_i1, speed_i2, speed_fl, speed_st,
             compound, tyre_life, fresh_tyre, stint,
             pit_in_ms, pit_out_ms, position,
             is_personal_best, deleted)
        VALUES
            (%(session_id)s, %(driver_code)s, %(lap_number)s,
             %(lap_time_ms)s, %(sector1_ms)s, %(sector2_ms)s, %(sector3_ms)s,
             %(speed_i1)s, %(speed_i2)s, %(speed_fl)s, %(speed_st)s,
             %(compound)s, %(tyre_life)s, %(fresh_tyre)s, %(stint)s,
             %(pit_in_ms)s, %(pit_out_ms)s, %(position)s,
             %(is_personal_best)s, %(deleted)s)
        ON DUPLICATE KEY UPDATE
            lap_time_ms      = VALUES(lap_time_ms),
            sector1_ms       = VALUES(sector1_ms),
            sector2_ms       = VALUES(sector2_ms),
            sector3_ms       = VALUES(sector3_ms),
            speed_i1         = VALUES(speed_i1),
            speed_i2         = VALUES(speed_i2),
            speed_fl         = VALUES(speed_fl),
            speed_st         = VALUES(speed_st),
            compound         = VALUES(compound),
            tyre_life        = VALUES(tyre_life),
            fresh_tyre       = VALUES(fresh_tyre),
            stint            = VALUES(stint),
            pit_in_ms        = VALUES(pit_in_ms),
            pit_out_ms       = VALUES(pit_out_ms),
            position         = VALUES(position),
            is_personal_best = VALUES(is_personal_best),
            deleted          = VALUES(deleted)
    """
    # astype(object) 필수: 숫자 컬럼에서 None이 다시 NaN으로 coerce되는 것을 막는다
    rows = laps_df.astype(object).where(pd.notnull(laps_df), None).to_dict('records')
    with conn.cursor() as cur:
        cur.executemany(sql, rows)
    conn.commit()


def load_df_infile(conn, df: pd.DataFrame, table: str, columns: list[str]) -> int:
    """
    DataFrame을 임시 CSV로 저장 후 LOAD DATA LOCAL INFILE로 적재한다.

    [Windows 주의]
      - tmp_path의 역슬래시를 슬래시로 변환해야 MySQL이 경로를 올바로 인식함
      - NaN은 '\\N' 으로 출력해야 MySQL이 NULL로 인식함 (빈 문자열은 0으로 들어감)
    """
    if df.empty:
        return 0

    with tempfile.NamedTemporaryFile(
        mode='w', suffix='.csv', delete=False, encoding='utf-8', newline='\n'
    ) as f:
        tmp_path = f.name

    try:
        df[columns].to_csv(tmp_path, index=False, header=False, na_rep='\\N')

        # Windows 경로 역슬래시 → 슬래시 (MySQL LOAD DATA 경로 파싱 문제 회피)
        tmp_path_unix = tmp_path.replace('\\', '/')

        col_list = ', '.join(columns)
        sql = (
            f"LOAD DATA LOCAL INFILE '{tmp_path_unix}' "
            f"INTO TABLE {table} "
            f"FIELDS TERMINATED BY ',' "
            f"LINES TERMINATED BY '\\n' "
            f"({col_list})"
        )
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        return len(df)
    finally:
        os.unlink(tmp_path)


# ──────────────────────────────────────────────
# etl_progress 헬퍼
# ──────────────────────────────────────────────

def mark_running(conn, season: int, round_num: int, session_type: str) -> None:
    sql = """
        INSERT INTO etl_progress (season, round, session_type, status, started_at)
        VALUES (%s, %s, %s, 'running', %s)
        ON DUPLICATE KEY UPDATE status = 'running', started_at = VALUES(started_at), error_msg = NULL
    """
    with conn.cursor() as cur:
        cur.execute(sql, (season, round_num, session_type, datetime.now()))
    conn.commit()


def mark_done(conn, season: int, round_num: int, session_type: str,
              tel_rows: int, wx_rows: int) -> None:
    sql = """
        INSERT INTO etl_progress
            (season, round, session_type, status, telemetry_rows, weather_rows, completed_at)
        VALUES (%s, %s, %s, 'done', %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            status         = 'done',
            telemetry_rows = VALUES(telemetry_rows),
            weather_rows   = VALUES(weather_rows),
            completed_at   = VALUES(completed_at),
            error_msg      = NULL
    """
    with conn.cursor() as cur:
        cur.execute(sql, (season, round_num, session_type, tel_rows, wx_rows, datetime.now()))
    conn.commit()


def mark_failed(conn, season: int, round_num: int, session_type: str, error: str) -> None:
    sql = """
        INSERT INTO etl_progress
            (season, round, session_type, status, error_msg, completed_at)
        VALUES (%s, %s, %s, 'failed', %s, %s)
        ON DUPLICATE KEY UPDATE
            status       = 'failed',
            error_msg    = VALUES(error_msg),
            completed_at = VALUES(completed_at)
    """
    with conn.cursor() as cur:
        cur.execute(sql, (season, round_num, session_type, error[:2000], datetime.now()))
    conn.commit()


def is_done(conn, season: int, round_num: int, session_type: str) -> bool:
    sql = """
        SELECT status FROM etl_progress
        WHERE season = %s AND round = %s AND session_type = %s
    """
    with conn.cursor() as cur:
        cur.execute(sql, (season, round_num, session_type))
        row = cur.fetchone()
    return row is not None and row[0] == 'done'


# ──────────────────────────────────────────────
# 단일 세션 처리 (워커 함수)
# ──────────────────────────────────────────────

def process_one_session(args: tuple) -> dict:
    """
    multiprocessing.Pool 워커 함수.
    반환값: {'season', 'round', 'session_type', 'status', 'tel_rows', 'wx_rows', 'error'}

    args = (season, round_num, session_type, worker_id, force, laps_only)
      laps_only=True → session.load(laps=True, telemetry=False, weather=False)
                       laps 갱신만 수행, telemetry/weather/etl_progress 갱신 생략
    """
    season, round_num, session_type, worker_id, force, laps_only = args

    result = {
        'season': season, 'round': round_num, 'session_type': session_type,
        'status': 'failed', 'tel_rows': 0, 'wx_rows': 0, 'error': '',
    }

    # 워커별 독립 DB 연결 + 캐시 디렉터리
    conn = get_db_connection()
    cache_dir = os.path.join(FASTF1_CACHE_DIR, f'worker_{worker_id}')
    os.makedirs(cache_dir, exist_ok=True)
    fastf1.Cache.enable_cache(cache_dir)

    try:
        # ── 체크포인트: laps-only는 항상 처리 (done 세션도), 일반 모드만 스킵 ──
        if not laps_only and not force and is_done(conn, season, round_num, session_type):
            logger.info(f"[{season} R{round_num} {session_type}] 이미 완료 → 스킵")
            result['status'] = 'skipped'
            return result

        if not laps_only:
            mark_running(conn, season, round_num, session_type)

        # ── 1. sessions 테이블 upsert ────────────────────
        metas = fetch_session_meta(season, round_num)
        meta  = next((m for m in metas if m['session_type'] == session_type), None)
        if meta is None:
            raise ValueError(f"세션 메타 없음: {season} R{round_num} {session_type}")

        session_db_id = upsert_session(conn, meta)
        mode_label = '[laps-only]' if laps_only else ''
        logger.info(
            f"[{season} R{round_num} {session_type}]{mode_label} "
            f"session_id={session_db_id}  로딩 시작"
        )

        # ── 2. FastF1 세션 로드 ──────────────────────────
        ff1_session = fastf1.get_session(season, round_num, session_type)
        if laps_only:
            ff1_session.load(laps=True, telemetry=False, weather=False)
        else:
            ff1_session.load(telemetry=True, weather=True)

        # ── 3. drivers INSERT IGNORE ─────────────────────
        drivers = fetch_drivers(ff1_session, session_db_id)
        insert_drivers(conn, drivers)

        # ── 4. laps ON DUPLICATE KEY UPDATE ─────────────
        laps_df = fetch_laps(ff1_session, session_db_id)
        upsert_laps(conn, laps_df)
        logger.info(f"  laps: {len(laps_df)} rows 갱신")

        if laps_only:
            # telemetry/weather/etl_progress 갱신 없이 완료
            result.update({'status': 'done'})
            logger.info(f"[{season} R{round_num} {session_type}] laps-only 완료")
            return result

        # ── 5. telemetry LOAD DATA INFILE ────────────────
        tel_df  = fetch_telemetry(ff1_session, session_db_id, season)
        tel_rows = load_df_infile(conn, tel_df, 'telemetry', TEL_COLUMNS)
        logger.info(f"  telemetry: {tel_rows:,} rows 적재")

        # ── 6. weather LOAD DATA INFILE ──────────────────
        wx_df   = fetch_weather(ff1_session, session_db_id, season)
        wx_rows = load_df_infile(conn, wx_df, 'weather', WEATHER_COLUMNS)
        logger.info(f"  weather: {wx_rows} rows 적재")

        # ── 7. 완료 마킹 ─────────────────────────────────
        mark_done(conn, season, round_num, session_type, tel_rows, wx_rows)
        result.update({'status': 'done', 'tel_rows': tel_rows, 'wx_rows': wx_rows})
        logger.info(
            f"[{season} R{round_num} {session_type}] "
            f"완료 tel={tel_rows:,}  wx={wx_rows}"
        )

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[{season} R{round_num} {session_type}] 실패: {error_msg}")
        try:
            if not laps_only:
                mark_failed(conn, season, round_num, session_type, error_msg)
        except Exception:
            pass
        result['error'] = error_msg

    finally:
        conn.close()

    return result


# ──────────────────────────────────────────────
# 재시도 래퍼
# ──────────────────────────────────────────────

def process_with_retry(args: tuple, max_retries: int = ETL_MAX_RETRIES) -> dict:
    """process_one_session을 최대 max_retries 회 재시도한다."""
    for attempt in range(1, max_retries + 1):
        result = process_one_session(args)
        if result['status'] in ('done', 'skipped'):
            return result
        season, round_num, stype = args[0], args[1], args[2]
        logger.warning(
            f"[{season} R{round_num} {stype}] "
            f"재시도 {attempt}/{max_retries}: {result['error'][:80]}"
        )
    return result


# ──────────────────────────────────────────────
# 작업 목록 빌드
# ──────────────────────────────────────────────

def build_task_list(
    season: int,
    rounds: list[int],
    session_types: list[str] | None,
) -> list[tuple]:
    """
    (season, round_num, session_type, worker_id, force) 튜플 리스트를 반환한다.
    worker_id는 인덱스 % ETL_WORKERS 로 배정한다.
    """
    from fetch_sessions import EVENT_FORMAT_SESSIONS, SLOT_TO_TYPE
    import fastf1 as _ff1

    _ff1.Cache.enable_cache(FASTF1_CACHE_DIR)
    schedule = _ff1.get_event_schedule(season, include_testing=False)

    tasks = []
    for round_num in rounds:
        match = schedule[schedule['RoundNumber'] == round_num]
        if match.empty:
            logger.warning(f"  R{round_num} 스케줄 없음 — 스킵")
            continue
        event_format = match.iloc[0].get('EventFormat', 'conventional')
        all_types    = EVENT_FORMAT_SESSIONS.get(event_format,
                                                  EVENT_FORMAT_SESSIONS['conventional'])
        for stype in all_types:
            if session_types and stype not in session_types:
                continue
            tasks.append((season, round_num, stype))

    return tasks


# ──────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='F1 텔레메트리 ETL 적재')
    parser.add_argument('--season',     type=int,   required=True,
                        help='시즌 연도 (예: 2025)')
    parser.add_argument('--round',      type=int,   default=None,
                        help='단일 라운드 번호')
    parser.add_argument('--all-rounds', action='store_true',
                        help='해당 시즌 전체 라운드 처리')
    parser.add_argument('--session',    type=str,   default=None,
                        help='세션 타입 필터 (예: R, Q, FP1). 미지정 시 전체')
    parser.add_argument('--workers',    type=int,   default=ETL_WORKERS,
                        help=f'병렬 워커 수 (기본: {ETL_WORKERS})')
    parser.add_argument('--force',      action='store_true',
                        help='이미 done 상태인 세션도 재처리')
    parser.add_argument('--laps-only',  action='store_true',
                        help='laps 컬럼만 갱신 (telemetry/weather 생략). Step 9 신규 컬럼 채우기 용도')
    args = parser.parse_args()

    if not args.round and not args.all_rounds:
        parser.error('--round 또는 --all-rounds 중 하나를 지정하세요.')

    # ── 라운드 목록 결정 ──────────────────────────
    if args.all_rounds:
        fastf1.Cache.enable_cache(FASTF1_CACHE_DIR)
        schedule = fastf1.get_event_schedule(args.season, include_testing=False)
        rounds = sorted(schedule['RoundNumber'].dropna().astype(int).tolist())
        logger.info(f"  {args.season} 시즌 {len(rounds)}개 라운드")
    else:
        rounds = [args.round]

    session_filter = [args.session] if args.session else None

    # ── 작업 목록 빌드 ────────────────────────────
    raw_tasks = build_task_list(args.season, rounds, session_filter)
    if not raw_tasks:
        logger.error("처리할 세션이 없습니다.")
        sys.exit(1)

    # worker_id 배정
    laps_only = args.laps_only
    tasks = [
        (season, rnd, stype, idx % args.workers, args.force, laps_only)
        for idx, (season, rnd, stype) in enumerate(raw_tasks)
    ]
    mode_str = ' [laps-only 모드]' if laps_only else ''
    logger.info(f"  총 {len(tasks)}개 세션, workers={args.workers}{mode_str}")

    # ── 병렬 처리 ────────────────────────────────
    if args.workers == 1:
        results = [process_with_retry(t) for t in tasks]
    else:
        with Pool(processes=args.workers) as pool:
            results = pool.map(process_with_retry, tasks)

    # ── 결과 요약 ────────────────────────────────
    done    = [r for r in results if r['status'] == 'done']
    skipped = [r for r in results if r['status'] == 'skipped']
    failed  = [r for r in results if r['status'] == 'failed']

    total_tel = sum(r['tel_rows'] for r in done)
    total_wx  = sum(r['wx_rows']  for r in done)

    print('\n' + '=' * 60)
    print(f'  완료: {len(done)}  스킵: {len(skipped)}  실패: {len(failed)}')
    print(f'  telemetry 합계: {total_tel:,} rows')
    print(f'  weather   합계: {total_wx:,} rows')
    if failed:
        print('\n  [실패 세션]')
        for r in failed:
            print(f"    {r['season']} R{r['round']} {r['session_type']}: {r['error'][:80]}")
    print('=' * 60)

    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
