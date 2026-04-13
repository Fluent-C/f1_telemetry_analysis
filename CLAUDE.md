# F1 Telemetry Analytics — AI 컨텍스트 파일

> **새 AI 세션을 시작할 때 이 파일을 먼저 읽으세요.**
> 이 파일은 세션 간 컨텍스트를 유지하기 위한 Source of Truth입니다.
> 변경 사항이 생기면 세션 말미에 반드시 업데이트하세요.

---

## ⚠️ 이중 AI 개발 환경 안내 (필독)

이 프로젝트는 **두 개의 AI 도구가 동시에 개발**에 참여합니다.

| 도구 | 역할 | 특징 |
|------|------|------|
| **Claude Code** (VSCode 익스텐션) | 파일 편집, 명령 실행, 코드 생성 | VSCode 내 사이드바에서 대화형으로 사용 |
| **Antigravity** (독립 실행형 앱) | 파일 편집, 브라우저 조작, 차트 확인 | 별도 프로그램으로 실행, VSCode와 병행 사용 |

### 충돌 방지 규칙

1. **같은 파일을 동시에 수정하지 않는다.**
   작업을 시작하기 전에 아래 `현재 진행 중인 작업` 섹션을 확인하고,
   다른 AI가 진행 중인 파일과 겹치지 않는지 먼저 체크하라.

2. **작업 시작 시 즉시 선점 표시를 남긴다.**
   `현재 진행 중인 작업` 섹션에 자신의 도구명과 담당 파일/작업을 기록하라.

3. **작업 완료 시 선점 표시를 해제하고 완료 내역을 갱신한다.**
   완료된 항목은 `Step 진행 현황`으로 이동시키고 `현재 진행 중인 작업`을 비운다.

4. **CLAUDE.md가 최종 진실(Source of Truth)이다.**
   코드 파일과 CLAUDE.md가 충돌하면 코드 파일을 기준으로 CLAUDE.md를 수정하라.

---

## 🔄 세션 인계 프로토콜 (토큰 소진 전 필수)

> AI는 자신의 컨텍스트 한계(토큰 소진)가 가까워지면,
> 다음 AI가 즉시 작업을 이어받을 수 있도록 **반드시 아래 체크리스트를 수행**한다.

### 인계 전 체크리스트

- [ ] 작업 중이던 파일을 저장하고 문법 오류가 없는지 확인
- [ ] `현재 진행 중인 작업` 섹션을 최신화 — 무엇을 했고, 어디서 멈췄는지 명시
- [ ] 미완성 작업이 있으면 TODO 항목으로 남긴다 — 파일명과 라인번호 포함
- [ ] 서버/프로세스 상태 기록 — 백엔드/프론트엔드/Docker가 현재 실행 중인지 여부
- [ ] 마지막으로 실행한 명령어와 출력 요약 기록
- [ ] `최종 업데이트` 타임스탬프 갱신 (파일 맨 아래)

### 인계 메시지 양식

```
### 인계 메시지 (YYYY-MM-DD HH:MM KST)
- 작성 주체: Claude Code / Antigravity
- 완료한 작업: ...
- 중단 지점: [파일명:라인번호] 또는 "완전 완료"
- 다음 AI가 할 일: ...
- 주의사항: ...
- 서버 상태: Docker ? | Backend ? port 8000 | Frontend ? port 5173
```

---

## 프로젝트 한 줄 요약

FastF1 → MySQL 8.0 → FastAPI → React 스택의 F1 텔레메트리 분석 대시보드.
드라이버 간 랩 텔레메트리를 4-panel 차트(속도/스로틀/브레이크/기어) + 3D/2D 트랙 맵으로 비교한다.

---

## Step 진행 현황 (2026-04-13)

