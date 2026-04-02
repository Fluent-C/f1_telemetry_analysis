# F1 Telemetry Analytics — AI 컨텍스트 파일

> **새 AI 세션을 시작할 때 이 파일을 먼저 읽으세요.**
> 이 파일은 세션 간 컨텍스트를 유지하기 위한 Source of Truth입니다.
> 변경 사항이 생기면 세션 말미에 반드시 업데이트하세요.

---

## 프로젝트 한 줄 요약

FastF1 → MySQL 8.0 → FastAPI → React 스택의 F1 텔레메트리 분석 대시보드.
드라이버 간 랩 텔레메트리를 4-panel 차트(속도/스로틀/브레이크/기어)로 비교한다.

---

## 현재 상태 (2026-04-02)

```
✅ Step 1  개발 환경 (Docker MySQL, Python venv, React scaffold)
✅ Step 2  DB 스키마 (7개 테이블, RANGE 파티셔닝 by season)
✅ Step 3  ETL 파이프라인 (fetch_*.py + load_data.py + load_teams.py)
✅ Step 4  FastAPI 백엔드 (4개 엔드포인트)
✅ Step 5  React 프론트엔드 (SessionSelector, DriverLapSelector, TelemetryChart)
🔲 Step 6  통합 테스트 ← 다음 작업
🔲 Step 7  2025 시즌 전체 적재
```

---

## 디렉토리 구조

```
f1_telemetry_analysis/
├── .env                    # DB 크리덴셜, 포트, 캐시 경로 (git 제외)
├── .env.example            # .env 템플릿
├── docker-compose.yml      # MySQL 8.0 (--local-infile=1, --max_connections=200)
├── plan.md                 # 마스터 플랜 (Phase 1-3 전체 로드맵 + 현황)
├── phase1_plan.md          # Phase 1 Source of Truth (상세 스펙)
├── CLAUDE.md               # 이 파일 (AI 세션 컨텍스트)
│
├── etl/                    # Python ETL 파이프라인
│   ├── venv/               # Python 가상환경 (git 제외)
│   ├── requirements.txt
│   ├── config.py           # get_db_connection(), .env 로드
│   ├── schema.sql          # CREATE TABLE (7개)
│   ├── fetch_sessions.py   # FastF1 schedule → sessions 메타
│   ├── fetch_telemetry.py  # get_car_data() → telemetry DataFrame
│   ├── fetch_weather.py    # session.weather_data → weather DataFrame
│   ├── load_data.py        # 메인 오케스트레이터 (CLI, 체크포인트, Pool)
│   ├── load_teams.py       # 팀 색상 추출 → teams 테이블
│   └── fastf1_cache/       # FastF1 캐시 (worker_0 ~ worker_7)
│
├── backend/                # FastAPI 서버
│   ├── venv/               # Python 가상환경 (git 제외)
│   ├── requirements.txt
│   └── app/
│       ├── main.py         # lifespan, CORS, session_season_cache, 라우터 등록
│       ├── database.py     # SQLAlchemy async engine + get_db()
│       ├── models.py       # ORM 모델 (7개 테이블)
│       ├── schemas.py      # Pydantic v2 응답 스키마
│       └── routers/
│           ├── sessions.py # GET /sessions, GET /sessions/{id}/laps
│           ├── drivers.py  # GET /drivers (팀컬러 LEFT JOIN)
│           └── telemetry.py# GET /telemetry (핵심, 파티션 프루닝)
│
└── frontend/               # React 18 + TypeScript + Vite
    ├── package.json
    └── src/
        └── (Step 5에서 구현 예정)
```

---

## API 엔드포인트 (백엔드 완성)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/health` | `{"status":"ok","cached_sessions":N}` |
| GET | `/sessions?season=2025` | 시즌별 세션 목록 |
| GET | `/sessions/{id}/laps` | 세션 내 랩 목록 (`?driver=VER` 필터) |
| GET | `/drivers?session_id=5` | 드라이버 목록 + 팀 색상 |
| GET | `/telemetry?session_id=5&drivers=VER,HAM&laps=10,12` | 텔레메트리 비교 |

Swagger UI: `http://localhost:8000/docs`

---

## 핵심 설계 결정 (변경 시 주석 추가)

| 항목 | 결정 | 이유 |
|------|------|------|
| DB 파티셔닝 | RANGE(season) | 시즌별 쿼리 프루닝 |
| telemetry FK | 없음 | MySQL 8.0 파티셔닝 + FK 불가 |
| compound | VARCHAR(20) | INTERMEDIATE(12자) 대응 |
| time_ms | 랩 기준 (chart X축) | fetch_telemetry: `lap.Time` |
| session_time_ms | 세션 기준 (weather JOIN) | fetch_telemetry: `lap.SessionTime` |
| session_season_cache | 앱 시작 시 전체 로드 | /telemetry 파티션 프루닝용, 추가 쿼리 없음 |
| 텔레메트리 직렬화 | 컬럼 방향 (column-oriented) | JSON 크기 최소화 |
| X/Y 좌표 | 현재 NULL | `get_car_data()` 미제공, Phase 3에서 `get_pos_data()` 병합 |

