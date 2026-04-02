# F1 Telemetry Analytics — 마스터 플랜

> 이 문서는 프로젝트 전체 로드맵을 정의하는 최상위 계획서입니다.
> 각 Phase의 세부 실행 계획은 별도 파일(`phase1_plan.md`, `phase2_plan.md`, ...)에서 관리합니다.

---

## 📍 현재 개발 현황 (2026-04-02 기준)

### Phase 1 진행 상태

| Step | 내용 | 상태 | 커밋 |
|------|------|------|------|
| Step 1 | 개발 환경 구성 (Docker MySQL, venv, React scaffold) | ✅ 완료 | `781a9a8` |
| Step 2 | DB 스키마 적용 (7개 테이블, RANGE 파티셔닝) | ✅ 완료 | `e535124` |
| Step 3 | ETL 파이프라인 구현 및 2025 R1 전체 적재 검증 | ✅ 완료 | `ddf8426` |
| Step 4 | FastAPI 백엔드 4개 엔드포인트 구현 및 검증 | ✅ 완료 | `1c2ab6a` |
| Step 5 | React 프론트엔드 + ECharts 4-panel 차트 | ✅ 완료 | `51b151a` |
| Step 5b | TelemetryChart 차트 버그 수정 (기어 Y축, 브레이크 렌더링) | ✅ 완료 | `51b151a` |
| Step 5c | 브레이크 ETL 버그 수정 (bool→int) + 2025 R1 재적재 | ✅ 완료 | `87a6712` |
| Step 6 | 통합 테스트 (End-to-end) | 🔲 미시작 ← 다음 작업 | — |
| Step 7 | 2025 시즌 전체 데이터 병렬 적재 | 🔲 미시작 | — |

### 적재 데이터 현황 (로컬 MySQL)

| 테이블 | rows | 비고 |
|--------|------|------|
| sessions | 5 | 2025 R1 (FP1/FP2/FP3/Q/R) |
| drivers | 99 | 세션당 20명 |
| laps | 2,549 | |
| telemetry | 1,329,287 | ~18Hz 샘플링, X/Y NULL (get_car_data 한계), brake 0/1 정상 적재 확인 |
| weather | 493 | |
| teams | 10 | 2025 시즌 팀 색상 |
| etl_progress | 5 | 전부 done |

### 현재 실행 가능한 명령어

```bash
# ETL
cd etl && venv/Scripts/activate
python load_data.py --season 2025 --round 2 --workers 4     # R2 적재
python load_teams.py --season 2025 --round 2 --update       # 팀 색상 갱신

# 백엔드
cd backend && venv/Scripts/activate
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/docs  (Swagger UI)

# 프론트엔드
cd frontend && npm run dev
# → http://localhost:5173
```

### 알려진 제약사항

| 항목 | 내용 |
|------|------|
| X/Y 좌표 | `get_car_data()`는 위치 미제공 → telemetry.x/y = NULL. Phase 3 트랙맵에서 `get_pos_data()` 병합 예정 |
| FutureWarning | FastF1 `pick_driver` → `pick_drivers` 마이그레이션 완료 |
| `compound VARCHAR(20)` | 기존 VARCHAR(10)에서 변경 (INTERMEDIATE 12자 대응) |
| 팀 색상 | `load_teams.py` 를 라운드마다 `--update` 플래그로 실행해야 최신 유지 |
| brake ETL | FastF1 Brake(bool)을 CSV 직렬화하면 MySQL이 'True'를 0으로 해석. fetch_telemetry.py에서 `.fillna(False).astype(int)` 변환 필수 (수정 완료) |

---

## 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **목표** | FastF1 로우 데이터 기반, F1 코어 팬을 위한 전문 텔레메트리 분석 웹 플랫폼 |
| **타겟 사용자** | F1 코어 팬, 팀 전략 분석에 관심 있는 시청자 |
| **수익 모델** | Phase 2: 구글 애드센스 → Phase 3: Freemium 구독 |
| **개발 방식** | AI Pair Programming (Gemini 아키텍트 + Claude Code 실행) |

---

## 전체 로드맵

```
Phase 1 (현재)          Phase 2                  Phase 3
─────────────────────   ──────────────────────   ──────────────────────
로컬 MVP 구축           퍼블릭 웹 배포            AI 고도화 + 수익화
─────────────────────   ──────────────────────   ──────────────────────
ETL 파이프라인          VPS 백엔드 배포           타이어 마모 예측 모델
MySQL 로컬 DB           Vercel 프론트엔드         구간별 전략 시뮬레이터
FastAPI REST API        도메인 + HTTPS            Freemium 구독 모델
React 대시보드          Redis 캐싱 도입           과거 시즌 데이터 누적
텔레메트리 차트         레이트 리미팅 적용        트랙 맵 시각화
날씨/팀 메타데이터 수집 서킷 메타데이터 결정      코너링 프로파일 분석
ETL 체크포인트 + 병렬화 애드센스 승인
```

