# Phase 1: F1 텔레메트리 분석 플랫폼 — 로컬 MVP 구축 계획서

> **MVP (Minimum Viable Product):** 핵심 기능만 갖춘 초기 작동 버전.
> 이 문서에서는 "로컬에서 실제 F1 텔레메트리 데이터를 조회하고 차트로 비교할 수 있는 첫 번째 완전한 동작 버전"을 MVP로 정의한다.
>
> **Source of Truth:** 이 문서는 Phase 1 구현의 유일한 기준점이다.
> 코드 작성 전 반드시 해당 섹션을 먼저 확인하고, 문서와 코드가 일치하지 않으면 이 문서를 기준으로 한다.

---

## 기술 스택 확정

| 레이어 | 기술 | 버전 | 비고 |
|--------|------|------|------|
| 데이터 수집/ETL | Python, FastF1, pandas, numpy | Python 3.11+ | 로컬 데스크탑에서 실행 |
| 데이터베이스 | MySQL | **8.0** (Docker) | 아래 선택 이유 참고 |
| 백엔드 API | FastAPI, SQLAlchemy async, uvicorn | - | Python 3.11+ |
| 프론트엔드 | React + TypeScript, Vite | React 18 | |
| 서버 상태 관리 | TanStack Query (React Query) | **v5** | API 응답 캐싱, 로딩/에러 상태 자동 처리 |
| 차트 | ECharts (`echarts-for-react`) | - | Canvas 렌더링, 크로스헤어 동기화 내장 |
| 컨테이너 | Docker Desktop for Windows | - | MySQL 컨테이너화 |

### MySQL 8.0 선택 이유

| 이유 | 설명 |
|------|------|
| **윈도우 함수 지원** | `LAG()`, `LEAD()`, `ROW_NUMBER()` 등이 8.0부터 추가됨 |
| **CTE (WITH 절)** | 복잡한 분석 쿼리를 가독성 있게 작성 가능 |
| **파티셔닝 성능** | 8.0에서 파티션 프루닝 최적화 강화 |
| **MySQL 5.7 EOL** | 2023년 10월 공식 지원 종료 |
| **클라우드 호환** | AWS RDS, GCP Cloud SQL 기본 버전이 8.0 |

### ECharts 선택 이유
Canvas 렌더링으로 랩당 ~1,500 데이터 포인트 × 복수 드라이버도 60fps 유지.
크로스헤어(`axisPointer`) 그룹 연동이 내장되어 Speed/Throttle/Brake/Gear 4개 차트의 동기화를 별도 구현 없이 사용 가능.

### TanStack Query 선택 이유
- `useQuery` 훅 하나로 로딩/에러/성공 상태 자동 처리 → 보일러플레이트 제거
- 동일 요청 자동 중복 제거(deduplication) 및 캐싱
- Phase 2에서 Zustand를 추가할 때 서버 상태(TanStack Query)와 클라이언트 상태(Zustand)가 명확히 분리되어 코드 수정 최소화

---

## 프로젝트 디렉토리 구조

```
f1_telemetry_analysis/
├── docker-compose.yml           # MySQL 8.0 컨테이너 정의
├── .env                         # DB 접속 정보 등 환경변수 (git 제외)
├── .env.example                 # 환경변수 템플릿
├── plan.md                      # 전체 로드맵
├── phase1_plan.md               # 이 문서
│
├── etl/                         # 데이터 수집 및 DB 적재 파이프라인
│   ├── requirements.txt
│   ├── config.py                # DB 연결 설정, 시즌/라운드 상수
│   ├── schema.sql               # 전체 테이블 DDL (etl_progress 포함)
│   ├── fetch_sessions.py        # 시즌 전체 이벤트/세션 메타데이터 수집
│   ├── fetch_telemetry.py       # 랩별 텔레메트리 수집 (핵심)
│   ├── fetch_weather.py         # 세션별 날씨 데이터 수집
│   ├── load_data.py             # 수집 데이터 → MySQL 적재 (체크포인트 + 병렬)
│   ├── load_teams.py            # 시즌별 팀 색상 초기 데이터 적재
│   └── logs/                    # ETL 실행 로그 (자동 생성)
│
├── backend/                     # FastAPI 서버
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI 앱 진입점, CORS 설정, 세션 캐시 초기화
│       ├── database.py          # SQLAlchemy async 엔진 및 세션
│       ├── models.py            # ORM 모델 (DB 테이블 매핑)
│       ├── schemas.py           # Pydantic 응답 스키마
│       └── routers/
│           ├── sessions.py      # GET /sessions, GET /sessions/{id}/laps
│           ├── drivers.py       # GET /drivers
│           └── telemetry.py     # GET /telemetry (핵심 엔드포인트)
│
└── frontend/                    # React + TypeScript 대시보드
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── main.tsx             # QueryClient 설정 및 QueryClientProvider 등록
        ├── App.tsx
        ├── api/
        │   └── f1Client.ts      # axios 기반 API 호출 함수
        ├── hooks/
        │   ├── useSessions.ts   # useQuery 기반 세션 데이터 훅
        │   ├── useDrivers.ts    # useQuery 기반 드라이버 데이터 훅
        │   └── useTelemetry.ts  # useQuery 기반 텔레메트리 데이터 훅
        ├── types/
        │   └── f1.ts            # TypeScript 인터페이스 정의
        ├── components/
        │   ├── SessionSelector.tsx
        │   ├── DriverSelector.tsx
        │   ├── LapSelector.tsx
        │   └── TelemetryChart.tsx
        └── pages/
            └── Dashboard.tsx
```

---

## 데이터베이스 스키마

### 설계 원칙

- **파티셔닝:** `telemetry`, `weather` 테이블은 `season` 기준 RANGE 파티셔닝.
  쿼리 시 `season` 조건을 포함하면 해당 파티션만 스캔하여 과거 시즌 누적 시에도 성능 유지.
- **복합 PK = 유니크 제약 + 인덱스:** `telemetry` PK `(season, session_id, driver_code, lap_number, time_ms)` 하나가 유니크 제약과 조회 인덱스를 겸한다. `INSERT IGNORE` 사용 시 재실행해도 중복 삽입 없음(멱등성 보장).
- **파티셔닝 테이블 FK 불가:** MySQL 8.0에서 파티셔닝된 테이블(`telemetry`, `weather`)에는 FK를 걸 수 없다. `session_id` 무결성은 ETL 적재 순서로 보장한다(sessions 먼저 적재 → 이후 telemetry/weather 적재).
- **팀 색상 분리:** `drivers` 테이블에서 `team_color` 제거. `teams` 테이블에서 `(team_name, season)` 기준으로 관리.
- **time_ms 두 가지 기준:** `telemetry` 테이블은 두 종류의 시간을 저장한다.
  - `time_ms`: **랩 시작 기준** → 차트 X축 렌더링에 사용
  - `session_time_ms`: **세션 시작 기준** → `weather` 테이블과 조인 시 사용
  두 기준을 혼동하면 Phase 3 AI 모델에서 날씨 조인이 의미없는 결과를 낸다.
- **circuit_key 컨벤션:** `sessions.circuit_key`는 FastF1 `session.event['EventName']`을 소문자+언더스코어로 변환한 값을 사용한다.
  예: `'Bahrain Grand Prix'` → `'bahrain_grand_prix'`
  Phase 2에서 `circuits` 테이블 추가 시 이 값을 PK로 참조하므로 Phase 1부터 일관성을 유지해야 한다.
- **신규 시즌 대응:** 매 시즌 시작 전 아래 SQL 실행 필요.
  ```sql
  ALTER TABLE telemetry ADD PARTITION p2026 VALUES LESS THAN (2027);
  ALTER TABLE weather   ADD PARTITION p2026 VALUES LESS THAN (2027);
  ```