```
✅ Step 1  개발 환경 (Docker MySQL, Python venv, React scaffold)
✅ Step 2  DB 스키마 (7개 테이블, RANGE 파티셔닝 by season)
✅ Step 3  ETL 파이프라인 (fetch_*.py + load_data.py + load_teams.py)
✅ Step 4  FastAPI 백엔드 (4개 엔드포인트)
✅ Step 5  React 프론트엔드 (SessionSelector, DriverLapSelector, TelemetryChart)
✅ Step 5b TelemetryChart 차트 버그 수정 (기어 Y축, 브레이크 step 렌더링)
✅ Step 5c 브레이크 데이터 ETL 버그 수정 (boolean→int 변환, R1 재적재 완료)
✅ Step 6  통합 테스트 (UI 렌더링, 크로스헤어, 재적재 멱등성, 응답시간 검증 완료)
✅ Step 7  2025 시즌 전체 병렬 적재 (16워커 적재 완료: 2,970만 로우)
✅ Step 7b 스프린트 세션(SQ, S) 누락 버그 핫픽스 (FastF1 포맷 매핑 추가)
✅ Step 8  3D/2D 트랙 맵 구현 (TrackMap.tsx, echarts-gl, hoverTimeMs 동기화)
✅ Step 8b TrackMap UI 고도화 (3D/2D 동시 표시, 고도 컬러링, 카메라 슬라이더, 블랭크 버그 수정)

--- Phase 1.5: 배포 전 기능 확장 (docs/plan/phase1_plan.md Step 9-11 참조) ---
✅ Step 9  Option A — 랩 데이터 확장 (섹터 타임, 스피드 트랩, 타이어 전략 차트)
✅ Step 10 Option B — 레이스 결과 화면 (결과 테이블, 포지션 차트, 갭 차트, 탭 UI)
✅ Step 10b UX — 동팀 드라이버 시각 구분 (색상 밝기 조정 + 라인 스타일 구분)
🔲 Step 11 Option C — 트랙 맵 고도화 (코너 오버레이, 레이스 컨트롤 타임라인)
```

> ⚠️ **Phase 2 배포 전에 Step 9–11을 반드시 완료해야 합니다.**
> 각 Step의 상세 스펙은 `docs/plan/phase1_plan.md`의 **"Phase 1.5: 배포 전 기능 확장"** 섹션을 참조하십시오.
> 스펙에는 DB ALTER문, ETL 코드, FastAPI 엔드포인트, React 컴포넌트 구조가 모두 포함되어 있습니다.

---

## 🚧 현재 진행 중인 작업

> 이 섹션이 비어 있으면 어느 AI도 자유롭게 다음 작업을 시작할 수 있다.

```
Step 10b 완료 — 동팀 드라이버 시각 구분 구현 완료.
다음: Step 11 (트랙 맵 고도화 — 코너 오버레이 + 레이스 컨트롤 타임라인).
```

### 다음 AI가 할 일 (Step 11)

**반드시 `docs/plan/phase1_plan.md`의 "Phase 1.5: 배포 전 기능 확장" 섹션을 먼저 읽고 시작하라.**

진행 순서:
1. **Step 11** (Option C): `circuits` + `race_control_messages` 테이블 → ETL 신설 (`fetch_circuit_info.py`, `fetch_race_control.py`) → 라우터 신설 → `TrackMap.tsx` 코너 오버레이 + `RaceControlTimeline.tsx`