---

## 기술 스택 (전체)

| 레이어 | Phase 1 | Phase 2 추가 | Phase 3 추가 |
|--------|---------|-------------|-------------|
| **ETL** | Python, FastF1, pandas, multiprocessing | APScheduler (자동화) | ML 피처 추출 |
| **DB** | MySQL 8.0 (Docker, RANGE 파티셔닝) | VPS MySQL / RDS | 시계열 최적화 검토 |
| **캐싱** | — | Redis | Redis 클러스터 |
| **백엔드** | FastAPI, SQLAlchemy async | Nginx 리버스 프록시, 레이트 리미팅 | ML 서빙 엔드포인트 |
| **프론트엔드** | React + TypeScript, ECharts | Vercel CDN | 구독 관리 UI |
| **서버 상태 관리** | TanStack Query v5 | — | — |
| **클라이언트 상태 관리** | React useState (선택 상태) | Zustand (필요 시) | — |
| **인프라** | 로컬 데스크탑 (7950X + RTX 5080) | VPS + Vercel | — |
| **CI/CD** | — | GitHub Actions | — |

---

## Phase 1: 로컬 MVP 구축

> 상세 내용: [phase1_plan.md](phase1_plan.md)

### 핵심 목표
로컬에서 실제 F1 텔레메트리 데이터를 MySQL에 적재하고, React 대시보드에서 드라이버 간 비교 차트를 렌더링한다.

### 핵심 산출물
- ETL 파이프라인 (FastF1 → MySQL, 체크포인트 + 병렬 적재)
- FastAPI REST API (4개 엔드포인트)
- React 4-panel 텔레메트리 차트 (TanStack Query + ECharts 크로스헤어 동기화)
- `teams` 테이블: 시즌별 팀 색상 관리
- `weather` 테이블: Phase 3 AI 모델 피처 사전 확보
- `etl_progress` 테이블: ETL 재개 가능성 보장
- 2025 시즌 전체 데이터 적재 완료

### 완료 기준 (Definition of Done)
- VER vs HAM, 2025 Bahrain GP 퀵랩 비교 차트가 로컬 브라우저에서 정상 렌더링
- `/telemetry` 쿼리 응답 시간 < 200ms (단일 드라이버 기준)
- ETL 중단 후 재실행 시 데이터 중복 없이 이어서 진행

---

## Phase 2: 퍼블릭 웹 배포

### 핵심 목표
Phase 1 결과물을 외부 사용자가 접근할 수 있는 형태로 배포하고, 구글 애드센스 승인을 취득한다.

### 인프라 구성

```
[사용자 브라우저]
      │
      ▼
[Vercel CDN] → React 정적 파일 서빙
      │ API 요청
      ▼
[VPS: Nginx] → FastAPI (uvicorn)
      │
      ▼
[VPS: MySQL 8.0] ◄── [로컬 데스크탑: ETL 실행 후 동기화]
      │
[Redis] ← 쿼리 결과 캐싱 (TTL 기반)
```

### 로컬-클라우드 하이브리드 동기화 전략 (증분 방식)

ETL은 로컬에서 수행하고, **신규 라운드 데이터만** VPS로 전송합니다.
전체 `mysqldump`(~30GB)는 수십 분~수 시간 소요로 비현실적이므로 라운드 단위 증분 방식을 사용합니다.

```bash
# 예: 2025 Round 5 완료 후 VPS 동기화
ROUND=5
SEASON=2025

# 1. 로컬: 해당 라운드의 session_id 목록 확인 후 라운드 단위 덤프
mysqldump f1db sessions laps \
  --where="season=${SEASON} AND round=${ROUND}" \
  > round${ROUND}_meta.sql

mysqldump f1db telemetry \
  --where="season=${SEASON} AND session_id IN \
    (SELECT id FROM f1db.sessions WHERE season=${SEASON} AND round=${ROUND})" \
  > round${ROUND}_telemetry.sql   # 라운드당 약 1~1.5GB

mysqldump f1db weather \
  --where="season=${SEASON} AND session_id IN \
    (SELECT id FROM f1db.sessions WHERE season=${SEASON} AND round=${ROUND})" \
  > round${ROUND}_weather.sql

# 2. VPS로 전송 (약 3~5분)
scp round${ROUND}_*.sql user@vps:~/sync/

# 3. VPS에서 순서대로 적재 (sessions/teams 먼저, telemetry/weather 나중)
ssh user@vps "mysql f1db < ~/sync/round${ROUND}_meta.sql && \
              mysql f1db < ~/sync/round${ROUND}_telemetry.sql && \
              mysql f1db < ~/sync/round${ROUND}_weather.sql"
```