---

## Step 5 구현 목표 (React 프론트엔드)

### 구현할 파일

```
frontend/src/
├── types/f1.ts              # TypeScript 인터페이스
├── api/f1Client.ts          # axios 인스턴스 + API 호출 함수
├── hooks/
│   ├── useSessions.ts       # useQuery: GET /sessions
│   ├── useDrivers.ts        # useQuery: GET /drivers
│   └── useTelemetry.ts      # useQuery: GET /telemetry
├── components/
│   ├── SessionSelector.tsx  # season/round/session_type 드롭다운
│   ├── DriverSelector.tsx   # 드라이버 선택 (팀 색상 뱃지)
│   ├── LapSelector.tsx      # 랩 선택 (퀵랩 자동 선택)
│   └── TelemetryChart.tsx   # ECharts 4-panel + crosshair 동기화
├── App.tsx                  # 레이아웃 조합
└── main.tsx                 # QueryClient + QueryClientProvider (이미 설정됨)
```

### 주요 구현 주의사항

1. **ECharts + React 18 Strict Mode**: `onEvents` prop 사용, `useEffect` 내 이벤트 등록 금지
   ```tsx
   // ✅ 올바른 방법
   <ReactECharts option={option} onEvents={{ 'datazoom': handleZoom }} />
   // ❌ 잘못된 방법 (StrictMode 이중 마운트로 이벤트 핸들러 중복)
   useEffect(() => { chartRef.current?.on('datazoom', handleZoom) }, [])
   ```
2. **크로스헤어 동기화**: `axisPointer.link: [{xAxisIndex: 'all'}]` — 4개 차트 동일 그룹
3. **최속 랩 자동 선택**: `laps` 배열에서 `lap_time_ms`가 가장 작은 랩 번호를 기본값으로
4. **TanStack Query v5 문법**: `useQuery({ queryKey, queryFn })` (v4의 `useQuery(key, fn)` 아님)
5. **팀 색상 표시**: `#${driver.team_color}` (DB는 `#` 없이 6자리 hex 저장)

### 레이아웃 목표

```
┌──────────────────────────────────────────────┐
│  F1 Telemetry Analytics                      │
├──────────────────────────────────────────────┤
│  [2025 ▾] [R1: Australian GP ▾] [Race ▾]    │
│  Driver A: [VER ▾]  Lap: [퀵랩 ▾]           │
│  Driver B: [HAM ▾]  Lap: [퀵랩 ▾]           │
├──────────────────────────────────────────────┤
│  Speed (km/h)          ━━━ VER  ─── HAM      │
├──────────────────────────────────────────────┤
│  Throttle (%)                                │
├──────────────────────────────────────────────┤
│  Brake                                       │
├──────────────────────────────────────────────┤
│  Gear                                        │
└──────────────────────────────────────────────┘
  ↑ 마우스 호버 시 4개 패널 크로스헤어 동시 이동
```

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
    "echarts-for-react": "latest"
  },
  "devDependencies": {
    "@tanstack/react-query-devtools": "^5.x"
  }
}
```

---

## Step 5 구현 완료 내역 (참고)

| 파일 | 역할 |
|------|------|
| `src/main.tsx` | QueryClient + QueryClientProvider + ReactQueryDevtools |
| `src/types/f1.ts` | Session/Driver/Lap/TelemetryResponse TypeScript 인터페이스 |
| `src/api/f1Client.ts` | axios 인스턴스 + fetchSessions/fetchDrivers/fetchLaps/fetchTelemetry |
| `src/hooks/useSessions.ts` | useQuery: GET /sessions |
| `src/hooks/useDrivers.ts` | useQuery: GET /drivers |
| `src/hooks/useLaps.ts` | useQuery: GET /sessions/{id}/laps + fastestLap() 헬퍼 |
| `src/hooks/useTelemetry.ts` | useQuery: GET /telemetry (두 드라이버+랩 모두 선택 시 활성화) |
| `src/components/SessionSelector.tsx` | 라운드별 optgroup 드롭다운 |
| `src/components/DriverLapSelector.tsx` | 드라이버·랩 선택 + 최속랩 자동선택 + 팀컬러 뱃지 |
| `src/components/TelemetryChart.tsx` | ECharts 단일 인스턴스 4-grid (속도/스로틀/브레이크/기어) |
| `src/App.tsx` | 전체 레이아웃 + 선택 상태 관리 |
| `src/index.css` | 다크 테마 스타일 (F1 레드 #e10600) |

### 알려진 이슈 / 다음 작업 (Step 6)
- `tslib` 패키지 devDependency 추가 필요 (echarts-for-react 의존성, 빌드 경고)
- Step 6: 브라우저에서 실제 차트 렌더링 확인 (VER vs NOR 비교)
- Step 7: 2025 시즌 전체 라운드 ETL 적재

*최종 업데이트: 2026-04-02 | Step 5 완료*