```sql
-- =====================================================
-- 세션 정보 (레이스, 예선, FP 등)
-- =====================================================
CREATE TABLE sessions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    season        SMALLINT     NOT NULL,
    round         TINYINT      NOT NULL,
    event_name    VARCHAR(100) NOT NULL,
    circuit_key   VARCHAR(50)  NOT NULL,   -- 컨벤션: 'bahrain_grand_prix' (소문자+언더스코어)
    session_type  VARCHAR(10)  NOT NULL,   -- 'R','Q','SQ','S','FP1','FP2','FP3'
                                           -- ENUM 대신 VARCHAR: 미래 포맷 변경 대응
    session_date  DATE,
    UNIQUE KEY uq_session (season, round, session_type),
    INDEX idx_season_round (season, round)
);

-- =====================================================
-- 팀 정보 (시즌별 팀 색상 관리)
-- =====================================================
CREATE TABLE teams (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    team_name   VARCHAR(100) NOT NULL,
    season      SMALLINT     NOT NULL,
    team_color  CHAR(6)      NOT NULL,   -- hex: "3671C6"
    UNIQUE KEY uq_team_season (team_name, season)
);

-- =====================================================
-- 드라이버 정보 (세션별 참가자)
-- team_color 없음 → teams 테이블과 (team_name, season) 조인
-- =====================================================
CREATE TABLE drivers (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    session_id    INT          NOT NULL,
    driver_code   CHAR(3)      NOT NULL,
    full_name     VARCHAR(100),
    team_name     VARCHAR(100),
    car_number    SMALLINT,              -- SMALLINT: F1 번호 1~99 범위 명확히 표현
    UNIQUE KEY uq_session_driver (session_id, driver_code),
    INDEX idx_session_driver (session_id, driver_code),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- =====================================================
-- 랩 정보
-- =====================================================
CREATE TABLE laps (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    session_id       INT         NOT NULL,
    driver_code      CHAR(3)     NOT NULL,
    lap_number       TINYINT     NOT NULL,
    lap_time_ms      INT,
    compound         VARCHAR(20),        -- 'SOFT','MEDIUM','HARD','INTERMEDIATE','WET','UNKNOWN'
                                         -- VARCHAR(20): INTERMEDIATE(12자) 대응 [VARCHAR(10)→20 수정됨]
    tyre_life        TINYINT,
    is_personal_best BOOLEAN DEFAULT FALSE,
    deleted          BOOLEAN DEFAULT FALSE,
    UNIQUE KEY uq_lap (session_id, driver_code, lap_number),
    INDEX idx_session_driver_lap (session_id, driver_code, lap_number),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
    -- FK 있는 laps 테이블은 INSERT IGNORE 사용 금지.
    -- INSERT IGNORE는 FK 위반 에러도 무시하여 잘못된 데이터가 조용히 버려질 수 있음.
    -- 대신: ON DUPLICATE KEY UPDATE lap_time_ms = VALUES(lap_time_ms) 사용.
);

-- =====================================================
-- 텔레메트리 원본 데이터 (핵심 테이블)
-- FastF1 기준 약 18~20Hz 샘플링 → 랩당 약 1,200~1,800 rows
-- =====================================================
-- [중요] time_ms vs session_time_ms
--   time_ms         : 랩 시작 기준 경과 시간(ms) — 차트 X축용
--   session_time_ms : 세션 시작 기준 경과 시간(ms) — weather 테이블 조인용
--   두 기준을 혼동하면 날씨 조인 결과가 완전히 틀림.
--   FastF1 소스: Time → time_ms, SessionTime → session_time_ms
-- [중요] FK 없음 — 파티셔닝된 테이블은 MySQL 8.0에서 FK 불가
--   session_id 무결성 보장 방법: ETL에서 sessions 먼저 적재 후 telemetry 적재
-- =====================================================
CREATE TABLE telemetry (
    season            SMALLINT NOT NULL,   -- 파티셔닝 키 (sessions.season 비정규화)
    session_id        INT      NOT NULL,
    driver_code       CHAR(3)  NOT NULL,
    lap_number        TINYINT  NOT NULL,
    time_ms           INT      NOT NULL,   -- 랩 시작 기준 경과 시간(ms) [차트용]
    session_time_ms   INT      NOT NULL,   -- 세션 시작 기준 경과 시간(ms) [weather 조인용]
    speed             FLOAT,               -- km/h
    throttle          FLOAT,               -- 0.0 ~ 1.0
    brake             BOOLEAN,             -- [주의] FastF1 Brake는 bool → ETL 시 .fillna(False).astype(int) 변환 필수
                                            --        CSV 직렬화하면 'True'/'False' 문자열로 쓰여 MySQL이 이를 0으로 해석
    gear              TINYINT,             -- 1~8
    rpm               SMALLINT,
    drs               TINYINT,             -- 0, 8, 10, 12, 14
    x                 FLOAT,               -- 트랙 좌표 (미터)
    y                 FLOAT,
    PRIMARY KEY (season, session_id, driver_code, lap_number, time_ms),
    INDEX idx_tel_lookup (session_id, driver_code, lap_number)
    -- FK 없음 (파티셔닝 테이블 제약) — ETL 적재 순서로 무결성 보장
)
PARTITION BY RANGE (season) (
    PARTITION p2018 VALUES LESS THAN (2019),
    PARTITION p2019 VALUES LESS THAN (2020),
    PARTITION p2020 VALUES LESS THAN (2021),
    PARTITION p2021 VALUES LESS THAN (2022),
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- =====================================================
-- 날씨 데이터 (Phase 3 AI 모델 피처용, Phase 1에서 미리 수집)
-- FastF1: session.weather_data 에서 추출
-- =====================================================
-- [중요] time_ms 기준: 세션 시작 기준 — telemetry.session_time_ms 와 조인
-- [중요] FK 없음 — 파티셔닝 테이블 MySQL 제약. ETL 적재 순서로 무결성 보장.
-- =====================================================
CREATE TABLE weather (
    season        SMALLINT NOT NULL,
    session_id    INT      NOT NULL,
    time_ms       INT      NOT NULL,   -- 세션 시작 기준 경과 시간(ms)
    air_temp      FLOAT,               -- 섭씨
    track_temp    FLOAT,               -- 섭씨
    humidity      FLOAT,               -- %
    rainfall      BOOLEAN,
    wind_speed    FLOAT,               -- m/s
    wind_dir      SMALLINT,            -- 도(degree)
    PRIMARY KEY (season, session_id, time_ms)
    -- FK 없음 (파티셔닝 테이블 제약)
)
PARTITION BY RANGE (season) (
    PARTITION p2018 VALUES LESS THAN (2019),
    PARTITION p2019 VALUES LESS THAN (2020),
    PARTITION p2020 VALUES LESS THAN (2021),
    PARTITION p2021 VALUES LESS THAN (2022),
    PARTITION p2022 VALUES LESS THAN (2023),
    PARTITION p2023 VALUES LESS THAN (2024),
    PARTITION p2024 VALUES LESS THAN (2025),
    PARTITION p2025 VALUES LESS THAN (2026),
    PARTITION p_future VALUES LESS THAN MAXVALUE
);

-- =====================================================
-- ETL 체크포인트 (재실행 시 이어서 진행 가능)
-- =====================================================
CREATE TABLE etl_progress (
    season        SMALLINT    NOT NULL,
    round         TINYINT     NOT NULL,
    session_type  VARCHAR(10) NOT NULL,
    status        ENUM('pending','running','done','failed') DEFAULT 'pending',
    telemetry_rows INT,                -- 적재 완료된 row 수 (검증용)
    weather_rows   INT,
    started_at    DATETIME,
    completed_at  DATETIME,
    error_msg     TEXT,
    PRIMARY KEY (season, round, session_type)
);
```

**예상 데이터 규모 (2025 시즌 전체):**
- 레이스: 24라운드 × 20드라이버 × 평균 55랩 × 1,500 rows ≈ **4,000만 rows**
- 예선 포함 시 약 5,000만 rows 이상
- Phase 1에서는 레이스 세션을 우선 적재, 예선은 이후 추가

---

## ETL 파이프라인 상세

### 데이터 수집 흐름

```
FastF1 (로컬 캐시 → 공식 API 자동 호출)
    ↓
fetch_sessions.py  : 시즌 전체 이벤트/세션 메타데이터 수집 → sessions 테이블
    ↓                (circuit_key = event_name 소문자+언더스코어 변환)
fetch_telemetry.py : 세션별 모든 드라이버 랩 텔레메트리 수집 → laps + telemetry 테이블
    ↓                (Time → time_ms, SessionTime → session_time_ms 변환 포함)
fetch_weather.py   : 세션별 날씨 데이터 수집 → weather 테이블
    ↓                (Time → time_ms 변환 포함)
load_data.py       : 위 수집 결과를 MySQL에 bulk INSERT (체크포인트 + 병렬 + LOAD DATA INFILE)
    ↓
load_teams.py      : 시즌별 팀 색상 초기 등록 (수동 검토 후 실행)
```

### FastF1 핵심 사용 패턴 및 필수 변환

```python
import fastf1

fastf1.Cache.enable_cache('./fastf1_cache')

session = fastf1.get_session(2025, 1, 'R')
session.load(telemetry=True, laps=True, weather=True)

# ── 세션 메타데이터 ──────────────────────────────────
# circuit_key 컨벤션: event_name 소문자+언더스코어
circuit_key = session.event['EventName'].lower().replace(' ', '_')
# 예: 'Bahrain Grand Prix' → 'bahrain_grand_prix'

# ── 텔레메트리 ──────────────────────────────────────
ver_lap = session.laps.pick_driver('VER').pick_fastest()
tel_df = ver_lap.get_car_data().add_distance()
# tel_df 컬럼: Date, Time, SessionTime, Speed, Throttle, Brake, DRS, nGear, RPM, X, Y, Z

# [필수] 시간 컬럼 변환 (pandas Timedelta → int ms)
tel_df['time_ms'] = (tel_df['Time'].dt.total_seconds() * 1000).astype(int)
tel_df['session_time_ms'] = (tel_df['SessionTime'].dt.total_seconds() * 1000).astype(int)

# [필수] season 비정규화 추가 (telemetry 테이블에 season 컬럼 필요)
# session_id는 sessions 테이블 INSERT 후 얻은 값을 사용
tel_df['season'] = session.event['EventDate'].year   # 또는 sessions 테이블 조회값
tel_df['session_id'] = session_db_id                 # DB INSERT 후 반환된 sessions.id

# ── 날씨 데이터 ──────────────────────────────────────
weather_df = session.weather_data
# weather_df 컬럼: Time, AirTemp, Humidity, Pressure, Rainfall, TrackTemp, WindDirection, WindSpeed

# [필수] 시간 컬럼 변환 — weather의 time_ms는 세션 시작 기준
weather_df['time_ms'] = (weather_df['Time'].dt.total_seconds() * 1000).astype(int)
weather_df['season'] = session.event['EventDate'].year
weather_df['session_id'] = session_db_id
```

### 핵심 설계: 네 가지 안정성 전략

#### ① ETL 체크포인트 — 중단 후 이어서 재개