### Step 10b 완료 내역 (2026-04-13)

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/utils/colorUtils.ts` | **신규**: `lightenHex(hex, amount)` — RGB 선형 보간으로 hex 색상 밝기 조정 |
| `frontend/src/App.tsx` | `sameTeam` 감지 (team_name 비교), Driver B 색상 45% 밝게, `adjustedColors`/`dashedDrivers` 계산 후 각 차트에 전달 |
| `frontend/src/components/TelemetryChart.tsx` | `isDashedB` prop 추가 → Driver B 계열 라인 `dashed` 적용 |
| `frontend/src/components/PositionChart.tsx` | `dashedDrivers: Set<string>` prop 추가 → 해당 드라이버 라인 `dashed` |
| `frontend/src/components/GapChart.tsx` | 동일 |
| `frontend/src/components/TrackMap.tsx` | `isDashedB` prop 추가 → Driver B 마커 심볼 `diamond`으로 변경 |

### Step 10 완료 내역 (2026-04-13)

| 파일 | 변경 내용 |
|------|----------|
| `etl/fetch_results.py` | **신규**: FastF1 `session.results` 수집. DNF/DSQ 등 문자열 position 안전 처리 |
| `etl/load_data.py` | `insert_results()` 추가, `process_one_session()` step 5 삽입 (laps-only 모드 포함) |
| `backend/app/schemas.py` | `SessionResultOut` 스키마 추가 |
| `backend/app/routers/results.py` | **신규**: `GET /results?session_id=X` (팀컬러 JOIN, DNF 후순위 정렬) |
| `backend/app/main.py` | results 라우터 등록 |
| `frontend/src/types/f1.ts` | `SessionResult` 인터페이스 추가 |
| `frontend/src/api/f1Client.ts` | `fetchResults()` 추가 |
| `frontend/src/hooks/useResults.ts` | **신규**: `useResults()` 훅 |
| `frontend/src/hooks/useLaps.ts` | `useAllLaps()` 훅 추가 |
| `frontend/src/components/ResultsTable.tsx` | **신규**: 순위·드라이버·팀·포인트·상태 테이블 |
| `frontend/src/components/PositionChart.tsx` | **신규**: 랩별 포지션 변화 꺾은선 차트 |
| `frontend/src/components/GapChart.tsx` | **신규**: 리더 대비 누적 갭 차트 |
| `frontend/src/App.tsx` | 텔레메트리/결과 탭 전환 UI, 드라이버 정렬 (레이스→순위순, 그 외→랩타임순) |

데이터: 2025 시즌 120개 세션 → 2,399개 결과 행 적재 완료

### Step 8b 완료 내역 (2026-04-07)

| 파일 | 변경 내용 |
|------|----------|
| `frontend/src/components/TrackMap.tsx` | 3D/2D 동시 표시(2컬럼), 고도(Z) 기반 컬러링(ELEV_COLORS), HTML 그라디언트 범례, 카메라 슬라이더 4개(ZScale/Angle/Rotation/Zoom), 두 드라이버 항상 표시, 드라이버 두 명 선택 시 블랭크 버그 수정 |
| `frontend/src/components/TelemetryChart.tsx` | 툴팁에서 두 드라이버 데이터 항상 표시 (time_ms 이진탐색 방식으로 교체) |

### Step 9 완료 내역 (2026-04-05)

| 파일 | 변경 내용 |
|------|----------|
| `etl/fetch_telemetry.py` | `fetch_laps()` 확장: sector1/2/3_ms, speed_i1/i2/fl/st, fresh_tyre, stint, pit_in/out_ms, position 수집 |
| `etl/load_data.py` | `upsert_laps()` SQL 20개 컬럼으로 확장, `--laps-only` 플래그 추가 |
| `backend/app/models.py` | `Lap` 모델에 12개 컬럼 추가 |
| `backend/app/schemas.py` | `LapOut` 스키마에 12개 필드 추가 |
| `frontend/src/types/f1.ts` | `Lap` 인터페이스에 12개 필드 추가 |
| `frontend/src/api/f1Client.ts` | `fetchAllLaps()` 추가 (전체 드라이버 랩, 타이어 전략용) |
| `frontend/src/components/SectorDeltaChart.tsx` | **신규**: 섹터 델타 막대 차트 + 스피드 트랩 툴팁 |
| `frontend/src/components/TyreStrategyChart.tsx` | **신규**: 컴파운드별 스틴트 타임라인 (간트 형태) |
| `frontend/src/App.tsx` | TyreStrategyChart(세션 선택 시) + SectorDeltaChart(랩 선택 시) 통합 |

### ✅ 데이터 재적재 완료 (2026-04-06)

`--laps-only` 플래그로 telemetry 30M 행 생략, laps만 빠르게 갱신 완료.
2025 시즌 120개 세션 재적재 → 65,655 랩, sector1 90%, speed_st 98.8%, stint 99.3%, compound 100% 채워짐.

```bash
# laps 컬럼만 갱신할 때 (telemetry 생략 — 빠름)
cd etl && venv/Scripts/activate
python load_data.py --season 2025 --all-rounds --laps-only --workers 8
```

---

## 수정된 버그 이력

| 날짜 | Step | 버그 | 수정 내용 |
|------|------|------|-----------|
| 2026-04-02 | 5b | 기어 Y축 0~1로 고정됨 | ECharts yAxis `interval:1`, `min:1`, `max:8` 설정 |
| 2026-04-02 | 5b | 브레이크 라인 렌더링 안 됨 | `step:'end'` + `areaStyle` 추가 |
| 2026-04-02 | 5c | 브레이크 값 전부 0 | `fetch_telemetry.py`에서 pandas bool→int 변환 누락. `.fillna(False).astype(int)` 추가 후 2025 R1 재적재 완료 |
| 2026-04-02 | 7b | 스프린트 세션(SQ, S) 표출 안 됨 | 24/25년 FastF1 스프린트 이벤트명 변경(`sprint_qualifying`) 미대응 수정. `fetch_sessions.py` 지원 추가 및 재적재 완료 |
| 2026-04-07 | 8b | 툴팁에 드라이버 1명만 표시됨 | TelemetryChart: ECharts params 의존 제거, 각 드라이버 time_ms 배열에 이진탐색으로 독립 조회 |
| 2026-04-07 | 8b | 드라이버 두 명 선택 시 화면 블랭크 | TrackMap: `useRef+useEffect`로 `inst.setOption({series:[null,...]})` 호출 시 echarts-gl 크래시. activePoints3D를 option3D 단일 useMemo에 직접 포함하는 방식으로 교체 |

---

## 디렉토리 구조

```
f1_telemetry_analysis/
├── .env                    # DB 크리덴셜, 포트, 캐시 경로 (git 제외)
├── .env.example            # .env 템플릿
├── docker-compose.yml      # MySQL 8.0 (--local-infile=1, --max_connections=200)
├── CLAUDE.md               # 이 파일 (AI 세션 컨텍스트)
├── docs/                   # 모든 문서 (docs/README.md에 폴더 규칙 상세 설명)
│   ├── plan/
│   │   ├── plan.md         # 마스터 플랜 (Phase 1-3 전체 로드맵 + 현황)
│   │   └── phase1_plan.md  # Phase 1 + 1.5 Source of Truth (상세 스펙)
│   ├── in-progress/        # 현재 작업 중인 Step 스펙 (완료 시 completed로 이동)
│   ├── completed/          # 완료된 Step 기록 (불변 보존)
│   └── reference/
│       └── fastf1_api.md   # FastF1 API 데이터 스펙 레퍼런스
│
├── etl/                    # Python ETL 파이프라인
│   ├── venv/               # Python 가상환경 (git 제외)
│   ├── requirements.txt
│   ├── config.py           # get_db_connection(), .env 로드
│   ├── schema.sql          # CREATE TABLE (7개) — laps 컬럼 미반영(ALTER로 적용됨)
│   ├── fetch_sessions.py   # FastF1 schedule → sessions 메타
│   ├── fetch_telemetry.py  # get_telemetry() → telemetry+laps DataFrame (Step 9: 섹터/스피드/타이어 포함)
│   ├── fetch_weather.py    # session.weather_data → weather DataFrame
│   ├── load_data.py        # 메인 오케스트레이터 (CLI, 체크포인트, Pool)
│   ├── load_teams.py       # 팀 색상 추출 → teams 테이블
│   └── fastf1_cache/       # FastF1 캐시 (worker_0 ~ worker_N)
│
├── backend/                # FastAPI 서버
│   ├── venv/               # Python 가상환경 (git 제외)
│   ├── requirements.txt
│   └── app/
│       ├── main.py         # lifespan, CORS, session_season_cache, 라우터 등록 (3개 라우터)
│       ├── database.py     # SQLAlchemy async engine + get_db()
│       ├── models.py       # ORM 모델 (7개 테이블, Lap 모델 Step 9 컬럼 포함)
│       ├── schemas.py      # Pydantic v2 응답 스키마 (LapOut Step 9 필드 포함)
│       └── routers/
│           ├── sessions.py # GET /sessions, GET /sessions/{id}/laps (전체 or 드라이버 필터)
│           ├── drivers.py  # GET /drivers (팀컬러 LEFT JOIN)
│           └── telemetry.py# GET /telemetry (파티션 프루닝, x/y/z 포함)
│
└── frontend/               # React 18 + TypeScript + Vite
    ├── package.json        # echarts, echarts-for-react, echarts-gl, tslib 포함
    └── src/
        ├── types/f1.ts     # Session, Driver, Lap(Step 9 확장), TelemetryData 등
        ├── api/f1Client.ts # fetchSessions, fetchDrivers, fetchLaps, fetchAllLaps, fetchTelemetry
        ├── hooks/           # useSessions, useDrivers, useLaps, useTelemetry
        ├── components/
        │   ├── SessionSelector.tsx
        │   ├── DriverLapSelector.tsx
        │   ├── TelemetryChart.tsx      # 4-panel ECharts (속도/스로틀/브레이크/기어)
        │   ├── TrackMap.tsx            # 3D/2D 트랙 맵 (echarts-gl, Z Scale 슬라이더)
        │   ├── SectorDeltaChart.tsx    # 섹터 델타 막대 차트 + 스피드 트랩 툴팁 (Step 9)
        │   └── TyreStrategyChart.tsx   # 컴파운드별 스틴트 타임라인 (Step 9)
        ├── App.tsx          # 전체 레이아웃: TyreStrategy → TrackMap → SectorDelta → Telemetry
        ├── main.tsx
        └── index.css