> **장기 전략:** 데이터가 100GB를 초과하거나 동기화 지연을 줄여야 할 시점에
> MySQL binlog 기반 replication으로 전환을 검토합니다.

- 라운드 직후 24시간 이내 업데이트 목표

### Redis 캐싱 레이어
- 캐싱 대상: `/telemetry` 응답, `/sessions` 목록
- TTL: 현재 시즌 신규 데이터는 1시간, 이전 시즌 데이터는 24시간
- 캐시 키 설계: `tel:{session_id}:{driver_code}:{lap_number}`

### Phase 2 필수 고려사항
- **레이트 리미팅 (GAP-04):** `slowapi` 라이브러리로 IP당 분당 요청 제한 적용. Redis 연동 시 분산 환경에서도 동작. 퍼블릭 배포 전 반드시 완료.
- **서킷 메타데이터 확정 (GAP-02):** F1 MCP Server, OpenF1 API, Jolpica F1 API 등 외부 데이터소스에서 서킷 코너/스트레이트 구간 데이터 제공 여부 조사. Phase 3 코너링 분석의 선결 조건이므로 Phase 2 기간 중 반드시 결정.
- **신규 시즌 파티션 추가:** 매 시즌 시작 전 `ALTER TABLE telemetry ADD PARTITION p{year} VALUES LESS THAN ({year+1})` 실행.

### 배포 체크리스트
- [ ] VPS 선택 및 MySQL 8.0 설치 (Hetzner / DigitalOcean 검토)
- [ ] Nginx 리버스 프록시 + Let's Encrypt HTTPS 설정
- [ ] 도메인 연결 및 SSL 인증서 발급
- [ ] Redis 설치 및 캐싱 레이어 FastAPI에 통합
- [ ] slowapi 레이트 리미팅 적용 (IP당 분당 30회)
- [ ] GitHub Actions CI/CD 파이프라인 구축
- [ ] 라운드 단위 증분 동기화 스크립트 작성 및 테스트
- [ ] 서킷 메타데이터 데이터소스 결정 (F1 MCP Server / OpenF1 API 등 조사)
- [ ] circuits 테이블 마이그레이션 (아래 순서 준수)
  - [ ] ① `circuits` 테이블 생성
  - [ ] ② Phase 1에서 적재된 `sessions.circuit_key` 목록으로 circuits 기본 데이터 삽입
  - [ ] ③ 모든 circuit_key 값이 circuits에 존재함을 확인한 후 FK 추가
  - [ ] ④ 코너/DRS 구간 데이터 보강 (데이터소스 결정 후)
- [ ] 구글 애드센스 신청
- [ ] Vercel 배포 및 환경변수 설정

### 완료 기준
- 외부 URL에서 대시보드 접근 가능
- 애드센스 광고 단위 1개 이상 노출
- `/telemetry` 응답 시간 < 300ms (Redis 캐시 히트 기준)

---

## Phase 3: AI 고도화 및 수익화

### 핵심 목표
누적 데이터를 기반으로 예측 모델을 추가하고, Freemium 구독 모델을 도입한다.

### 추가 기능 (우선순위 순)

#### 3-1. 공력 성능 역산 시각화
- 직선 구간 시계열 속도 데이터 미분 → 가속도 도출
- 고속 영역에서의 항력(drag) 계수 역산 및 팀별 비교
- ETL 전처리 시 계산 결과 `aero_metrics` 테이블에 저장

#### 3-2. 코너링 프로파일 분석
- 코너 진입 제동 지점(Late Braking Point) 감지
- 탈출 스로틀 전개 시점 비교
- `circuits` 테이블의 코너 구간 메타데이터 사용 (Phase 2 확정 필요)

#### 3-3. 트랙 맵 시각화
- X, Y 좌표로 트랙 레이아웃 렌더링
- 속도/스로틀/기어를 컬러 그라디언트로 트랙 위에 오버레이

#### 3-4. AI 예측 모델
- **타이어 마모 예측:** tyre_life × compound × track_temp(weather) → 랩타임 저하 예측
- **언더컷/오버컷 시뮬레이터:** 피트스톱 타이밍별 예상 결과 시뮬레이션
- 모델 학습: 로컬 GPU(RTX 5080), scikit-learn / XGBoost / LightGBM 우선 검토