```python
# load_data.py 핵심 로직
def load_season(season: int):
    rounds = get_all_rounds(season)
    for round_num in rounds:
        status = get_etl_status(season, round_num, 'R')
        if status == 'done':
            continue  # 이미 완료된 라운드는 건너뜀

        update_etl_status(season, round_num, 'R', 'running')
        try:
            rows = load_round(season, round_num, 'R')
            update_etl_status(season, round_num, 'R', 'done', row_count=rows)
        except Exception as e:
            update_etl_status(season, round_num, 'R', 'failed', error=str(e))
            log.error(f"Round {round_num} failed: {e}")
            # 실패해도 다음 라운드 계속 진행
```

#### ② 병렬 적재 — 7950X 멀티코어 활용

```python
from multiprocessing import Pool
import pymysql
import fastf1

def load_round_worker(args):
    season, round_num, cache_dir = args

    # ── DB 연결은 반드시 워커 내부에서 독립적으로 생성 ──────────────
    # 부모 프로세스의 DB 연결 객체를 자식 프로세스에 전달하면 안 됨.
    # DB 커넥션은 소켓/파일 디스크립터를 포함하므로 fork 후 공유 시
    # 패킷 뒤섞임 또는 'MySQL has gone away' 에러가 발생함.
    conn = pymysql.connect(
        host=DB_HOST, user=DB_USER, password=DB_PASSWORD,
        database=DB_NAME, local_infile=True
    )
    try:
        # 캐시 디렉토리도 워커마다 독립 경로 사용 (파일 잠금 충돌 방지)
        fastf1.Cache.enable_cache(cache_dir)
        _do_load(conn, season, round_num)
    finally:
        conn.close()  # 반드시 종료 — 누락 시 'Too many connections' 에러 누적

if __name__ == '__main__':
    tasks = [
        (2025, r, f'./fastf1_cache/worker_{r % 8}')
        for r in range(1, 25)
        if get_etl_status(2025, r, 'R') != 'done'
    ]
    with Pool(processes=8) as pool:
        pool.map(load_round_worker, tasks)
```

> **캐시 디렉토리:** `./fastf1_cache/worker_0` ~ `./fastf1_cache/worker_7`
> 8개 디렉토리는 ETL 첫 실행 전에 미리 생성되어 있어야 합니다.

#### ③ LOAD DATA INFILE — 대용량 고속 적재 (일반 INSERT 대비 5~10배 빠름)

```python
import tempfile
import os

def bulk_insert_telemetry(df, conn):
    with tempfile.NamedTemporaryFile(
        mode='w', suffix='.csv', delete=False, encoding='utf-8'
    ) as f:
        # [필수] NaN → \N 변환: MySQL LOAD DATA의 NULL 리터럴
        # pandas 기본값(빈 문자열)을 사용하면 FLOAT 컬럼에 0이 삽입됨
        df.to_csv(f, index=False, header=False, na_rep='\\N')
        tmp_path = f.name

    # [필수] Windows 백슬래시 경로 → forward slash 변환
    # MySQL LOAD DATA에서 '\U', '\A' 등이 이스케이프 시퀀스로 해석되어 경로 오류 발생
    tmp_path = tmp_path.replace('\\', '/')

    try:
        cursor = conn.cursor()
        cursor.execute(f"""
            LOAD DATA LOCAL INFILE '{tmp_path}'
            INTO TABLE telemetry
            FIELDS TERMINATED BY ','
            LINES TERMINATED BY '\\n'
            (season, session_id, driver_code, lap_number,
             time_ms, session_time_ms,
             speed, throttle, brake, gear, rpm, drs, x, y)
        """)
        conn.commit()
    finally:
        os.unlink(tmp_path)  # 임시 파일 정리
```

> **Docker 설정 필요:** `docker-compose.yml`의 MySQL command에 `--local-infile=1` 추가.
> Python 연결 시 `pymysql.connect(..., local_infile=True)` 옵션 필수.

#### ④ 멱등성 보장 — INSERT IGNORE (telemetry/weather) vs ON DUPLICATE KEY (laps)

```python
# ── telemetry, weather: INSERT IGNORE 사용 가능 ────────────────────
# 이유: FK 없는 파티셔닝 테이블이므로 INSERT IGNORE가 무시하는 에러는
#       복합 PK 중복뿐. 다른 에러(FK 위반 등)가 발생할 수 없음.
cursor.executemany(
    """INSERT IGNORE INTO telemetry
       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
    rows  # season, session_id, driver_code, lap_number, time_ms, session_time_ms,
          # speed, throttle, brake, gear, rpm, drs, x, y (14개)
)

# ── laps: ON DUPLICATE KEY UPDATE 사용 (INSERT IGNORE 금지) ─────────
# 이유: laps 테이블에는 FK(session_id → sessions.id)가 있음.
#       INSERT IGNORE는 FK 위반도 무시 → 잘못된 session_id 데이터가
#       조용히 버려져 ETL 버그를 숨김. DUPLICATE KEY 방식은 PK 중복만 처리.
cursor.executemany(
    """INSERT INTO laps
       (session_id, driver_code, lap_number, lap_time_ms, compound,
        tyre_life, is_personal_best, deleted)
       VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
       ON DUPLICATE KEY UPDATE lap_time_ms = VALUES(lap_time_ms),
                               compound    = VALUES(compound),
                               tyre_life   = VALUES(tyre_life)""",
    rows
)
```

### Teams 테이블 초기 데이터 등록 (`load_teams.py`)

FastF1에서 팀 색상을 자동 추출한 후 수동 검토를 거쳐 등록합니다.
시즌 중 팀 색상이 변경될 경우 이 테이블을 수동으로 업데이트해야 합니다.

```python
# 1단계: FastF1에서 자동 추출 (시즌 첫 라운드 적재 후 실행)
session = fastf1.get_session(2025, 1, 'R')
session.load(laps=True)
# FastF1의 TeamColor는 '#' 없이 hex 6자리로 반환됨
teams = session.laps[['Team', 'TeamColor']].drop_duplicates()
# teams 예시: [('Red Bull Racing', '3671C6'), ('Mercedes', '27F4D2'), ...]

# 2단계: 추출된 색상을 확인 후 INSERT IGNORE로 등록
# (이미 등록된 팀은 건너뜀)
```

### ETL 실행 순서

```bash
cd etl/
pip install -r requirements.txt

# 0. FastF1 캐시 워커 디렉토리 사전 생성 (병렬 적재용)
mkdir -p fastf1_cache/worker_{0..7}

# 1. DB 스키마 생성
mysql -h 127.0.0.1 -P 3306 -u f1user -pf1pass f1db < schema.sql

# 2. 2025 Round 1 단일 테스트 적재 (전체 적재 전 검증)
python load_data.py --season 2025 --round 1

# 3. 팀 색상 등록 (Round 1 적재 완료 후, 수동 검토 후 실행)
python load_teams.py --season 2025

# 4. 전체 시즌 병렬 적재 (백그라운드 실행 권장, 수 시간 소요)
python load_data.py --season 2025 --all-rounds --workers 8
```

---

## FastAPI 백엔드 — API 설계

| Method | Path | 설명 |
|--------|------|------|
| GET | `/sessions` | `?season=2025` 시즌별 세션 목록 |
| GET | `/sessions/{session_id}/laps` | 세션 내 드라이버별 랩 목록 |
| GET | `/drivers` | `?session_id=5` 세션 참가 드라이버 + 팀 색상 조인 |
| GET | `/telemetry` | 드라이버×랩 텔레메트리 비교 데이터 (핵심) |

### 앱 시작 시 세션 캐시 초기화 (`main.py`)

`/telemetry` 엔드포인트는 파티션 프루닝을 위해 `season` 값이 필요하지만, API 파라미터에는 `session_id`만 있습니다. 매 요청마다 `sessions` 테이블을 추가 조회하는 오버헤드를 없애기 위해 앱 시작 시 딕셔너리를 메모리에 로드합니다.

```python
# backend/app/main.py
from fastapi import FastAPI

app = FastAPI()
# session_id → season 매핑 (앱 메모리에 상주)
# sessions 수는 최대 수백 개이므로 메모리 부담 없음
session_season_cache: dict[int, int] = {}

@app.on_event("startup")
async def load_session_cache():
    """앱 시작 시 모든 session_id → season 매핑을 메모리에 로드."""
    async with get_db() as db:
        rows = await db.fetch_all("SELECT id, season FROM sessions")
        session_season_cache.update({r['id']: r['season'] for r in rows})

# 새 세션 적재 후 캐시 갱신이 필요하면:
# session_season_cache[new_session_id] = new_season
```

### `/drivers` 쿼리 — 팀 색상 조인

```sql
SELECT d.driver_code, d.full_name, d.team_name, d.car_number,
       COALESCE(t.team_color, 'FFFFFF') AS team_color
FROM drivers d
JOIN sessions s ON d.session_id = s.id
LEFT JOIN teams t ON d.team_name = t.team_name AND s.season = t.season
WHERE d.session_id = :session_id;
-- COALESCE: teams 테이블에 해당 팀+시즌이 없을 때 흰색 폴백
```

### `/telemetry` 요청/응답 예시

```
GET /telemetry?session_id=5&drivers=VER,HAM&laps=10,10
```

> **백엔드 처리 순서:**
> 1. `session_season_cache[5]` → `season = 2025` (추가 DB 쿼리 없음)
> 2. `WHERE season=2025 AND session_id=5 AND driver_code=... AND lap_number=...`
> 3. `season` 조건이 포함되어야 RANGE 파티션 프루닝이 동작하여 성능 최대화