```

---

## API 엔드포인트 (현재 완성)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | `{"status":"ok","cached_sessions":N}` |
| GET | `/sessions?season=2025` | 시즌별 세션 목록 |
| GET | `/sessions/{id}/laps` | 랩 목록 (`?driver=VER` 필터 가능 — 생략 시 전체 드라이버) |
| GET | `/drivers?session_id=5` | 드라이버 목록 + 팀 색상 |
| GET | `/telemetry?session_id=5&drivers=VER,HAM&laps=10,12` | 텔레메트리 비교 (x,y,z 포함) |

`/sessions/{id}/laps` 응답 필드 (Step 9 이후):
`driver_code, lap_number, lap_time_ms, sector1/2/3_ms, speed_i1/i2/fl/st, compound, tyre_life, fresh_tyre, stint, pit_in/out_ms, position, is_personal_best, deleted`

Swagger UI: `http://localhost:8000/docs`

---

## 핵심 설계 결정 (변경 시 주석 추가)

| 항목 | 결정 | 이유 |
|------|------|------|
| DB 파티셔닝 | RANGE(season) | 시즌별 쿼리 프루닝 |
| telemetry FK | 없음 | MySQL 8.0 파티셔닝 + FK 불가 |
| compound | VARCHAR(20) | INTERMEDIATE(12자) 대응 |
| time_ms | 랩 기준 (차트 X축) | fetch_telemetry: `lap.Time` |
| session_time_ms | 세션 기준 (weather JOIN) | fetch_telemetry: `lap.SessionTime` |
| session_season_cache | 앱 시작 시 전체 로드 | /telemetry 파티션 프루닝용, 추가 쿼리 없음 |
| 텔레메트리 직렬화 | 컬럼 방향 (column-oriented) | JSON 크기 최소화 |
| X/Y/Z 좌표 | `get_telemetry()`로 수집 | Step 8에서 get_car_data() → get_telemetry()로 교체. Z=고도 |
| brake 저장 타입 | TINYINT 0/1 | FastF1 bool→CSV 직렬화 시 MySQL이 "True"를 0으로 해석하는 버그 방지 |

