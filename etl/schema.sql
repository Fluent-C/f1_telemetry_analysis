-- ============================================================
-- F1 Telemetry Analytics — DB Schema
-- MySQL 8.0 / Phase 1
--
-- 적재 순서 (FK 의존성):
--   1. sessions
--   2. teams
--   3. drivers  (FK → sessions)
--   4. laps     (FK → sessions)
--   5. telemetry (파티셔닝, FK 없음)
--   6. weather   (파티셔닝, FK 없음)
--   7. etl_progress
--
-- [주의] telemetry, weather 는 파티셔닝된 테이블이라
--        MySQL 8.0에서 FK를 가질 수 없음.
--        session_id 무결성은 ETL 적재 순서로 보장한다.
-- ============================================================

-- 기존 테이블 제거 (재실행 안전, FK 역순 삭제)
DROP TABLE IF EXISTS etl_progress;
DROP TABLE IF EXISTS weather;
DROP TABLE IF EXISTS telemetry;
DROP TABLE IF EXISTS laps;
DROP TABLE IF EXISTS drivers;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS sessions;

-- ============================================================
-- 1. sessions
-- ============================================================
CREATE TABLE sessions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    season        SMALLINT     NOT NULL,
    round         TINYINT      NOT NULL,
    event_name    VARCHAR(100) NOT NULL,
    circuit_key   VARCHAR(50)  NOT NULL,
    -- 컨벤션: event_name 소문자+언더스코어
    -- 예) 'Bahrain Grand Prix' → 'bahrain_grand_prix'
    -- Phase 2에서 circuits 테이블 추가 시 FK로 참조됨
    session_type  VARCHAR(10)  NOT NULL,
    -- 'R','Q','SQ','S','FP1','FP2','FP3'
    -- ENUM 대신 VARCHAR: 미래 포맷 변경 대응
    session_date  DATE,
    UNIQUE KEY uq_session (season, round, session_type),
    INDEX idx_season_round (season, round)
);

-- ============================================================
-- 2. teams — 시즌별 팀 색상 관리
-- ============================================================
CREATE TABLE teams (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    team_name   VARCHAR(100) NOT NULL,
    season      SMALLINT     NOT NULL,
    team_color  CHAR(6)      NOT NULL,
    -- hex 색상 코드, '#' 없이 저장: 예) '3671C6'
    UNIQUE KEY uq_team_season (team_name, season)
);

-- ============================================================
-- 3. drivers — 세션별 참가자
--    team_color 없음: teams 테이블과 (team_name, season) 조인
-- ============================================================
CREATE TABLE drivers (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    session_id    INT          NOT NULL,
    driver_code   CHAR(3)      NOT NULL,
    full_name     VARCHAR(100),
    team_name     VARCHAR(100),
    car_number    SMALLINT,
    UNIQUE KEY uq_session_driver (session_id, driver_code),
    INDEX idx_session_driver (session_id, driver_code),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- ============================================================
-- 4. laps
--    [주의] INSERT IGNORE 금지 (FK 있음)
--    → ON DUPLICATE KEY UPDATE 사용할 것
-- ============================================================
CREATE TABLE laps (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    session_id       INT         NOT NULL,
    driver_code      CHAR(3)     NOT NULL,
    lap_number       TINYINT     NOT NULL,
    lap_time_ms      INT,
    compound         VARCHAR(20),
    -- 'SOFT','MEDIUM','HARD','INTERMEDIATE','WET','UNKNOWN','TEST_UNKNOWN'
    -- VARCHAR(20): INTERMEDIATE(12자), TEST_UNKNOWN(12자) 대응
    tyre_life        TINYINT,
    is_personal_best BOOLEAN DEFAULT FALSE,
    deleted          BOOLEAN DEFAULT FALSE,
    UNIQUE KEY uq_lap (session_id, driver_code, lap_number),
    INDEX idx_session_driver_lap (session_id, driver_code, lap_number),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- ============================================================
-- 5. telemetry — 핵심 테이블
--    FastF1 기준 약 18~20Hz 샘플링 → 랩당 약 1,200~1,800 rows
--
--    time_ms         : 랩 시작 기준 경과 시간(ms) → 차트 X축용
--    session_time_ms : 세션 시작 기준 경과 시간(ms) → weather 조인용
--
--    두 기준을 혼동하면 Phase 3 날씨 조인 결과가 완전히 틀림.
--    FastF1 소스: Time → time_ms, SessionTime → session_time_ms
--
--    FK 없음: 파티셔닝 테이블은 MySQL 8.0에서 FK 불가
--    복합 PK = 유니크 제약 + 파티셔닝 키 요건 충족
-- ============================================================
CREATE TABLE telemetry (
    season            SMALLINT NOT NULL,
    -- 파티셔닝 키 (sessions.season 비정규화)
    session_id        INT      NOT NULL,
    driver_code       CHAR(3)  NOT NULL,
    lap_number        TINYINT  NOT NULL,
    time_ms           INT      NOT NULL,
    session_time_ms   INT      NOT NULL,
    speed             FLOAT,
    throttle          FLOAT,
    brake             BOOLEAN,
    gear              TINYINT,
    rpm               SMALLINT,
    drs               TINYINT,
    x                 FLOAT,
    y                 FLOAT,
    PRIMARY KEY (season, session_id, driver_code, lap_number, time_ms),
    INDEX idx_tel_lookup (session_id, driver_code, lap_number)
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

-- ============================================================
-- 6. weather — 날씨 데이터
--    time_ms: 세션 시작 기준 — telemetry.session_time_ms 와 조인
--    FK 없음: 파티셔닝 테이블 MySQL 제약
-- ============================================================
CREATE TABLE weather (
    season        SMALLINT NOT NULL,
    session_id    INT      NOT NULL,
    time_ms       INT      NOT NULL,
    air_temp      FLOAT,
    track_temp    FLOAT,
    humidity      FLOAT,
    rainfall      BOOLEAN,
    wind_speed    FLOAT,
    wind_dir      SMALLINT,
    PRIMARY KEY (season, session_id, time_ms)
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

-- ============================================================
-- 7. etl_progress — ETL 체크포인트
-- ============================================================
CREATE TABLE etl_progress (
    season        SMALLINT    NOT NULL,
    round         TINYINT     NOT NULL,
    session_type  VARCHAR(10) NOT NULL,
    status        ENUM('pending','running','done','failed') DEFAULT 'pending',
    telemetry_rows INT,
    weather_rows   INT,
    started_at    DATETIME,
    completed_at  DATETIME,
    error_msg     TEXT,
    PRIMARY KEY (season, round, session_type)
);