```json
{
  "session_id": 5,
  "comparisons": [
    {
      "driver_code": "VER",
      "team_color": "3671C6",
      "lap_number": 10,
      "data": {
        "time_ms":  [0, 55, 110, 165],
        "speed":    [0.0, 45.2, 98.7, 142.1],
        "throttle": [0.0, 0.5, 1.0, 1.0],
        "brake":    [false, false, true, false],
        "gear":     [1, 2, 4, 5],
        "rpm":      [8000, 9500, 11500, 12000]
      }
    }
  ]
}
```

---

## React 프론트엔드 — 대시보드 레이아웃

```
┌──────────────────────────────────────────────────────────┐
│  F1 Telemetry Analytics                                  │
├──────────────────────────────────────────────────────────┤
│  [2025 ▾] [Round 1: Bahrain ▾] [Race ▾]   [Load]       │
│  Driver A: [VER ▾] Lap: [퀵랩 ▾]                        │
│  Driver B: [HAM ▾] Lap: [퀵랩 ▾]                        │
├──────────────────────────────────────────────────────────┤
│  Speed (km/h)                ━━━ VER  ─── HAM            │
│  350 ┤  ━━━━━━━━━━━━━━━━━━━━━━━━━                       │
│  200 ┤    ─────────────────────────                      │
│      └──────────────────────────────► Lap Time (ms)     │
├──────────────────────────────────────────────────────────┤
│  Throttle (%)                                            │
├──────────────────────────────────────────────────────────┤
│  Brake                                                   │
├──────────────────────────────────────────────────────────┤
│  Gear                                                    │
└──────────────────────────────────────────────────────────┘
  ↑ 마우스 호버 시 4개 차트 동시에 같은 시간 지점에 크로스헤어 표시
```

### TanStack Query 설정

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5분: 같은 쿼리 재요청 방지
      retry: 2,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
```

```tsx
// src/hooks/useTelemetry.ts
import { useQuery } from '@tanstack/react-query'
import { fetchTelemetry } from '../api/f1Client'

export function useTelemetry(sessionId: number, drivers: string[], laps: number[]) {
  return useQuery({
    queryKey: ['telemetry', sessionId, drivers, laps],
    queryFn: () => fetchTelemetry(sessionId, drivers, laps),
    enabled: drivers.length > 0 && laps.length > 0,
  })
}
```

### 크로스헤어 동기화와 상태 관리 경계

크로스헤어의 현재 `time_ms` 위치는 **서버 데이터가 아닌 UI 인터랙션 상태**입니다.
TanStack Query가 아닌 ECharts 내장 `axisPointer` 그룹으로 처리합니다.

```tsx
// TelemetryChart.tsx — ECharts 크로스헤어 그룹 설정 (4개 차트 동기화)
const option = {
  axisPointer: {
    link: [{ xAxisIndex: 'all' }],  // 모든 차트의 X축을 하나로 연결
  },
  // ...
}
```

### ⚠️ ECharts + React 18 Strict Mode 주의사항

React 18 Strict Mode는 개발 환경에서 컴포넌트를 **마운트 → 언마운트 → 재마운트** 순서로 두 번 실행합니다. `echarts-for-react`의 `<ReactECharts>` 컴포넌트 자체는 이를 처리하지만, `useRef`로 ECharts 인스턴스를 직접 가져와서 `useEffect` 안에서 이벤트를 등록할 경우 리스너가 두 번 등록되어 크로스헤어 이벤트가 두 번 발생하거나 메모리 누수가 생깁니다.

**안전한 방법: `onEvents` prop 사용 (라이브러리가 cleanup 자동 처리)**

```tsx
// 권장: echarts-for-react의 onEvents prop으로 이벤트 등록
<ReactECharts
  option={option}
  onEvents={{
    'mousemove': handleMouseMove,  // cleanup 자동 처리됨
  }}
/>

// 금지: useEffect 안에서 직접 이벤트 등록 (cleanup 누락 시 문제)
// useEffect(() => {
//   chartRef.current.getEchartsInstance().on('mousemove', handler)
//   // cleanup 없으면 Strict Mode에서 두 번 등록됨
// }, [])
```

만약 `useEffect`로 직접 조작이 불가피한 경우:

```tsx
useEffect(() => {
  const chart = chartRef.current?.getEchartsInstance()
  chart?.on('mousemove', handleMouseMove)
  return () => {
    chart?.off('mousemove', handleMouseMove)  // cleanup 반드시 포함
  }
}, [])
```

### 설치 패키지

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install axios @tanstack/react-query echarts echarts-for-react
# 개발 도구 (선택, 쿼리 상태 디버깅에 유용)
npm install -D @tanstack/react-query-devtools
```

> **@tanstack/react-query-devtools:** 개발 환경에서 QueryClient 상태, 캐시 히트/미스,
> 쿼리 타이밍 등을 시각화. 프로덕션 빌드에는 포함되지 않음.

### 향후 Zustand 도입 시 마이그레이션 가이드

```
현재 (Phase 1)                          Zustand 도입 후
─────────────────────────────────────   ──────────────────────────────────
TanStack Query: 서버 상태 (변경 없음)   TanStack Query: 서버 상태 (변경 없음)
React useState: selectedSessionId       Zustand store: selectedSessionId
React useState: selectedDrivers         Zustand store: selectedDrivers
React useState: selectedLaps            Zustand store: selectedLaps
ECharts 내부: hover time_ms (변경 없음) ECharts 내부: hover time_ms (변경 없음)
```

**규칙:** Zustand store 안에서 `useQuery` 훅을 절대 호출하지 않는다.
데이터 페칭은 컴포넌트 레벨에서만 수행한다.
prop drilling이 3단계 이상 발생하는 시점이 Zustand 도입 신호다.

---

## 개발 단계별 체크리스트

### Step 1: 개발 환경 세팅
- [x] Docker Desktop 설치 확인 (`docker --version`)
- [x] `docker-compose.yml` 작성 (MySQL 8.0, `--local-infile=1`, `--max_connections=200` 포함)
- [x] `docker-compose up -d` 실행 및 MySQL 접속 확인
- [x] Python 3.11+ 가상환경 생성 (`etl/`, `backend/` 각각)
- [x] React 프로젝트 초기화 + 패키지 설치
- [x] FastF1 캐시 워커 디렉토리 사전 생성 (`fastf1_cache/worker_0` ~ `worker_15`)

### Step 2: DB 스키마 구성
- [x] `etl/schema.sql` 작성 (sessions, teams, drivers, laps, telemetry, weather, etl_progress)
- [x] Docker MySQL에 스키마 적용 확인
- [x] `SHOW CREATE TABLE telemetry` 로 RANGE 파티셔닝 적용 확인
- [x] `SHOW CREATE TABLE telemetry` 에서 `session_time_ms` 컬럼 존재 확인
- [x] `SHOW CREATE TABLE weather` 에서 FK 없이 파티셔닝만 적용됐는지 확인

### Step 3: ETL — 소규모 테스트 (2025 Round 1)
- [x] `fetch_sessions.py`: 2025 Round 1 메타데이터 수집, circuit_key 컨벤션 확인
- [x] `fetch_telemetry.py`: VER 최빠른 랩 수집, `time_ms`/`session_time_ms` 변환 확인
- [x] `fetch_weather.py`: Round 1 날씨 수집, `time_ms` Timedelta→ms 변환 확인
- [x] `load_data.py`: INSERT IGNORE 멱등성 테스트 (같은 데이터 2회 적재 → row count 동일 확인)
- [x] `load_data.py`: etl_progress 체크포인트 동작 확인 (중단 후 재개 테스트)
- [x] `load_data.py`: LOAD DATA LOCAL INFILE 동작 확인
- [x] `load_teams.py`: 팀 색상 추출 및 수동 검토 후 teams 테이블 등록
- [x] Round 1 전체 적재 완료 (20 드라이버 × ~55랩)

### Step 4: FastAPI 백엔드 구현
- [x] `database.py`: SQLAlchemy async + aiomysql 연결 풀 구성
- [x] `models.py`: 4개 테이블 ORM 모델 정의 (telemetry에 `session_time_ms` 포함)
- [x] `main.py`: 앱 시작 시 `session_season_cache` 로드 로직 구현
- [x] `/sessions`, `/drivers` (팀 색상 조인 포함), `/laps` 엔드포인트 구현
- [x] `/telemetry`: `session_season_cache` 사용하여 season 추출 → WHERE 조건에 포함
- [x] CORS 설정 (`http://localhost:5173` 허용)
- [x] Swagger UI(`http://localhost:8000/docs`) 전체 엔드포인트 동작 확인
- [x] `EXPLAIN PARTITIONS` 로 `/telemetry` 쿼리가 단일 파티션만 스캔하는지 확인

### Step 5: React 프론트엔드 구현
- [x] `main.tsx`: QueryClient + QueryClientProvider + React.StrictMode 설정
- [x] `f1Client.ts`: axios 인스턴스 및 API 호출 함수
- [x] `f1.ts`: TypeScript 인터페이스 (Session, Driver, TelemetryData 등)
- [x] `hooks/useSessions.ts`, `useDrivers.ts`, `useTelemetry.ts`: useQuery 훅 구현
- [x] `SessionSelector`, `DriverLapSelector` 컴포넌트 구현 (DriverSelector+LapSelector 통합 형태)
- [x] `TelemetryChart.tsx`: ECharts 4-panel + axisPointer 그룹 크로스헤어 구현
  - ECharts 이벤트는 `onEvents` prop으로 등록 (Strict Mode 안전)
