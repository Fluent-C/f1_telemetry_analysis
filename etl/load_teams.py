"""
load_teams.py
FastF1 세션 결과에서 팀명/팀 색상을 추출해 teams 테이블에 적재한다.

사용법:
  python load_teams.py --season 2025 --round 5   # 특정 라운드 R 세션 기준
  python load_teams.py --season 2025              # 시즌 전체 라운드 스캔

[주의]
  teams 테이블은 (team_name, season) UNIQUE 제약이 있으므로
  INSERT IGNORE를 사용해 중복 실행에 안전하다.
  team_color가 바뀐 경우 ON DUPLICATE KEY UPDATE team_color=VALUES(team_color) 로
  덮어쓸 수 있도록 --update 플래그를 제공한다.
"""

import argparse
import logging
import sys

import fastf1
import pandas as pd

from config import FASTF1_CACHE_DIR, get_db_connection

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%H:%M:%S',
)
logger = logging.getLogger(__name__)


def extract_teams_from_session(season: int, round_num: int) -> list[dict]:
    """
    해당 라운드의 R(결승) 세션 결과에서 팀명·팀 색상을 추출한다.
    R 세션이 없으면 Q → FP1 순으로 대체한다.
    """
    fastf1.Cache.enable_cache(FASTF1_CACHE_DIR)

    for session_type in ('R', 'Q', 'FP1'):
        try:
            session = fastf1.get_session(season, round_num, session_type)
            session.load(telemetry=False, weather=False, messages=False)
            results = session.results
            if results is None or results.empty:
                continue

            teams: dict[str, str] = {}  # team_name → team_color
            for _, row in results.iterrows():
                name  = row.get('TeamName', '')
                color = row.get('TeamColor', '')
                if name and color and not pd.isna(name) and not pd.isna(color):
                    # color 정규화: '#3671C6' → '3671C6', 이미 6자리면 그대로
                    color = str(color).lstrip('#').upper()
                    if len(color) == 6:
                        teams[str(name)] = color

            if teams:
                logger.info(f"  [{season} R{round_num} {session_type}] 팀 {len(teams)}개 추출")
                return [
                    {'team_name': name, 'season': season, 'team_color': color}
                    for name, color in teams.items()
                ]
        except Exception as e:
            logger.warning(f"  {session_type} 세션 로드 실패: {e}")

    logger.warning(f"  [{season} R{round_num}] 팀 정보 추출 실패")
    return []


def upsert_teams(conn, teams: list[dict], update_color: bool = False) -> int:
    """
    teams 테이블에 INSERT IGNORE (기본) 또는 ON DUPLICATE KEY UPDATE (--update).
    반환값: 실제 영향받은 행 수
    """
    if not teams:
        return 0

    if update_color:
        sql = """
            INSERT INTO teams (team_name, season, team_color)
            VALUES (%(team_name)s, %(season)s, %(team_color)s)
            ON DUPLICATE KEY UPDATE team_color = VALUES(team_color)
        """
    else:
        sql = """
            INSERT IGNORE INTO teams (team_name, season, team_color)
            VALUES (%(team_name)s, %(season)s, %(team_color)s)
        """

    with conn.cursor() as cur:
        cur.executemany(sql, teams)
    conn.commit()
    return cur.rowcount


def print_teams_table(teams: list[dict]) -> None:
    """추출된 팀 목록을 테이블 형식으로 출력한다."""
    print(f"\n{'팀명':<35} {'시즌':<6} {'색상'}")
    print('-' * 55)
    for t in sorted(teams, key=lambda x: x['team_name']):
        print(f"{t['team_name']:<35} {t['season']:<6} #{t['team_color']}")
    print()


def main():
    parser = argparse.ArgumentParser(description='F1 팀 색상 teams 테이블 적재')
    parser.add_argument('--season', type=int, required=True, help='시즌 연도 (예: 2025)')
    parser.add_argument('--round',  type=int, default=None,  help='라운드 번호 (생략 시 전체 라운드)')
    parser.add_argument('--update', action='store_true',
                        help='이미 존재하는 팀의 team_color를 덮어씀')
    parser.add_argument('--dry-run', action='store_true',
                        help='DB에 적재하지 않고 추출 결과만 출력')
    args = parser.parse_args()

    # 라운드 목록 결정
    if args.round:
        rounds = [args.round]
    else:
        fastf1.Cache.enable_cache(FASTF1_CACHE_DIR)
        schedule = fastf1.get_event_schedule(args.season, include_testing=False)
        rounds = sorted(schedule['RoundNumber'].dropna().astype(int).tolist())
        logger.info(f"  {args.season} 시즌 라운드 {len(rounds)}개 스캔")

    all_teams: dict[str, dict] = {}   # team_name → dict (마지막 라운드 값 유지)
    for rnd in rounds:
        teams = extract_teams_from_session(args.season, rnd)
        for t in teams:
            all_teams[t['team_name']] = t

    team_list = list(all_teams.values())
    print_teams_table(team_list)

    if args.dry_run:
        logger.info("--dry-run: DB 적재 생략")
        sys.exit(0)

    conn = get_db_connection()
    try:
        affected = upsert_teams(conn, team_list, update_color=args.update)
        action = 'UPSERT' if args.update else 'INSERT IGNORE'
        logger.info(f"  {action} → {affected}행 영향, 총 {len(team_list)}개 팀")
    finally:
        conn.close()


if __name__ == '__main__':
    main()
