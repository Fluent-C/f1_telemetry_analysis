# Phase 1: F1 텔레메트리 분석 플랫폼 — 로컬 MVP 구축 계획서

> **MVP (Minimum Viable Product):** 핵심 기능만 갖춘 초기 작동 버전.
> 이 문서에서는 "로컬에서 실제 F1 텔레메트리 데이터를 조회하고 차트로 비교할 수 있는 첫 번째 완전한 동작 버전"을 MVP로 정의한다.

---

## 기술 스택 확정

| 레이어 | 기술 | 버전 | 비고 |
|--------|------|------|------|
| 데이터 수집/ETL | Python, FastF1, pandas, numpy | Python 3.11+ | 로컬 데스크탑에서 실행 |
| 데이터베이스 | MySQL | **8.0** (Docker) | 아래 선택 이유 참고 |
| 백엔드 API | FastAPI, SQLAlchemy async, uvicorn | - | Python 3.11+ |
| 프론트엔드 | React + TypeScript, Vite | React 18 | |
| 차트 | ECharts (`echarts-for-react`) | - | Canvas 렌더링, 크로스헤어 동기화 내장 |
| 컨테이너 | Docker Desktop for Windows | - | MySQL 컨테이너화 |

### MySQL 8.0 선택 이유

| 이유 | 설명 |
|------|------|
| **윈도우 함수 지원** | `LAG()`, `LEAD()`, `ROW_NUMBER()` 등이 8.0부터 추가됨. 드라이버 간 랩타임 델타, 구간 순위 분석을 SQL로 처리 가능 |
| **CTE (WITH 절)** | 복잡한 분석 쿼리를 가독성 있게 작성 가능. 5.7에서는 서브쿼리 중첩으로만 해결 |
| **파티셔닝 성능** | 8.0에서 파티션 프루닝 최적화 강화 — 불필요한 파티션을 건너뛰는 효율 향상 |
| **MySQL 5.7 EOL** | 2023년 10월 공식 지원 종료. 보안 패치 없음 |
| **클라우드 호환** | AWS RDS, GCP Cloud SQL 기본 버전이 8.0. Phase 2 배포 시 버전 불일치 없음 |

### ECharts 선택 이유
Canvas 렌더링으로 랩당 ~1,500 데이터 포인트 × 복수 드라이버도 60fps 유지.
마우스 호버 시 Speed/Throttle/Brake/Gear 4개 차트가 같은 시간 지점에 동기화되는
크로스헤어(`axisPointer`)가 내장되어 있어 텔레메트리 분석의 핵심 UX를 별도 구현 없이 사용 가능.

---

## 프로젝트 디렉토리 구조

```
f1_data_analysis/
├── docker-compose.yml           # MySQL 8.0 컨테이너 정의
├── .env                         # DB 접속 정보 등 환경변수 (git 제외)
├── .env.example                 # 환경변수 템플릿
├── phase1_plan.md               # 이 문서
│
├── etl/                         # 데이터 수집 및 DB 적재 파이프라인
│   ├── requirements.txt
│   ├── config.py                # DB 연결 설정, 시즌/라운드 상수
│   ├── fetch_sessions.py        # FastF1로 세션 메타데이터 수집
│   ├── fetch_telemetry.py       # 랩별 텔레메트리 수집 (핵심)
│   ├── schema.sql               # 테이블 DDL
│   └── load_data.py             # 수집 데이터 → MySQL 적재 메인 스크립트
│
├── backend/                     # FastAPI 서버
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI 앱 진입점, CORS 설정
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
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   └── f1Client.ts      # axios 기반 API 클라이언트
        ├── types/
        │   └── f1.ts            # TypeScript 인터페이스 정의
        ├── components/
        │   ├── SessionSelector.tsx   # 시즌/라운드/세션 선택 UI
        │   ├── DriverSelector.tsx    # 비교할 드라이버 선택
        │   ├── LapSelector.tsx       # 랩 선택
        │   └── TelemetryChart.tsx    # ECharts 4-panel 텔레메트리 차트
        └── pages/
            └── Dashboard.tsx         # 메인 대시보드 페이지
```

---

## 데이터베이스 스키마

### 설계 원칙
- **파티셔닝:** `telemetry` 테이블은 `session_id` 기준 HASH 파티셔닝 (라운드별 조회 성능 확보)
- **복합 인덱스:** `(session_id, driver_code, lap_number)` 조합으로 드라이버/랩 단위 조회 최적화
- **데이터 타입:** 텔레메트리 수치는 `FLOAT`, 경과시간은 `INT` (밀리초 단위)