- [x] `App.tsx`: 전체 레이아웃 조립
- [x] 브라우저에서 실제 차트 렌더링 확인 (ALB vs NOR, 2025 Australian GP 퀵랩 비교)

### Step 5b: TelemetryChart 버그 수정 ✅
- [x] 기어 Y축 0~1로 고정 문제 → `interval:1`, `min:1`, `max:8` 설정
- [x] 브레이크 라인 렌더링 안 됨 → `step:'end'` + `areaStyle` 추가

### Step 5c: 브레이크 ETL 버그 수정 ✅
- [x] FastF1 Brake(bool) → CSV 'True'/'False' → MySQL이 모두 0으로 해석하는 버그 발견
- [x] `fetch_telemetry.py`에서 `.fillna(False).astype(int)` 변환 추가
- [x] 2025 R1 telemetry 삭제 후 재적재 완료 (1,329,287 rows, brake_true=447,385 검증)

### Step 6: 통합 테스트 ✅ 완료
- [x] 프론트 → 백엔드 → DB 전체 데이터 흐름 확인
- [x] 다양한 세션(FP1~R)/드라이버 조합 차트 확인 (호주 GP VER vs NOR 확인)
- [x] 크로스헤어 4개 차트 동기화 동작 확인
- [x] ETL 재실행 시 중복 데이터 미생성 확인 (force 재실행 후 row 변동 없음)
- [x] 응답 시간 확인: `/telemetry` < 200ms (단일 드라이버 기준, 로컬 테스트 약 47ms 달성)
- [x] 엣지 케이스: 삭제된 랩, 데이터 없는 드라이버/랩 처리 검증

### Step 7: 전체 시즌 데이터 병렬 적재 ✅ 완료
- [x] `load_data.py --season 2025 --all-rounds --workers 16` 실행
- [x] 모든 라운드 `etl_progress.status = 'done'` 확인 (108개 완료, 12개 스프린트 이슈 제외)
- [x] 전체 적재 후 telemetry row count 검증 (29,731,482 rows)
- [x] weather row count 검증 (11,094 rows)
- [x] `EXPLAIN PARTITIONS` 재확인 (데이터 대용량 적재 후 파티션 프루닝 유효성)

### Step 7b: 스프린트 이벤트 누락 핫픽스 ✅ 완료
- [x] 버그 원인 파악: 2024~25년 FastF1 스프린트 이벤트 포맷이 `sprint_qualifying`으로 변경됨
- [x] `etl/fetch_sessions.py` 매핑 규칙 업데이트, 오작동 FP2/FP3 세션 DB 삭제
- [x] 누락된 12개 스프린트 세션(SQ, S) ETL 멱등성 재실행 및 UI 노출 확인

### Step 8: Phase 2 연장 - 3D/2D 트랙 맵 및 실시간 텔레메트리 연동 UI 구축 ✅ 완료
- [x] DB 모델 `models.py`에 Z축 필드 추가 및 Live DB ALTER TABLE 처리
- [x] `fetch_telemetry.py` 로직에서 `get_telemetry()`를 사용하여 X, Y, Z 데이터를 모두 받아오도록 수정
- [x] 전체 시즌 데이터를 다시 한 번 `--force`로 재적재하여 NULL이었던 공간 좌표 생성
- [x] 2D 위에서 내려다보는 일반 뷰(Top-down)와 Z축 과장 지원 3D 뷰 토글 지원 `TrackMap.tsx` 컴포넌트 개발
- [x] `TelemetryChart` 마우스 호버 스크롤과 트랙맵 상의 드라이버 팀 컬러 위치 동기화

### Step 8b: TrackMap UI 고도화 ✅ 완료 (2026-04-07)
- [x] 3D/2D 뷰를 토글 대신 **2컬럼 동시 표시**로 전환 (`flex` 레이아웃)
- [x] 3D 트랙 컬러링을 속도 기반 → **고도(Z값) 기반 그라디언트**로 교체 (`ELEV_COLORS`: 파랑→초록→노랑→주황→빨강)
- [x] ECharts `visualMap` 범례 숨기고 **HTML 그라디언트 바** 커스텀 범례로 대체 (기존 세로 길쭉 레이아웃 문제 해결)
- [x] 컨트롤 바에 카메라 슬라이더 4개 추가: Z Scale, Angle(alpha 5-85°), Rotation(beta -180~180°), Zoom(distance 80-400)
- [x] 두 드라이버 위치 항상 표시 (hoverTimeMs null이어도 랩 중간 지점 기본 표시)
- [x] 드라이버 두 명 선택 시 **화면 블랭크 버그 수정**: `useRef+useEffect`→`inst.setOption({series:[null,...]})` 방식이 echarts-gl에서 크래시 유발. activePoints3D를 option3D useMemo에 직접 포함하는 방식으로 교체
- [x] `TelemetryChart` 툴팁에서 두 드라이버 데이터 항상 표시 (ECharts params 의존 → time_ms 이진탐색 독립 조회)

---

## 환경변수 (`.env`)

```env
# Database
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=f1db
DB_USER=f1user
DB_PASSWORD=your_password_here

# FastF1
FASTF1_CACHE_DIR=./fastf1_cache

# Backend
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:5173

# ETL
ETL_WORKERS=8
ETL_MAX_RETRIES=3
```

---

## Docker Compose 필수 설정

```yaml
# docker-compose.yml
services:
  mysql:
    image: mysql:8.0
    command: >
      --local-infile=1
      --max_connections=200
    # --local-infile=1  : LOAD DATA LOCAL INFILE 허용 (기본 비활성화)
    # --max_connections : 병렬 ETL(8 workers) + 백엔드 연결 풀 수용
    #                     기본값 151 → 200으로 상향
    environment:
      MYSQL_DATABASE: f1db
      MYSQL_USER: f1user
      MYSQL_PASSWORD: your_password_here
      MYSQL_ROOT_PASSWORD: root_password_here
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

---

## 미결 사항 (Phase 1 진행 중 결정)

| 항목 | 내용 | 결정 시점 |
|------|------|----------|
| 공력 역산 알고리즘 구현 위치 | ETL 전처리 vs API 실시간 계산 | Step 3 완료 후 |
| 텔레메트리 다운샘플링 | 전체 포인트 전송 vs 줌 레벨 기반 동적 샘플링 | Step 5 차트 성능 확인 후 |
| 예선 데이터 포함 여부 | 레이스 완료 후 Q1/Q2/Q3 추가 적재 | Step 7 완료 후 |

---

## Phase 1.5: 배포 전 기능 확장 (Step 9–11)

> **이 섹션은 Phase 2(배포) 전에 반드시 완료해야 할 기능 확장 로드맵입니다.**
> Antigravity 또는 Claude Code 어느 쪽이 작업하더라도 아래 순서대로 진행하십시오.
> 각 Step 착수 전 CLAUDE.md의 `현재 진행 중인 작업` 섹션을 먼저 채우십시오.

### 진행 현황

```
✅ Step 9  Option A — 랩 데이터 확장 (섹터 타임, 스피드 트랩, 타이어 전략)  커밋: 7140662
✅ Step 8b — TrackMap UI 고도화 (3D/2D 동시표시, 고도 컬러링, 슬라이더, 블랭크 버그 수정)  커밋: 이번 세션
🔲 Step 10 Option B — 레이스 결과 화면 (결과 테이블, 포지션 차트, 갭 차트)
🔲 Step 11 Option C — 트랙 맵 고도화 (서킷 코너 오버레이, 레이스 컨트롤 메시지)
```

### Step 9 완료 내역 (2026-04-05, 커밋 `7140662`)

| 파일 | 변경 내용 |
|------|----------|
| DB `laps` 테이블 | 12개 컬럼 ALTER 추가 (`sector1/2/3_ms`, `speed_i1/i2/fl/st`, `fresh_tyre`, `stint`, `pit_in/out_ms`, `position`) |
| `etl/fetch_telemetry.py` | `fetch_laps()` 12개 컬럼 수집 (`_td_to_ms_val`, `_int_or_none`, `_float_or_none` 헬퍼 신설) |
| `etl/load_data.py` | `upsert_laps()` INSERT/UPDATE SQL 20개 컬럼으로 확장 |
| `backend/app/models.py` | `Lap` ORM 모델 12개 컬럼 추가 |
| `backend/app/schemas.py` | `LapOut` Pydantic 스키마 12개 필드 추가 |
| `frontend/src/types/f1.ts` | `Lap` 인터페이스 12개 필드 추가 |
| `frontend/src/api/f1Client.ts` | `fetchAllLaps()` 신설 (드라이버 필터 없이 세션 전체 랩) |
| `frontend/src/components/SectorDeltaChart.tsx` | **신규**: 섹터 델타 막대 차트 + 스피드 트랩 툴팁 |
| `frontend/src/components/TyreStrategyChart.tsx` | **신규**: 컴파운드별 스틴트 타임라인 (간트 형태) |
| `frontend/src/App.tsx` | TyreStrategyChart(세션 선택 시), SectorDeltaChart(랩 선택 시) 통합 |

> ⚠️ **재적재 필요**: 기존 laps 데이터의 신규 컬럼은 모두 NULL. SectorDeltaChart 동작을 위해 아래 명령 실행:
> ```bash
> cd etl && venv/Scripts/activate
> python load_data.py --season 2025 --all-rounds --workers 16 --force
> ```

---

### Step 9: Option A — 랩 데이터 확장

**목표:** 현재 텔레메트리 비교에 "왜 이 랩이 빨랐는가"를 설명하는 계층을 추가한다.
섹터별 델타 차트와 타이어 스틴트 타임라인을 신설한다.

#### 9-1. DB 스키마 변경

`etl/schema.sql`의 `laps` 테이블 정의에 아래 컬럼을 추가하고,
**실제 MySQL에는 ALTER TABLE로 반영**한다.

```sql
-- ① schema.sql laps 테이블 수정 (ADD COLUMN 위치 참고용)
ALTER TABLE laps
  ADD COLUMN sector1_ms  INT      AFTER lap_time_ms,
  ADD COLUMN sector2_ms  INT      AFTER sector1_ms,
  ADD COLUMN sector3_ms  INT      AFTER sector2_ms,
  ADD COLUMN speed_i1    FLOAT    AFTER sector3_ms,
  ADD COLUMN speed_i2    FLOAT    AFTER speed_i1,
  ADD COLUMN speed_fl    FLOAT    AFTER speed_i2,
  ADD COLUMN speed_st    FLOAT    AFTER speed_fl,
  ADD COLUMN fresh_tyre  TINYINT  AFTER tyre_life,
  ADD COLUMN stint       TINYINT  AFTER fresh_tyre,
  ADD COLUMN pit_in_ms   INT      AFTER stint,
  ADD COLUMN pit_out_ms  INT      AFTER pit_in_ms,
  ADD COLUMN position    TINYINT  AFTER pit_out_ms;