#### 3-5. Freemium 모델
| 티어 | 기능 | 가격 |
|------|------|------|
| **Free** | 현재 시즌 텔레메트리, 2드라이버 비교, 광고 노출 | 무료 |
| **Pro** | 과거 시즌 전체, 무제한 드라이버 비교, 광고 없음, AI 예측 | 월 $X |

---

## 데이터 아키텍처 — 확장 로드맵

### Phase 1 확정 스키마 요약

```
sessions ──┬── drivers (team_name → teams 테이블과 논리적 조인)
           ├── laps
           ├── telemetry  (RANGE 파티셔닝 by season)
           ├── weather    (RANGE 파티셔닝 by season)
           └── etl_progress (ETL 체크포인트)

teams      (team_name + season → team_color)
```

#### 핵심 설계 결정 사항

**① 파티셔닝: RANGE(season)**
```sql
-- telemetry, weather 테이블 모두 동일 전략 적용
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
-- 신규 시즌 추가 시: ALTER TABLE telemetry ADD PARTITION p2026 VALUES LESS THAN (2027);
```

**② 멱등성: 복합 PK가 유니크 제약 겸 인덱스**
```sql
-- telemetry PK: season이 앞에 위치하여 파티셔닝 키 요건 충족
PRIMARY KEY (season, session_id, driver_code, lap_number, time_ms)
-- INSERT IGNORE 또는 ON DUPLICATE KEY UPDATE로 재실행 안전 보장
```

**③ 팀 색상: 시즌별 독립 관리**
```sql
CREATE TABLE teams (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    team_name   VARCHAR(100) NOT NULL,
    season      SMALLINT     NOT NULL,
    team_color  CHAR(6)      NOT NULL,
    UNIQUE KEY uq_team_season (team_name, season)
);
-- drivers 테이블은 team_color 컬럼 없이 team_name만 보유
-- 색상 조회: JOIN teams ON d.team_name = t.team_name AND s.season = t.season
```

### Phase 2 확장 스키마