---

## 구현 주의사항 (코딩 시 필독)

1. **ECharts + React 18 Strict Mode**: `onEvents` prop 사용, `useEffect` 내 이벤트 등록 금지
   ```tsx
   // OK
   <ReactECharts option={option} onEvents={{ 'datazoom': handleZoom }} />
   // NG: StrictMode 이중 마운트로 이벤트 핸들러 중복
   useEffect(() => { chartRef.current?.on('datazoom', handleZoom) }, [])
   ```
2. **크로스헤어 동기화**: `axisPointer.link: [{xAxisIndex: 'all'}]` — 4개 차트 동일 그룹
3. **최속 랩 자동 선택**: `laps` 배열에서 `lap_time_ms`가 가장 작은 랩 번호를 기본값으로
4. **TanStack Query v5 문법**: `useQuery({ queryKey, queryFn })` (v4의 `useQuery(key, fn)` 아님)
5. **팀 색상 표시**: `#${driver.team_color}` (DB는 `#` 없이 6자리 hex 저장)
6. **brake ETL**: FastF1 `Brake`(bool) → `.fillna(False).astype(int)` 필수 (반드시 0/1로 변환 후 저장)
7. **echarts-gl**: `import 'echarts-gl'` 사이드 이펙트 임포트만으로 3D 타입 활성화. TypeScript 타입 추론은 `as any` 캐스팅 필요
8. **TrackMap hoverTimeMs**: App.tsx에서 `onHover` 콜백으로 TelemetryChart → App → TrackMap 전달
9. **echarts-gl 부분 시리즈 업데이트 불가**: `inst.setOption({ series: [null, {...}] })` 패턴이 echarts-gl에서는 크래시 유발. 드라이버 위치는 반드시 전체 option useMemo 내 series 배열에 포함해야 함 (useRef+useEffect 방식 사용 금지)
10. **동팀 드라이버 시각 구분 (Step 10b)**: 같은 팀 두 드라이버 비교 시 구분을 위해 Driver B 색상 밝기 조정 + 라인 점선 처리.
    - `lightenHex(hex, 0.45)`: hex 색상을 흰색 방향으로 45% 밝게 (RGB 선형 보간)
    - `sameTeam` 여부는 `App.tsx`에서 `drivers` 배열의 `team_name` 비교로 판단
    - `isDashedB`(TelemetryChart) / `dashedDrivers: Set<string>`(Position·GapChart) prop으로 라인 스타일 제어
    - TrackMap: Driver B 마커 심볼을 `'diamond'`으로 변경하여 추가 구분