```

```sql
-- ② telemetry 테이블 z 컬럼 (Step 8에서 ALTER로 이미 적용됨, schema.sql에만 미반영)
-- schema.sql의 telemetry 테이블 y FLOAT 다음 줄에 아래 한 줄 추가:
--   z   FLOAT,
-- 실제 DB에는 이미 존재하므로 ALTER 불필요. schema.sql 문서 정합성만 맞출 것.
```

**컬럼 설명:**

| 컬럼 | 타입 | FastF1 소스 | 설명 |
|------|------|------------|------|
| `sector1_ms` | INT | `Sector1Time` (Timedelta) | 섹터 1 소요 시간(ms) |
| `sector2_ms` | INT | `Sector2Time` (Timedelta) | 섹터 2 소요 시간(ms) |
| `sector3_ms` | INT | `Sector3Time` (Timedelta) | 섹터 3 소요 시간(ms) |
| `speed_i1` | FLOAT | `SpeedI1` | 섹터 1 스피드 트랩 [km/h] |
| `speed_i2` | FLOAT | `SpeedI2` | 섹터 2 스피드 트랩 [km/h] |
| `speed_fl` | FLOAT | `SpeedFL` | 피니시 라인 통과 속도 [km/h] |
| `speed_st` | FLOAT | `SpeedST` | 메인 직선 스피드 트랩 [km/h] |
| `fresh_tyre` | TINYINT | `FreshTyre` (bool→0/1) | 신품 타이어 여부 |
| `stint` | TINYINT | `Stint` | 스틴트 번호 |
| `pit_in_ms` | INT | `PitInTime` (Timedelta→ms) | 피트 레인 진입 시각 |
| `pit_out_ms` | INT | `PitOutTime` (Timedelta→ms) | 피트 레인 출구 시각 |
| `position` | TINYINT | `Position` | 해당 랩 완료 순위 (레이스/스프린트만) |

#### 9-2. ETL 변경 (`etl/fetch_telemetry.py`)

`fetch_laps()` 함수에서 추가 컬럼 수집:

```python
# fetch_telemetry.py — fetch_laps() 함수 내 컬럼 매핑 추가 예시
LAPS_EXTRA_COLUMNS = {
    'Sector1Time':  'sector1_ms',   # Timedelta → _timedelta_to_ms()
    'Sector2Time':  'sector2_ms',
    'Sector3Time':  'sector3_ms',
    'SpeedI1':      'speed_i1',     # float, 직접 사용
    'SpeedI2':      'speed_i2',
    'SpeedFL':      'speed_fl',
    'SpeedST':      'speed_st',
    'FreshTyre':    'fresh_tyre',   # bool → .fillna(False).astype(int)
    'Stint':        'stint',        # float → Int64 (nullable)
    'PitInTime':    'pit_in_ms',    # Timedelta → _timedelta_to_ms()
    'PitOutTime':   'pit_out_ms',
    'Position':     'position',     # float → Int64 (nullable)
}

# Timedelta 컬럼은 기존 _timedelta_to_ms() 함수 재사용:
# (td_series.dt.total_seconds() * 1000).round(0).astype('Int64')
```

**주의사항:**
- `FreshTyre` (bool): `.fillna(False).astype(int)` 변환 필수 (brake와 동일한 패턴)
- `PitInTime`, `PitOutTime`: 피트스톱 없는 랩은 NaT → `_timedelta_to_ms()` 내 NA 처리 확인
- `Stint`, `Position`: float NaN이 포함될 수 있음 → `pd.array(..., dtype='Int64')` 처리

#### 9-3. 백엔드 변경

**`backend/app/schemas.py`** — `LapOut` 스키마에 필드 추가:

```python
class LapOut(BaseModel):
    # 기존 필드...
    sector1_ms:   int | None = None
    sector2_ms:   int | None = None
    sector3_ms:   int | None = None
    speed_i1:     float | None = None
    speed_i2:     float | None = None
    speed_fl:     float | None = None
    speed_st:     float | None = None
    fresh_tyre:   int | None = None
    stint:        int | None = None
    pit_in_ms:    int | None = None
    pit_out_ms:   int | None = None
    position:     int | None = None
```

**`backend/app/routers/sessions.py`** — `GET /sessions/{id}/laps` 응답 자동 반영 (ORM 기반이면 컬럼 추가만으로 동작)

#### 9-4. 프론트엔드 신규 컴포넌트

**① `frontend/src/components/SectorDeltaChart.tsx`**

- 드라이버 A vs B 섹터별 델타 막대 차트
- X축: 섹터 1 / 섹터 2 / 섹터 3
- Y축: delta(ms) — A가 빠르면 A 색, B가 빠르면 B 색
- 데이터 소스: `/sessions/{id}/laps` 응답의 `sector1_ms`, `sector2_ms`, `sector3_ms`
- ECharts `bar` 타입, `markLine`으로 0 기준선 표시

```tsx
// Props 인터페이스 참고
interface Props {
  lapA: LapDetail   // sector1_ms, sector2_ms, sector3_ms 포함
  lapB: LapDetail
  colorA: string    // 팀 컬러 hex
  colorB: string
}
```

**② `frontend/src/components/TyreStrategyChart.tsx`**

- 드라이버별 타이어 스틴트 타임라인 (간트 차트 형태)
- X축: 랩 번호
- Y축: 드라이버 코드
- 각 스틴트를 컴파운드 색상 블록으로 표현 (Soft=빨강, Medium=노랑, Hard=흰색, 등)
- 데이터 소스: `/sessions/{id}/laps` 전체 랩 목록 (stint, compound, fresh_tyre 사용)
- ECharts `custom` 렌더러 또는 `bar` 타입 + xAxis 랩 번호

**컴파운드 색상 상수:**
```typescript
const COMPOUND_COLORS: Record<string, string> = {
  SOFT:         '#e8002d',
  MEDIUM:       '#ffd700',
  HARD:         '#f0f0f0',
  INTERMEDIATE: '#43b02a',
  WET:          '#0067ff',
  UNKNOWN:      '#888888',
  TEST_UNKNOWN: '#888888',
}
```

**③ `frontend/src/types/f1.ts` 수정**

`Lap` 인터페이스에 필드 추가:
```typescript
interface Lap {
  // 기존 필드...
  sector1_ms:  number | null
  sector2_ms:  number | null
  sector3_ms:  number | null
  speed_i1:    number | null
  speed_i2:    number | null
  speed_fl:    number | null
  speed_st:    number | null
  fresh_tyre:  number | null
  stint:       number | null
  pit_in_ms:   number | null
  pit_out_ms:  number | null
  position:    number | null
}
```

**④ `frontend/src/App.tsx` 수정**

- `SectorDeltaChart`를 TrackMap과 TelemetryChart 사이에 배치
- `TyreStrategyChart`는 세션의 모든 드라이버 랩을 불러와 표시 (useLaps hook 활용)

#### 9-5. 데이터 재적재 ✅ 완료 (2026-04-06)

`--laps-only` 플래그(load_data.py에 추가됨)로 telemetry 30M 행 생략, laps만 빠르게 갱신.
2025 시즌 120개 세션 완료 → 65,655 랩, sector1 90%, speed_st 98.8%, compound 100%.

```bash
# laps 컬럼만 갱신 (telemetry 생략 — 수 분 소요)
cd etl && venv/Scripts/activate
python load_data.py --season 2025 --all-rounds --laps-only --workers 8