```sql
-- 세션 정보 (레이스, 예선, FP 등)
CREATE TABLE sessions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    season        SMALLINT NOT NULL,
    round         TINYINT  NOT NULL,
    event_name    VARCHAR(100) NOT NULL,
    circuit_key   VARCHAR(50)  NOT NULL,
    session_type  ENUM('R','Q','SQ','S','FP1','FP2','FP3') NOT NULL,
    session_date  DATE,
    INDEX idx_season_round (season, round)
);

-- 드라이버 정보 (세션별 참가자)
CREATE TABLE drivers (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    session_id    INT NOT NULL,
    driver_code   CHAR(3) NOT NULL,
    full_name     VARCHAR(100),
    team_name     VARCHAR(100),
    team_color    CHAR(6),                    -- hex: "3671C6"
    car_number    TINYINT,
    INDEX idx_session_driver (session_id, driver_code),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 랩 정보
CREATE TABLE laps (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    session_id       INT NOT NULL,
    driver_code      CHAR(3) NOT NULL,
    lap_number       TINYINT NOT NULL,
    lap_time_ms      INT,
    compound         ENUM('SOFT','MEDIUM','HARD','INTER','WET'),
    tyre_life        TINYINT,
    is_personal_best BOOLEAN DEFAULT FALSE,
    deleted          BOOLEAN DEFAULT FALSE,
    INDEX idx_session_driver_lap (session_id, driver_code, lap_number),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- 텔레메트리 원본 데이터 (핵심 테이블)
-- FastF1 기준 약 18~20Hz 샘플링 → 랩당 약 1,200~1,800 rows
CREATE TABLE telemetry (
    id            BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id    INT     NOT NULL,
    driver_code   CHAR(3) NOT NULL,
    lap_number    TINYINT NOT NULL,
    time_ms       INT     NOT NULL,           -- 랩 시작 기준 경과 시간(ms)
    speed         FLOAT,                      -- km/h
    throttle      FLOAT,                      -- 0.0 ~ 1.0
    brake         BOOLEAN,
    gear          TINYINT,                    -- 1~8
    rpm           SMALLINT,
    drs           TINYINT,                    -- 0, 8, 10, 12, 14
    x             FLOAT,                      -- 트랙 좌표 (미터)
    y             FLOAT,
    INDEX idx_tel_lookup (session_id, driver_code, lap_number)
)
PARTITION BY HASH(session_id) PARTITIONS 32;
```

**예상 데이터 규모 (2025 시즌 전체):**
- 레이스: 24라운드 × 20드라이버 × 평균 55랩 × 1,500 rows ≈ **4,000만 rows**
- 예선 포함 시 약 5,000만 rows 이상
- Phase 1에서는 레이스 세션을 우선 적재하고, 예선은 이후 추가

---

## ETL 파이프라인 상세

### 데이터 수집 흐름

```
FastF1 (로컬 캐시 → 공식 API 자동 호출)
    ↓
fetch_sessions.py: 시즌 전체 이벤트/세션 메타데이터 수집
    ↓
fetch_telemetry.py: 세션별 모든 드라이버 랩 텔레메트리 수집
    ↓  (pandas DataFrame)
load_data.py: DataFrame → MySQL bulk INSERT
```

### FastF1 핵심 사용 패턴

```python
import fastf1

fastf1.Cache.enable_cache('./fastf1_cache')  # 필수 — 재실행 시 API 재호출 방지

session = fastf1.get_session(2025, 1, 'R')  # 2025 Bahrain Race
session.load(telemetry=True, laps=True)

# 특정 드라이버 가장 빠른 랩의 텔레메트리
ver_lap = session.laps.pick_driver('VER').pick_fastest()
tel = ver_lap.get_car_data().add_distance()
# tel 컬럼: Date, Time, Speed, Throttle, Brake, DRS, nGear, RPM, X, Y, Z
```

### ETL 실행 순서

```bash
cd etl/
pip install -r requirements.txt

# 1. DB 스키마 생성
mysql -h 127.0.0.1 -P 3306 -u f1user -pf1pass f1db < schema.sql

# 2. 2025 Round 1 테스트 적재 (전체 전 소규모 검증)
python load_data.py --season 2025 --round 1

# 3. 전체 시즌 적재 (수 시간 소요, 백그라운드 실행 권장)
python load_data.py --season 2025 --all-rounds
```

---

## FastAPI 백엔드 — API 설계

| Method | Path | 설명 |
|--------|------|------|
| GET | `/sessions` | `?season=2025` 시즌별 세션 목록 |
| GET | `/sessions/{session_id}/laps` | 세션 내 드라이버별 랩 목록 |
| GET | `/drivers` | `?session_id=5` 세션 참가 드라이버 및 팀 색상 |
| GET | `/telemetry` | 드라이버×랩 텔레메트리 비교 데이터 (핵심) |