---

## DB 스키마 현황

```sql
-- laps 테이블 (Step 9 기준, ALTER로 추가됨 — schema.sql 미반영 상태)
id, session_id, driver_code, lap_number,
lap_time_ms, sector1_ms, sector2_ms, sector3_ms,
speed_i1, speed_i2, speed_fl, speed_st,
compound, tyre_life, fresh_tyre, stint,
pit_in_ms, pit_out_ms, position,
is_personal_best, deleted

-- telemetry 테이블 (Step 8 기준)
season, session_id, driver_code, lap_number,
time_ms, session_time_ms,
speed, throttle, brake, gear, rpm, drs,
x, y, z        -- get_telemetry()로 수집, NULL 가능 (일부 세션 미제공)
```

> ⚠️ `etl/schema.sql`의 laps 정의는 아직 ALTER 전 상태입니다. 신규 환경 구축 시 schema.sql 적용 후 수동 ALTER 필요.

---

## 환경 실행 방법

```bash
# 1. Docker MySQL 시작
docker compose up -d

# 2. 백엔드 실행
cd backend
venv/Scripts/activate          # Windows
uvicorn app.main:app --reload --port 8000

# 3. 프론트엔드 실행
cd frontend
npm run dev                    # → http://localhost:5173

# 4. ETL (라운드 추가 적재)
cd etl
venv/Scripts/activate
python load_data.py --season 2025 --round 2 --workers 4
python load_teams.py --season 2025 --round 2 --update
```

---