# 전체 재적재가 필요한 경우 (텔레메트리 포함 — 수 시간 소요)
python load_data.py --season 2025 --all-rounds --workers 16 --force
```

---

### Step 10: Option B — 레이스 결과 화면

**목표:** 별도의 "결과" 탭을 신설하여 레이스 최종 결과, 랩별 포지션 변화, 리더 대비 갭 차트를 제공한다.

#### 10-1. DB 스키마 (새 테이블)

`etl/schema.sql` 에 아래 테이블 추가:

```sql
-- ============================================================
-- 8. session_results — 세션별 공식 결과
--    레이스, 예선(Q1/Q2/Q3), 스프린트 결과 저장
-- ============================================================
CREATE TABLE session_results (
    id                   INT AUTO_INCREMENT PRIMARY KEY,
    session_id           INT          NOT NULL,
    season               SMALLINT     NOT NULL,
    -- 파티셔닝 없는 테이블이므로 season은 참조용
    driver_code          CHAR(3)      NOT NULL,
    classified_position  TINYINT,
    -- 최종 공식 순위. DNF/DNS는 NULL
    grid_position        TINYINT,
    -- 레이스/스프린트 스타트 그리드 순위
    points               FLOAT,
    q1_ms                INT,
    -- 예선 Q1 최속 랩타임(ms). 레이스 세션은 NULL
    q2_ms                INT,
    q3_ms                INT,
    status               VARCHAR(50),
    -- 'Finished', '+1 Lap', 'Engine', 'Collision', 'DNF' 등
    UNIQUE KEY uq_result (session_id, driver_code),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

**MySQL에 적용:**
```sql
-- Docker MySQL root 접속 후 실행
-- docker exec -it f1db mysql -uroot -pf1root2025 f1db
CREATE TABLE session_results ( ... );  -- 위 DDL 전체
```

#### 10-2. ETL (새 파일: `etl/fetch_results.py`)

```python
"""
fetch_results.py
세션의 공식 결과를 FastF1 session.results DataFrame에서 수집한다.

사용법:
    from fetch_results import fetch_results
    rows = fetch_results(session)
"""
import pandas as pd
import fastf1

def _timedelta_to_ms(td_series: pd.Series) -> pd.Series:
    """Timedelta → ms (정수, nullable Int64)"""
    return (td_series.dt.total_seconds() * 1000).round(0).astype('Int64')

def fetch_results(session: fastf1.core.Session) -> list[dict]:
    """
    session.results DataFrame에서 결과 행을 추출하여 dict 리스트로 반환.
    session.load()가 호출된 상태여야 함.
    """
    results = session.results
    if results is None or results.empty:
        return []

    rows = []
    for _, row in results.iterrows():
        driver_code = str(row.get('Abbreviation', ''))[:3]
        if not driver_code:
            continue

        # Q1/Q2/Q3는 예선 세션에서만 유효
        q1_ms = _timedelta_to_ms(pd.Series([row.get('Q1')])).iloc[0]
        q2_ms = _timedelta_to_ms(pd.Series([row.get('Q2')])).iloc[0]
        q3_ms = _timedelta_to_ms(pd.Series([row.get('Q3')])).iloc[0]

        classified_pos = row.get('ClassifiedPosition')
        grid_pos       = row.get('GridPosition')
        points         = row.get('Points')
        status         = str(row.get('Status', '')) if pd.notna(row.get('Status')) else None

        rows.append({
            'driver_code':          driver_code,
            'classified_position':  int(classified_pos) if pd.notna(classified_pos) else None,
            'grid_position':        int(grid_pos) if pd.notna(grid_pos) else None,
            'points':               float(points) if pd.notna(points) else None,
            'q1_ms':                int(q1_ms) if pd.notna(q1_ms) else None,
            'q2_ms':                int(q2_ms) if pd.notna(q2_ms) else None,
            'q3_ms':                int(q3_ms) if pd.notna(q3_ms) else None,
            'status':               status,
        })
    return rows
```

**`etl/load_data.py` 수정 포인트:**

`process_one_session()` 함수 내에서 `insert_results()` 호출 추가:
```python
# load_data.py — process_one_session() 내 추가
from fetch_results import fetch_results

def insert_results(conn, session_id, season, rows):
    if not rows:
        return
    cursor = conn.cursor()
    cursor.executemany("""
        INSERT INTO session_results
            (session_id, season, driver_code, classified_position,
             grid_position, points, q1_ms, q2_ms, q3_ms, status)
        VALUES
            (%(session_id)s, %(season)s, %(driver_code)s, %(classified_position)s,
             %(grid_position)s, %(points)s, %(q1_ms)s, %(q2_ms)s, %(q3_ms)s, %(status)s)
        ON DUPLICATE KEY UPDATE
            classified_position = VALUES(classified_position),
            grid_position       = VALUES(grid_position),
            points              = VALUES(points),
            q1_ms               = VALUES(q1_ms),
            q2_ms               = VALUES(q2_ms),
            q3_ms               = VALUES(q3_ms),
            status              = VALUES(status)
    """, [{**r, 'session_id': session_id, 'season': season} for r in rows])
    conn.commit()
```

#### 10-3. 백엔드 (새 파일)

**`backend/app/schemas.py`** — 스키마 추가:
```python
class SessionResultOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    driver_code:          str
    classified_position:  int | None
    grid_position:        int | None
    points:               float | None
    q1_ms:                int | None
    q2_ms:                int | None
    q3_ms:                int | None
    status:               str | None
    # JOIN 필드 (drivers + teams)
    full_name:            str | None = None
    team_name:            str | None = None
    team_color:           str | None = None
```

**`backend/app/routers/results.py`** — 새 파일:
```python
"""
GET /results?session_id=X
해당 세션의 공식 결과를 반환한다.
classified_position 오름차순 정렬. DNF(NULL)는 마지막에 위치.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from ..database import get_db
from ..schemas import SessionResultOut

router = APIRouter(prefix='/results', tags=['results'])

@router.get('', response_model=list[SessionResultOut])
async def get_results(
    session_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    sql = text("""
        SELECT
            sr.driver_code,
            sr.classified_position,
            sr.grid_position,
            sr.points,
            sr.q1_ms, sr.q2_ms, sr.q3_ms,
            sr.status,
            d.full_name,
            d.team_name,
            COALESCE(t.team_color, 'FFFFFF') AS team_color
        FROM session_results sr
        LEFT JOIN drivers d
            ON d.session_id = sr.session_id AND d.driver_code = sr.driver_code
        LEFT JOIN sessions s ON s.id = sr.session_id
        LEFT JOIN teams t
            ON t.team_name = d.team_name AND t.season = s.season
        WHERE sr.session_id = :session_id
        ORDER BY
            sr.classified_position IS NULL,
            sr.classified_position ASC
    """)
    result = await db.execute(sql, {'session_id': session_id})
    rows = result.mappings().all()
    return [SessionResultOut(**dict(r)) for r in rows]
```

**`backend/app/main.py`** — 라우터 등록:
```python
from .routers import results
app.include_router(results.router)
```

#### 10-4. 프론트엔드 신규 컴포넌트

**① `frontend/src/api/f1Client.ts`** — API 함수 추가:
```typescript
export async function fetchResults(sessionId: number): Promise<SessionResult[]> {
  const { data } = await api.get<SessionResult[]>('/results', {
    params: { session_id: sessionId },
  })
  return data
}
```

**② `frontend/src/types/f1.ts`** — 타입 추가:
```typescript
export interface SessionResult {
  driver_code:          string
  classified_position:  number | null
  grid_position:        number | null
  points:               number | null
  q1_ms:                number | null
  q2_ms:                number | null
  q3_ms:                number | null
  status:               string | null
  full_name:            string | null
  team_name:            string | null
  team_color:           string
}
```

**③ `frontend/src/hooks/useResults.ts`** — 훅 신설:
```typescript
import { useQuery } from '@tanstack/react-query'
import { fetchResults } from '../api/f1Client'
export function useResults(sessionId: number | null) {
  return useQuery({
    queryKey: ['results', sessionId],
    queryFn:  () => fetchResults(sessionId!),
    enabled:  sessionId !== null,
  })
}
```

**④ `frontend/src/components/ResultsTable.tsx`**

| 컬럼 | 내용 |
|------|------|
| POS | classified_position (DNF는 별도 표시) |
| DRIVER | full_name + driver_code, 팀 색상 좌측 바 |
| TEAM | team_name |
| GAP | 1위 대비 누적 갭 (ms → 초.mmm 형식) |
| PTS | points |
| STATUS | Finished / +N Laps / 사유 |

**⑤ `frontend/src/components/PositionChart.tsx`**

- 레이스 랩별 포지션 변화 꺾은선 차트
- X축: 랩 번호, Y축: 포지션 (1이 위쪽, 반전)
- 데이터 소스: `/sessions/{id}/laps?all_drivers=true` (전체 드라이버 랩 필요)
- `useLaps` 훅 활용, 세션의 모든 드라이버 랩을 드라이버별로 그룹핑

**⑥ `frontend/src/components/GapChart.tsx`**

- 리더 대비 갭 변화 (누적 랩타임 차이)
- X축: 랩 번호, Y축: 리더 대비 갭(초)
- 계산: 각 랩 `lap_time_ms` 누적합 - 리더 누적합

**⑦ `frontend/src/App.tsx`** — 탭 UI 추가:

App.tsx에 탭 전환 상태를 추가하여 "텔레메트리 비교" / "레이스 결과" 탭을 구분:
```tsx
const [activeTab, setActiveTab] = useState<'telemetry' | 'results'>('telemetry')
// 탭 버튼 UI → activeTab에 따라 차트 섹션 또는 결과 섹션 렌더링
```

---

### Step 11: Option C — 트랙 맵 고도화

**목표:** 서킷 코너 번호를 TrackMap 위에 오버레이하고,
레이스 컨트롤 메시지(세이프티카, 페널티, 플래그)를 TelemetryChart 배경에 타임라인으로 표시한다.

#### 11-1. DB 스키마 (새 테이블 2개)

`etl/schema.sql` 에 추가:

```sql
-- ============================================================
-- 9. circuits — 서킷 코너 및 마샬 섹터 메타데이터
--    Session.get_circuit_info() 에서 수집
-- ============================================================
CREATE TABLE circuits (
    circuit_key     VARCHAR(50) PRIMARY KEY,
    -- FastF1 session.event['CircuitKey'] 또는 circuit_info 식별자
    rotation        FLOAT,
    -- 트랙 맵을 정확한 방위로 그리기 위한 회전각(도)
    corners         JSON,
    -- [{number: 1, letter: '', x: 123.4, y: 456.7, angle: 45.0, distance: 100.0}, ...]
    marshal_sectors JSON
    -- [{number: 1, x: ..., y: ...}, ...]
);

-- ============================================================
-- 10. race_control_messages — 레이스 컨트롤 메시지
--     Session.race_control_messages 에서 수집
-- ============================================================
CREATE TABLE race_control_messages (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    session_id  INT          NOT NULL,
    time_ms     INT          NOT NULL,
    -- 세션 시작 기준 경과 시간(ms)
    lap_number  TINYINT,
    category    VARCHAR(30),
    -- 'Flag', 'SafetyCar', 'Drs', 'TrackSupervisor', 'Other'
    message     TEXT,
    flag        VARCHAR(20),
    -- 'GREEN', 'YELLOW', 'DOUBLE YELLOW', 'RED', 'CHEQUERED',
    -- 'SAFETY CAR', 'VIRTUAL SAFETY CAR', 'CLEAR' 등
    driver_code CHAR(3),
    -- 관련 드라이버 코드 (트랙 리밋 말소 등). 없으면 NULL
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

**MySQL에 적용:**
```sql
CREATE TABLE circuits ( ... );
CREATE TABLE race_control_messages ( ... );
```

#### 11-2. ETL (새 파일 2개)

**`etl/fetch_circuit_info.py`**:

```python
"""
fetch_circuit_info.py
FastF1 session.get_circuit_info() 에서 코너 및 마샬 섹터 데이터를 수집한다.
circuit_key는 session.event['OfficialEventName'] 대신
session.event.get('CircuitKey', session.event['Location'])를 사용한다.
"""
import json
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

    circuit_key = session.event.get('Location', 'unknown')

    corners = []
    for _, row in circuit_info.corners.iterrows():
        corners.append({
            'number':   int(row['Number']),
            'letter':   str(row.get('Letter', '')),
            'x':        float(row['X']),
            'y':        float(row['Y']),
            'angle':    float(row.get('Angle', 0)),
            'distance': float(row.get('Distance', 0)),
        })

    marshal_sectors = []
    if hasattr(circuit_info, 'marshal_sectors'):
        for _, row in circuit_info.marshal_sectors.iterrows():
            marshal_sectors.append({
                'number': int(row['Number']),
                'x':      float(row['X']),
                'y':      float(row['Y']),
            })

    return {
        'circuit_key':     circuit_key,
        'rotation':        float(getattr(circuit_info, 'rotation', 0)),
        'corners':         corners,
        'marshal_sectors': marshal_sectors,
    }
```

**`etl/fetch_race_control.py`**:

```python
"""
fetch_race_control.py
FastF1 session.race_control_messages DataFrame에서 레이스 컨트롤 메시지를 수집한다.
"""
import pandas as pd
import fastf1

def fetch_race_control(session: fastf1.core.Session) -> list[dict]:
    """
    반환값: dict 리스트 (DB INSERT 용)
    session.load(messages=True) 가 호출된 상태여야 함.
    """
    try:
        msgs = session.race_control_messages
    except Exception:
        return []
    if msgs is None or msgs.empty:
        return []

    rows = []
    for _, row in msgs.iterrows():
        time_td = row.get('Time')
        time_ms = None
        if pd.notna(time_td):
            time_ms = int(round(time_td.total_seconds() * 1000))

        lap_num = row.get('Lap')
        driver  = row.get('RacingNumber') or row.get('Driver')

        rows.append({
            'time_ms':    time_ms,
            'lap_number': int(lap_num) if pd.notna(lap_num) else None,
            'category':   str(row.get('Category', ''))[:30],
            'message':    str(row.get('Message', '')),
            'flag':       str(row.get('Flag', ''))[:20] if pd.notna(row.get('Flag')) else None,
            'driver_code': str(driver)[:3] if pd.notna(driver) else None,
        })
    return rows
```

**`etl/load_data.py`** 수정 포인트:
```python
# process_one_session() 내 추가
from fetch_circuit_info import fetch_circuit_info
from fetch_race_control import fetch_race_control

# session.load() 호출 시 messages=True 추가:
session.load(telemetry=True, laps=True, weather=True, messages=True)

# 서킷 정보 적재 (라운드당 1번만 — 동일 circuit_key 중복 허용)
circuit_data = fetch_circuit_info(session)
if circuit_data:
    insert_circuit_info(conn, circuit_data)

# 레이스 컨트롤 메시지 적재
rc_rows = fetch_race_control(session)
insert_race_control(conn, session_id, rc_rows)
```

#### 11-3. 백엔드 (새 파일)

**`backend/app/routers/circuits.py`**:
```python
"""
GET /circuits/{circuit_key}
서킷 코너 및 마샬 섹터 JSON 반환.
"""
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from ..database import get_db
...

@router.get('/{circuit_key}')
async def get_circuit(circuit_key: str, db=Depends(get_db)):
    sql = text('SELECT rotation, corners, marshal_sectors FROM circuits WHERE circuit_key = :k')
    row = (await db.execute(sql, {'k': circuit_key})).mappings().first()
    if not row:
        raise HTTPException(404, 'Circuit not found')
    return dict(row)
```

**`backend/app/routers/race_control.py`**:
```python
"""
GET /race-control?session_id=X
레이스 컨트롤 메시지 반환 (time_ms 오름차순).
"""
@router.get('')
async def get_race_control(session_id: int = Query(...), db=Depends(get_db)):
    sql = text("""
        SELECT time_ms, lap_number, category, message, flag, driver_code
        FROM race_control_messages
        WHERE session_id = :session_id
        ORDER BY time_ms ASC
    """)
    rows = (await db.execute(sql, {'session_id': session_id})).mappings().all()
    return [dict(r) for r in rows]
```

**`backend/app/main.py`** — 라우터 등록:
```python
from .routers import circuits, race_control
app.include_router(circuits.router)
app.include_router(race_control.router)
```

#### 11-4. 프론트엔드 변경

**① `frontend/src/components/TrackMap.tsx` 수정**

서킷 코너 번호 오버레이 추가:
- `GET /circuits/{circuit_key}` 로 코너 데이터 수집
- 2D 모드에서 각 코너 위치에 번호 레이블 표시
- 3D 모드에서는 코너 번호 scatter3D 포인트로 표시

```tsx
// TrackMap.tsx 수정 포인트
// Props에 circuitKey 추가:
interface Props {
  comparisons:  DriverTelemetry[]
  hoverTimeMs:  number | null
  circuitKey?:  string    // 코너 오버레이용 (optional, 없으면 오버레이 생략)
}

// useQuery로 코너 데이터 로드:
const { data: circuitInfo } = useQuery({
  queryKey: ['circuit', circuitKey],
  queryFn:  () => fetchCircuit(circuitKey!),
  enabled:  !!circuitKey,
})

// 2D option의 series에 코너 레이블 scatter 추가:
{
  type: 'effectScatter',
  data: (circuitInfo?.corners ?? []).map(c => ({
    value: [c.x, c.y],
    label: { show: true, formatter: `T${c.number}`, color: '#888', fontSize: 9 }
  })),
  symbolSize: 0,
  animation: false,
}
```

**② `frontend/src/components/RaceControlTimeline.tsx`** — 새 파일

- TelemetryChart 위 또는 아래에 플래그/세이프티카 이벤트를 타임라인으로 표시
- X축: session_time_ms (TelemetryChart의 time_ms와 동기화)
- 이벤트 종류별 아이콘/색상:

| flag | 표시 색상 |
|------|----------|
| SAFETY CAR | 노랑 SC |
| VIRTUAL SAFETY CAR | 연노랑 VSC |
| YELLOW / DOUBLE YELLOW | 노랑 |
| RED | 빨강 |
| GREEN / CLEAR | 초록 |

- ECharts `markArea` 또는 별도 HTML 오버레이로 구현

**③ `frontend/src/App.tsx`** 수정

- `circuitKey`를 sessions 응답에서 추출하여 TrackMap에 전달
  ```tsx
  const session = sessions?.find(s => s.id === sessionId)
  const circuitKey = session?.circuit_key  // sessions 테이블의 circuit_key 컬럼 활용
  ```
- `RaceControlTimeline`을 TelemetryChart 위에 배치 (세션 선택 시 표시)

---

### Phase 1.5 전체 완료 기준 (Definition of Done)

```
✅ Step 9  섹터 타임 / 스피드 트랩 / 타이어 전략 차트가 로컬 브라우저에서 렌더링됨
✅ Step 10 레이스 결과 탭에서 결과 테이블 + 포지션 차트 + 갭 차트 렌더링됨
✅ Step 11 TrackMap에 코너 번호 오버레이됨, 레이스 컨트롤 타임라인 표시됨
```

### 작업 전 필수 확인

1. CLAUDE.md `현재 진행 중인 작업` 섹션이 비어 있는지 확인
2. Docker MySQL 실행 중인지 확인: `docker compose ps`
3. 각 Step 착수 전 `git pull` 로 최신 상태 동기화

---

## 다음 액션

"Step 1을 시작해줘" 라고 요청하면 `docker-compose.yml`, Python 가상환경 설정,
React 프로젝트 초기화, FastF1 캐시 디렉토리 생성을 순서대로 진행한다.