```sql
-- 서킷 정보 (Phase 2, 데이터소스 결정 후)
CREATE TABLE circuits (
    circuit_key   VARCHAR(50) PRIMARY KEY,
    circuit_name  VARCHAR(100),
    country       VARCHAR(50),
    lap_length_m  FLOAT,
    corners       JSON,   -- [{number:1, entry_x:..., entry_y:..., type:'slow'}, ...]
    drs_zones     JSON    -- [{detection_x:..., activation_x:..., end_x:...}, ...]
);

-- 피트스톱 데이터 (Phase 2)
CREATE TABLE pit_stops (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    session_id      INT NOT NULL,
    driver_code     CHAR(3) NOT NULL,
    lap_number      TINYINT NOT NULL,
    pit_duration_ms INT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

### Phase 3 확장 스키마

```sql
-- 공력 분석 결과 캐시 (Phase 3)
CREATE TABLE aero_metrics (
    session_id    INT NOT NULL,
    driver_code   CHAR(3) NOT NULL,
    lap_number    TINYINT NOT NULL,
    drag_index    FLOAT,
    drs_delta_kmh FLOAT,
    PRIMARY KEY (session_id, driver_code, lap_number)
);
```

### 과거 시즌 데이터 확장 계획
- Phase 1: 2025 시즌 (~5,000만 rows)
- Phase 2: 2023~2024 시즌 추가
- Phase 3: 2018~2022 시즌 (Turbo Hybrid 황금기 전체)
- 예상 최종 규모: ~3억 rows → RANGE 파티셔닝으로 시즌별 독립 관리

---

## 프론트엔드 상태 관리 전략

### Phase 1: TanStack Query + React useState

| 상태 종류 | 담당 | 예시 |
|-----------|------|------|
| **서버 상태** (API 응답) | TanStack Query | 세션 목록, 드라이버 목록, 텔레메트리 데이터 |
| **UI 선택 상태** | React useState | 선택된 season/round/session, 드라이버 A/B, 랩 번호 |
| **차트 인터랙션 상태** | React useState | 크로스헤어 현재 time_ms (ECharts 내부 처리) |

### Phase 2 이후 Zustand 도입 시 마이그레이션 가이드

Zustand를 나중에 추가하더라도 TanStack Query 코드를 수정할 필요가 없도록 아래 경계를 지킨다:
- **TanStack Query 역할 고정:** 서버 데이터 페칭, 캐싱, 로딩/에러 상태. 절대 UI 선택 상태를 Query에 넣지 않는다.
- **Zustand 도입 대상:** `selectedSessionId`, `selectedDrivers`, `selectedLaps` 등 여러 컴포넌트가 공유하는 UI 상태. Phase 1에서는 `useState`로 관리하다가 컴포넌트 간 prop drilling이 3단계 이상 발생하는 시점에 Zustand로 이전.
- **절대 섞지 않기:** Zustand store에서 `useQuery` 훅을 직접 호출하지 않는다. 데이터 페칭은 컴포넌트에서만.

---

## 운영 및 모니터링

### ETL 안정성
- FastF1 API 실패 시 자동 재시도 (지수 백오프, 최대 3회)
- 라운드 적재 완료 후 `etl_progress` 테이블에 row_count 기록 및 검증
- ETL 실행 로그 파일 저장 (`etl/logs/YYYYMMDD_HH.log`)

### 백엔드 모니터링 (Phase 2)
- Nginx 액세스 로그 분석
- FastAPI 응답 시간 메트릭 (Prometheus + Grafana 검토)
- DB 슬로우 쿼리 로그 활성화 (`long_query_time=1`)

### 백업 전략 (Phase 2)
- 일 1회 `mysqldump` → VPS 로컬 저장
- 주 1회 로컬 데스크탑으로 전체 백업 동기화

---

## 미결 사항 (의사결정 필요)

| # | 항목 | 옵션 A | 옵션 B | 결정 시점 |
|---|------|--------|--------|----------|
| 1 | 공력 역산 계산 위치 | ETL 시 전처리 후 DB 저장 | API 실시간 계산 | Phase 1 Step 3 완료 후 |
| 2 | 텔레메트리 다운샘플링 | 전체 포인트 전송 (~1,500 rows) | 줌 레벨 기반 동적 샘플링 | Phase 1 Step 5 성능 확인 후 |
| 3 | 서킷 메타데이터 소스 | F1 MCP Server / OpenF1 API 등 외부 API | FastF1 좌표 분석 기반 반자동 추출 | Phase 2 시작 전 (필수) |
| 4 | VPS 선택 | Hetzner CX22 (€4.35/월) | DigitalOcean Droplet ($6/월) | Phase 2 시작 전 |
| 5 | 과거 시즌 적재 순서 | 2024 → 2023 → 2022 순 | 사용자 요청 기반 온디맨드 | Phase 2 완료 후 |
| 6 | Freemium 결제 | Stripe | Paddle | Phase 3 시작 전 |
| 7 | AI 모델 배포 방식 | FastAPI 인라인 추론 | 별도 ML 서빙 컨테이너 | Phase 3 설계 시 |

---

## GAP 결정 이력 (확장성 검토 결과)

| # | 항목 | 결정 | 반영 위치 |
|---|------|------|----------|
| GAP-01 | DB 파티셔닝 전략 | RANGE(season) 파티셔닝으로 전환 | phase1_plan.md 스키마 |
| GAP-02 | 서킷 메타데이터 | F1 MCP Server 등 외부 소스 조사 — Phase 2 기간 중 결정 | plan.md Phase 2 필수사항 |
| GAP-03 | ETL 멱등성 | 복합 PK + INSERT IGNORE 적용 | phase1_plan.md 스키마/ETL |
| GAP-04 | API 레이트 리미팅 | Phase 2 배포 전 필수 적용 (slowapi) | plan.md Phase 2 필수사항 |
| GAP-05 | 날씨 데이터 | Phase 1 ETL에 weather 테이블 추가 | phase1_plan.md 스키마/ETL |
| GAP-06 | 팀 색상 관리 | teams 마스터 테이블 분리, 시즌별 관리 | phase1_plan.md 스키마 |
| GAP-07 | 프론트엔드 상태관리 | TanStack Query 먼저, Zustand는 필요 시 추가 | phase1_plan.md 프론트엔드, plan.md 상태관리 전략 |
| GAP-08 | 대용량 적재 전략 | 체크포인트 + 병렬 적재 + LOAD DATA INFILE 세 가지 동시 적용 | phase1_plan.md ETL |

---

## 문서 관리

| 파일 | 역할 |
|------|------|
| `plan.md` | 전체 로드맵 (이 문서) |
| `phase1_plan.md` | Phase 1 상세 실행 계획 및 체크리스트 |
| `phase2_plan.md` | Phase 2 배포 계획 (Phase 1 완료 후 작성) |
| `phase3_plan.md` | Phase 3 AI/수익화 계획 (Phase 2 완료 후 작성) |