## 환경 변수 (.env)

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=f1db
DB_USER=f1user
DB_PASSWORD=f1pass2025
DB_ROOT_PASSWORD=f1root2025
FASTF1_CACHE_DIR=./fastf1_cache
BACKEND_PORT=8000
CORS_ORIGINS=http://localhost:5173
ETL_WORKERS=8
ETL_MAX_RETRIES=3
```

---

## 설치된 프론트엔드 패키지

```json
{
  "dependencies": {
    "axios": "latest",
    "@tanstack/react-query": "^5.x",
    "echarts": "latest",
    "echarts-for-react": "latest",
    "echarts-gl": "latest"
  },
  "devDependencies": {
    "@tanstack/react-query-devtools": "^5.x",
    "tslib": "latest"
  }
}
```

---

## 구현 완료 파일 목록

### ETL

| 파일 | 역할 |
|------|------|
| `etl/fetch_sessions.py` | FastF1 schedule → sessions 메타 (스프린트 포맷 대응 포함) |
| `etl/fetch_telemetry.py` | `get_telemetry()` 기반, X/Y/Z 좌표 + laps 12개 컬럼 수집 |
| `etl/fetch_weather.py` | `session.weather_data` → weather DataFrame |
| `etl/load_data.py` | 멀티프로세스 오케스트레이터, 체크포인트, LOAD DATA INFILE, `--laps-only` 지원 |
| `etl/load_teams.py` | 팀 색상 추출 → teams 테이블 |

### Backend

| 파일 | 역할 |
|------|------|
| `backend/app/main.py` | lifespan, CORS, session_season_cache 초기화, 라우터 3개 등록 |
| `backend/app/database.py` | SQLAlchemy 2.0 async engine + get_db() |
| `backend/app/models.py` | ORM 모델 7개 (Lap 모델 Step 9 컬럼 포함) |
| `backend/app/schemas.py` | Pydantic v2 스키마 (LapOut Step 9 필드, TelemetryData x/y/z 포함) |
| `backend/app/routers/sessions.py` | GET /sessions, GET /sessions/{id}/laps |
| `backend/app/routers/drivers.py` | GET /drivers (팀컬러 LEFT JOIN) |
| `backend/app/routers/telemetry.py` | GET /telemetry (파티션 프루닝, x/y/z 직렬화) |

### Frontend

| 파일 | 역할 |
|------|------|
| `src/types/f1.ts` | Session, Driver, Lap(Step 9), TelemetryData(x/y/z) 인터페이스 |
| `src/api/f1Client.ts` | fetchSessions, fetchDrivers, fetchLaps, **fetchAllLaps**, fetchTelemetry |
| `src/hooks/useSessions.ts` | useQuery: GET /sessions |
| `src/hooks/useDrivers.ts` | useQuery: GET /drivers |
| `src/hooks/useLaps.ts` | useQuery: GET /sessions/{id}/laps + fastestLap() 헬퍼 |
| `src/hooks/useTelemetry.ts` | useQuery: GET /telemetry |
| `src/components/SessionSelector.tsx` | 라운드별 optgroup 드롭다운 |
| `src/components/DriverLapSelector.tsx` | 드라이버·랩 선택, 최속랩 자동선택, 팀컬러 뱃지 |
| `src/components/TelemetryChart.tsx` | ECharts 4-grid (속도/스로틀/브레이크/기어), onHover 콜백 |
| `src/components/TrackMap.tsx` | ECharts-GL 3D(고도 컬러)+2D 동시 2컬럼, 카메라 슬라이더(ZScale/Angle/Rotation/Zoom), hoverTimeMs 드라이버 위치 동기화 |
| `src/components/SectorDeltaChart.tsx` | **Step 9** 섹터 델타 막대 차트 + 스피드 트랩 툴팁 |
| `src/components/TyreStrategyChart.tsx` | **Step 9** 전 드라이버 컴파운드별 스틴트 타임라인 |
| `src/components/ResultsTable.tsx` | **Step 10** 순위·드라이버·팀·포인트·상태 테이블 |
| `src/components/PositionChart.tsx` | **Step 10** 랩별 포지션 변화 꺾은선 차트 |
| `src/components/GapChart.tsx` | **Step 10** 리더 대비 누적 갭 차트 |
| `src/hooks/useResults.ts` | **Step 10** useQuery: GET /results |
| `src/App.tsx` | 텔레메트리/결과 탭 전환 UI, 드라이버 정렬 (레이스→순위순, 그 외→랩타임순) |
| `src/utils/colorUtils.ts` | **Step 10b** `lightenHex()` — 동팀 드라이버 Driver B 색상 밝기 조정 유틸 |

---

*최종 업데이트: 2026-04-13 | Claude Code | Step 10b 완료 (동팀 드라이버 시각 구분), Step 11 대기 중*