### `/telemetry` 요청/응답 예시

```
GET /telemetry?session_id=5&drivers=VER,HAM&laps=10,10
```

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
    },
    {
      "driver_code": "HAM",
      "team_color": "27F4D2",
      "lap_number": 10,
      "data": { "..." }
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
│  100 ┤ █████████   ████████████                         │
│    0 ┤         ████            █                        │
├──────────────────────────────────────────────────────────┤
│  Brake                                                   │
│   ON ┤   ██  ██   ██                                    │
│  OFF ┤ ██  ██  ███  ██████████████                      │
├──────────────────────────────────────────────────────────┤
│  Gear                                                    │
│    8 ┤        ████████████                              │
│    1 ┤ ██████                                           │
└──────────────────────────────────────────────────────────┘
  ↑ 마우스 호버 시 4개 차트 동시에 같은 시간 지점에 크로스헤어 표시
```

---

## 개발 단계별 체크리스트

### Step 1: 개발 환경 세팅
- [ ] Docker Desktop 설치 확인 (`docker --version`)
- [ ] `docker-compose.yml` 작성 (MySQL 8.0, 포트 3306, f1db 데이터베이스)
- [ ] `docker-compose up -d` 실행 및 MySQL 접속 확인
- [ ] Python 가상환경 생성 (`etl/`, `backend/` 각각)
- [ ] React 프로젝트 초기화 (`npm create vite@latest frontend -- --template react-ts`)

### Step 2: DB 스키마 구성
- [ ] `etl/schema.sql` 작성 (위 DDL 기반)
- [ ] Docker MySQL에 스키마 적용 및 연결 확인

### Step 3: ETL — 소규모 테스트 (2025 Round 1)
- [ ] FastF1 캐시 디렉토리 설정 (`./fastf1_cache`)
- [ ] `fetch_sessions.py`: 2025 Round 1 세션 메타데이터 수집 및 DB 적재
- [ ] `fetch_telemetry.py`: VER 최빠른 랩 텔레메트리 수집 단위 테스트
- [ ] `load_data.py`: DataFrame → MySQL bulk INSERT 및 성능 확인
- [ ] Round 1 전체 적재 완료 (20 드라이버 × ~55랩)

### Step 4: FastAPI 백엔드 구현
- [ ] `database.py`: SQLAlchemy async + aiomysql 연결 풀 구성
- [ ] `models.py`: 4개 테이블 ORM 모델 정의
- [ ] `/sessions`, `/drivers`, `/laps` 엔드포인트 구현
- [ ] `/telemetry` 엔드포인트 구현
- [ ] CORS 설정 (`http://localhost:5173` 허용)
- [ ] Swagger UI(`http://localhost:8000/docs`)에서 전체 엔드포인트 동작 확인

### Step 5: React 프론트엔드 구현
- [ ] `f1Client.ts`: axios 인스턴스 및 API 호출 함수
- [ ] `f1.ts`: TypeScript 인터페이스 (Session, Driver, TelemetryData 등)
- [ ] `SessionSelector`, `DriverSelector`, `LapSelector` 컴포넌트 구현
- [ ] `TelemetryChart.tsx`: ECharts 4-panel 차트 구현
- [ ] 크로스헤어 동기화 (`axisPointer` group 연결)
- [ ] `Dashboard.tsx`: 전체 레이아웃 조립

### Step 6: 통합 테스트
- [ ] 프론트 → 백엔드 → DB 전체 데이터 흐름 확인
- [ ] VER vs HAM, 2025 Bahrain GP 퀵랩 비교 차트 렌더링 확인
- [ ] 크로스헤어 4개 차트 동기화 동작 확인

### Step 7: 전체 시즌 데이터 적재
- [ ] 2025 시즌 전체 라운드 순차 적재
- [ ] 적재 후 쿼리 성능 검증 (드라이버/랩 조회 < 100ms 목표)

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
```

---

## 미결 사항 (Phase 1 진행 중 결정)

| 항목 | 내용 | 결정 시점 |
|------|------|----------|
| 공력 역산 알고리즘 구현 위치 | ETL 전처리 vs API 실시간 계산 | Step 3 완료 후 |
| 텔레메트리 다운샘플링 | 전체 포인트 전송 vs 줌 레벨 기반 동적 샘플링 | Step 5 차트 성능 확인 후 |
| 예선 데이터 포함 여부 | 레이스 완료 후 Q1/Q2/Q3 추가 적재 | Step 7 완료 후 |

---

## 다음 액션

"Step 1을 시작해줘" 라고 요청하면 `docker-compose.yml`, Python 가상환경 설정,
React 프로젝트 초기화를 순서대로 진행한다.
